#!/usr/bin/env python3
"""Check the actual distributable, not only the working tree."""
import hashlib
import io
import json
from pathlib import Path
import re
import subprocess
import tarfile
import tempfile

ROOT = Path(__file__).resolve().parents[1]
blob = (ROOT / 'dist/oum-install.sh').read_bytes()
size = int(re.search(rb"OUM_PAYLOAD_SIZE='(\d+)'", blob).group(1))
expected = re.search(rb"OUM_PAYLOAD_SHA256='([0-9a-f]+)'", blob).group(1).decode()
payload = blob[-size:]
assert hashlib.sha256(payload).hexdigest() == expected
with tempfile.TemporaryDirectory() as temporary:
    package = Path(temporary)
    with tarfile.open(fileobj=io.BytesIO(payload), mode='r:gz') as archive:
        for member in archive.getmembers():
            assert not member.name.startswith('/') and '..' not in Path(member.name).parts
            assert member.isdir() or member.isfile(), member.name
        archive.extractall(package)
    subprocess.run(['python3', str(ROOT / 'tools/audit-release.py'), str(package)], check=True)
    app = package / 'luci-app-oum'
    offloading = package / 'tools/install-offloading.sh'
    assert offloading.read_bytes() == (ROOT / 'tools/install-offloading.sh').read_bytes()
    subprocess.run(['sh', '-n', str(offloading)], check=True)
    header = blob[:-size].decode()
    assert 'sh "$OUM_INSTALL_TMP/package/tools/install-offloading.sh" || oum_die' in header
    assert 'kmod-nft-offload' in header.split("OUM_BASE_PACKAGES='")[1].split("'")[0]
    views = app / 'htdocs/luci-static/resources/view/oum'
    expected_views = {p.name for p in views.glob('*-v*.js')}
    assert len(expected_views) == 5
    assert {re.fullmatch(r'(dashboard|settings|first-run|help|parental)-v1-[0-9a-f]{12}\.js', name).group(1) for name in expected_views} == {'dashboard', 'settings', 'first-run', 'help', 'parental'}
    assert not (views / 'oum.css').exists()
    assert (views / 'qrcode.min.js').is_file()
    menu = json.loads((app / 'root/usr/share/luci/menu.d/luci-app-oum.json').read_text())
    source_menu = json.loads((ROOT / 'luci-app-oum/root/usr/share/luci/menu.d/luci-app-oum.json').read_text())
    for route, entry in menu.items():
        action = entry.get('action', {})
        if action.get('type') not in ('view', 'template'):
            continue
        assert action['type'] == 'template', 'OUM must select its theme per page'
        template = app / 'root/usr/share/ucode/luci/template' / (action['path'] + '.ut')
        assert template.read_text().count("http.redirect(dispatcher.build_url('oum'))") == 1
        assert "{% include('view', { view: '" + action['path'] + "', theme: 'oum-app', media: '/luci-static/oum-app' }) %}\n" in template.read_text()
        view = views / (action['path'].split('/')[-1] + '.js')
        original = ROOT / 'luci-app-oum/htdocs/luci-static/resources/view' / (source_menu[route]['action']['path'] + '.js')
        normalized = re.sub(r'\?v=(?:202609[\w-]*|\d+)(?=[\x27"`])', '?v=1', original.read_text())
        css_hash = hashlib.sha256((app / 'htdocs/luci-static/resources/oum/oum.css').read_bytes()).hexdigest()[:12]
        normalized = normalized.replace("oum/oum.css')}?v=1`", "oum/oum.css')}?v=1&h=" + css_hash + '`')
        assert view.read_text() == normalized, 'View behavior changed: ' + route
        assert view.stem.endswith('-' + hashlib.sha256(normalized.encode()).hexdigest()[:12])
        subprocess.run(['node', '--check', str(view)], check=True)
    for name in ['luci-app-oum']:
        for css in (package / name / 'htdocs').rglob('*.css'):
            assert css.read_bytes() == (ROOT / css.relative_to(package)).read_bytes(), css.name
    for name, script in [('luci-app-oum', 'install-luci-dev.sh'), ('luci-app-oum', 'install-proton.sh')]:
        text = (package / 'tools' / script).read_text()
        subprocess.run(['sh', '-n', str(package / 'tools' / script)], check=True)
        for reference in re.findall(r'\$SOURCE_DIR/([^"\n]+)', text):
            assert list((package / name).glob(reference)), (script, reference)
    # Execute the staged cleanup against a fake install directory.
    installed = package / 'fake-installed-views'
    installed.mkdir()
    for name in expected_views | {'dashboard-v64.js', 'help-v3.js', 'oum.css', 'qrcode.min.js', 'unrelated.txt'}:
        (installed / name).write_text('keep or remove')
    script = (package / 'tools/install-luci-dev.sh').read_text()
    # A clean install must provide every dashboard icon without the old theme.
    icon_start = script.index('mkdir -p /www/luci-static/resources/oum/icons')
    icon_end = script.index('chmod 644 /www/luci-static/resources/oum/icons/*.svg', icon_start)
    icon_install = script[icon_start:script.index('\n', icon_end)]
    webroot = package / 'fake-www'
    icon_install = icon_install.replace('/www/', str(webroot) + '/')
    subprocess.run(['sh', '-eu', '-c', 'SOURCE_DIR="$1"\n' + icon_install, 'install-icons', str(app)], check=True)
    dashboard = next(views.glob('dashboard-v*.js')).read_text()
    assert '/luci-static/oum/icons/' not in dashboard, 'Dashboard still depends on the archived theme'
    icon_names = set(re.findall(r'[\w-]+\.svg', dashboard))
    assert {'ui-globe.svg', 'ui-vpn.svg', 'ui-users.svg', 'ui-temperature.svg'} <= icon_names
    import xml.etree.ElementTree as ET
    for name in icon_names:
        installed_icon = webroot / 'luci-static/resources/oum/icons' / name
        assert installed_icon.read_bytes() == (app / 'htdocs/luci-static/resources/oum/icons' / name).read_bytes()
        assert ET.parse(installed_icon).getroot().tag == '{http://www.w3.org/2000/svg}svg'
    import shutil
    shutil.rmtree(webroot)
    cleanup = script[script.index('for old_view in '):script.index('rm -f /tmp/luci-indexcache')]
    cleanup = cleanup.replace('/www/luci-static/resources/view/oum', str(installed))
    subprocess.run(['sh', '-eu', '-c', cleanup], check=True)
    assert {p.name for p in installed.iterdir()} == expected_views | {'qrcode.min.js', 'unrelated.txt'}
    import shutil
    shutil.rmtree(installed)
    assert not (package / 'luci-theme-oum').exists()
    assert not (package / 'experimental').exists()
    assert not (package / 'tools/install-theme-dev.sh').exists()
    shell = app / 'htdocs/luci-static/oum-app'
    assert {p.name for p in shell.iterdir()} == {'bootstrap-base.css', 'bootstrap-mobile.css', 'cascade.css', 'buttons.css', 'compact-inputs.css', 'logo.svg', 'brand.svg'}
    proton = app / 'root/usr/share/oum/packages/proton2025/luci-theme-proton2025-1.4.1-r1.apk'
    assert hashlib.sha256(proton.read_bytes()).hexdigest() == '01a779aad7e26fec6e9ad4dde00cec9b0f44883b9c09b88083a498a6108fbb97'
    assert (app / 'root/usr/share/oum/proton2025.defaults').read_bytes() == (ROOT / 'luci-app-oum/root/usr/share/oum/proton2025.defaults').read_bytes()
    for template in (app / 'root/usr/share/ucode/luci/template/themes/oum-app').glob('*.ut'):
        text = template.read_text()
        for media, path in re.findall(r'\{\{ (media|resource) \}\}/([^?"\s]+)', text):
            if '{{' in path:
                continue
            if media == 'resource' and not path.startswith('oum/'):
                continue  # LuCI runtime assets are supplied by luci-base.
            base = shell if media == 'media' else app / 'htdocs/luci-static/resources'
            assert (base / path).exists(), (template.name, path)
    # Negative gate: do not print credential material when rejecting a release.
    secret = 'A' * 43 + '='
    bad = app / 'root/etc/config/network'
    bad.write_text('[Interface]\nPrivateKey = ' + secret + '\n')
    result = subprocess.run(['python3', str(ROOT / 'tools/audit-release.py'), str(package)], capture_output=True, text=True)
    assert result.returncode != 0
    assert secret not in result.stdout + result.stderr
print('Release payload: five content-versioned views, unchanged CSS/behavior, Proton bundled, experimental theme excluded, credential gate OK')
