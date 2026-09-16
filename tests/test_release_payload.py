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
    views = app / 'htdocs/luci-static/resources/view/oum'
    expected_views = {name + '-v1.js' for name in ['dashboard', 'settings', 'first-run', 'help', 'parental']}
    assert {p.name for p in views.glob('*-v*.js')} == expected_views
    assert not (views / 'oum.css').exists()
    assert (views / 'qrcode.min.js').is_file()
    menu = json.loads((app / 'root/usr/share/luci/menu.d/luci-app-oum.json').read_text())
    source_menu = json.loads((ROOT / 'luci-app-oum/root/usr/share/luci/menu.d/luci-app-oum.json').read_text())
    for route, entry in menu.items():
        action = entry.get('action', {})
        if action.get('type') != 'view':
            continue
        view = views / (action['path'].split('/')[-1] + '.js')
        original = ROOT / 'luci-app-oum/htdocs/luci-static/resources/view' / (source_menu[route]['action']['path'] + '.js')
        normalized = re.sub(r'\?v=(?:202609[\w-]*|\d+)(?=[\x27"`])', '?v=1', original.read_text())
        css_hash = hashlib.sha256((app / 'htdocs/luci-static/resources/oum/oum.css').read_bytes()).hexdigest()[:12]
        normalized = normalized.replace("oum/oum.css')}?v=1`", "oum/oum.css')}?v=1&h=" + css_hash + '`')
        assert view.read_text() == normalized, 'View behavior changed: ' + route
        subprocess.run(['node', '--check', str(view)], check=True)
    for name in ['luci-app-oum', 'luci-theme-oum']:
        for css in (package / name / 'htdocs').rglob('*.css'):
            assert css.read_bytes() == (ROOT / css.relative_to(package)).read_bytes(), css.name
    for name, script in [('luci-app-oum', 'install-luci-dev.sh'), ('luci-theme-oum', 'install-theme-dev.sh')]:
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
    cleanup = script[script.index('for old_view in '):script.index('rm -f /tmp/luci-indexcache')]
    cleanup = cleanup.replace('/www/luci-static/resources/view/oum', str(installed))
    subprocess.run(['sh', '-eu', '-c', cleanup], check=True)
    assert {p.name for p in installed.iterdir()} == expected_views | {'qrcode.min.js', 'unrelated.txt'}
    import shutil
    shutil.rmtree(installed)
    theme = package / 'luci-theme-oum'
    assert not (theme / 'htdocs/luci-static/resources/oum-theme-ux.js').exists()
    assert hashlib.sha256((theme / 'htdocs/luci-static/oum/stock-layout.css').read_bytes()).hexdigest() == '863845c21e0e3844a7bd200cf020a73aa614237ee8b4450e1354af0d3b08fcc6'
    for template in (theme / 'ucode/template/themes/oum').glob('*.ut'):
        text = template.read_text()
        for media, path in re.findall(r'\{\{ (media|resource) \}\}/([^?"\s]+)', text):
            if '{{' in path:
                continue
            if media == 'resource' and not (path.startswith('oum/') or path == 'oum-theme-ux.js'):
                continue  # LuCI's own runtime assets are supplied by luci-base.
            base = theme / 'htdocs/luci-static/oum' if media == 'media' else theme / 'htdocs/luci-static/resources'
            if path.startswith('oum/') and media == 'resource':
                base = app / 'htdocs/luci-static/resources'
            assert (base / path).exists(), (template.name, path)
    # Negative gate: do not print credential material when rejecting a release.
    secret = 'A' * 43 + '='
    bad = app / 'root/etc/config/network'
    bad.write_text('[Interface]\nPrivateKey = ' + secret + '\n')
    result = subprocess.run(['python3', str(ROOT / 'tools/audit-release.py'), str(package)], capture_output=True, text=True)
    assert result.returncode != 0
    assert secret not in result.stdout + result.stderr
print('Release payload: five active v1 views, unchanged CSS/behavior, assets present, credential gate OK')
