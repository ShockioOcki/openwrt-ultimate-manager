#!/usr/bin/env python3
"""Normalize only the staging directory; development views remain intact."""
import json
import hashlib
from pathlib import Path
import re
import sys


def prepare(package):
    app = package / 'luci-app-oum'
    views = app / 'htdocs/luci-static/resources/view/oum'
    menu_file = app / 'root/usr/share/luci/menu.d/luci-app-oum.json'
    menu = json.loads(menu_file.read_text())
    replacements = {}
    active = {}
    app_css_hash = hashlib.sha256((app / 'htdocs/luci-static/resources/oum/oum.css').read_bytes()).hexdigest()[:12]
    for entry in menu.values():
        action = entry.get('action', {})
        if action.get('type') != 'view':
            continue
        old = action['path']
        new = re.sub(r'-v\d+$', '-v1', old)
        assert old.startswith('oum/') and new.endswith('-v1'), old
        active[new.split('/')[-1] + '.js'] = (views / (old.split('/')[-1] + '.js')).read_text()
        replacements[old.split('/')[-1]] = new.split('/')[-1]
        action['path'] = new
    # Keep the shared QR implementation and license; all previous views/styles go.
    keep = {'qrcode.min.js', 'qrcode.min.js.LICENSE.txt'}
    for item in views.iterdir():
        if item.is_file() and item.name not in keep:
            item.unlink()
    for name, text in active.items():
        text = re.sub(r'\?v=(?:202609[\w-]*|\d+)(?=[\x27"`])', '?v=1', text)
        text = text.replace("oum/oum.css')}?v=1`", "oum/oum.css')}?v=1&h=" + app_css_hash + '`')
        (views / name).write_text(text)
    menu_file.write_text(json.dumps(menu, ensure_ascii=False, indent='\t') + '\n')
    installer = package / 'tools/install-luci-dev.sh'
    text = installer.read_text()
    for old, new in replacements.items():
        text = text.replace(old + '.js', new + '.js')
    # Backup is created by the outer installer before this upgrade cleanup.
    allowed = '|'.join(sorted(active))
    cleanup = """# Release keeps only the active view generation (old files are in install-backups).
for old_view in /www/luci-static/resources/view/oum/*-v[0-9]*.js; do
 case "${old_view##*/}" in
  """ + allowed + """) ;;
  *) rm -f "$old_view" ;;
 esac
done
rm -f /www/luci-static/resources/view/oum/oum.css
"""
    text = text.replace('rm -f /tmp/luci-indexcache ', cleanup + '\nrm -f /tmp/luci-indexcache /tmp/luci-indexcache.*.json ')
    installer.write_text(text)
    theme = package / 'luci-theme-oum'
    # This experimental layer was never part of the accepted live theme.
    (theme / 'htdocs/luci-static/resources/oum-theme-ux.js').unlink(missing_ok=True)
    for template in (theme / 'ucode/template/themes/oum').glob('*.ut'):
        lines = []
        for line in template.read_text().splitlines(keepends=True):
            if '{{ media }}/' in line or '{{ resource }}/oum/' in line or '{{ resource }}/oum-theme-ux.js' in line:
                line = re.sub(r'\?v=[^"]+', '?v=1', line)
                match = re.search(r'{{ (media|resource) }}/([^?" ]+)\?v=1', line)
                if match:
                    kind, asset = match.groups()
                    base = theme / ('htdocs/luci-static/oum' if kind == 'media' else 'htdocs/luci-static/resources')
                    if kind == 'resource' and asset.startswith('oum/'):
                        base = app / 'htdocs/luci-static/resources'
                    digest = hashlib.sha256((base / asset).read_bytes()).hexdigest()[:12]
                    line = line.replace('?v=1', '?v=1&h=' + digest)
            lines.append(line)
        template.write_text(''.join(lines))
    # Release payload contains runtime trees, not development demos or instructions.
    for tree, allowed in [(app, {'Makefile', 'root', 'htdocs'}), (theme, {'Makefile', 'root', 'htdocs', 'ucode'})]:
        for item in tree.iterdir():
            if item.is_file() and item.name not in allowed:
                item.unlink()
    print('Release views: ' + ', '.join(sorted(active)))


if __name__ == '__main__':
    prepare(Path(sys.argv[1]).resolve())
