#!/usr/bin/env python3
"""Run the installer and real Zapret FIX against isolated UCI/firewall state."""
import json
import os
from pathlib import Path
import subprocess
import tempfile
import unittest

ROOT = Path(__file__).resolve().parents[1]
OLD = 'meta l4proto { tcp, udp } flow offload @ft;'
FIXED = 'meta l4proto { tcp, udp } ct original packets ge 30 flow offload @ft;'


class InstallOffloading(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.root = Path(self.tmp.name)
        self.bin = self.root / 'bin'
        self.bin.mkdir()
        self.env = dict(os.environ, PATH=str(self.bin) + ':' + os.environ['PATH'], TEST_ROOT=str(self.root))
        self.config = self.write('etc/config/firewall', json.dumps({'unrelated': 'keep'}))
        self.template = self.write('usr/share/firewall4/templates/ruleset.uc', OLD + '\n')
        self.write('sys/firmware/devicetree/base/compatible', 'cudy,tr3000-256mb-v1\0mediatek,mt7981\0')
        (self.root / 'etc/oum/rollback').mkdir(parents=True)
        for source, target in [('tools/install-offloading.sh', 'install.sh'),
                               ('luci-app-oum/root/usr/libexec/oum-zapret-manager', 'usr/libexec/oum-zapret-manager')]:
            text = (ROOT / source).read_text()
            for prefix in ['/etc/', '/usr/share/firewall4/', '/usr/libexec/', '/sys/']:
                text = text.replace(prefix, str(self.root) + prefix)
            p = self.write(target, text)
            p.chmod(0o700)
        self.mock('uci', '''#!/usr/bin/env python3
import json, os, sys
from pathlib import Path
r = Path(os.environ['TEST_ROOT'])
p = r / 'etc/config/firewall'
pending = r / 'pending'
args = [a for a in sys.argv[1:] if a != '-q']
data = json.loads(p.read_text())
staged = json.loads(pending.read_text()) if pending.exists() else {}
action = args[0]
if action == 'changes':
    if staged: print(json.dumps(staged))
elif action == 'get':
    key = args[1].split('].', 1)[-1]
    if args[1] == 'firewall.@defaults[0]': print('defaults')
    elif key in staged or key in data: print(staged.get(key, data.get(key)))
    else: sys.exit(1)
elif action == 'set':
    key, value = args[1].split('].', 1)[1].split('=', 1)
    staged[key] = value
    pending.write_text(json.dumps(staged))
elif action == 'commit':
    if os.environ.get('FAIL_COMMIT') == '1': sys.exit(1)
    data.update(staged)
    p.write_text(json.dumps(data))
    pending.unlink(missing_ok=True)
elif action == 'revert': pending.unlink(missing_ok=True)
else: sys.exit(20)
''')
        self.mock('fw4', '''#!/usr/bin/env python3
import json, os, sys
from pathlib import Path
r = Path(os.environ['TEST_ROOT'])
action = sys.argv[1]
with (r / 'events').open('a') as f: f.write(action + '\\n')
if action == 'reload':
    data = json.loads((r / 'etc/config/firewall').read_text())
    template = (r / 'usr/share/firewall4/templates/ruleset.uc').read_text()
    with (r / 'reloads').open('a') as f:
        f.write(json.dumps({'config': data, 'template': template}) + '\\n')
if os.environ.get('FAIL_FW4') == action:
    sys.exit(1)
''')

    def write(self, name, text):
        path = self.root / name
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(text)
        return path

    def mock(self, name, text):
        path = self.write('bin/' + name, text)
        path.chmod(0o700)

    def run_install(self, success=True, **env):
        result = subprocess.run(['sh', str(self.root / 'install.sh')], env={**self.env, **env},
                                capture_output=True, text=True, timeout=10)
        self.assertEqual(result.returncode == 0, success, result.stdout + result.stderr)
        return result

    def test_clean_mediaTek_install_and_repeat(self):
        before = self.config.read_bytes()
        self.run_install()
        self.assertEqual(json.loads(self.config.read_text()),
                         {'unrelated': 'keep', 'flow_offloading': '1', 'flow_offloading_hw': '1'})
        self.assertEqual(self.template.read_text(), FIXED + '\n')
        backup = next((self.root / 'etc/oum/rollback').glob('offloading-install.*'))
        self.assertEqual((backup / 'firewall').read_bytes(), before)
        self.assertEqual((backup / 'ruleset.uc').read_text(), OLD + '\n')
        for line in (self.root / 'reloads').read_text().splitlines():
            self.assertEqual(json.loads(line)['template'], FIXED + '\n')
        calls = (self.root / 'events').read_text()
        self.run_install()
        self.assertEqual((self.root / 'events').read_text(), calls)
        self.assertEqual(len(list(backup.parent.glob('offloading-install.*'))), 1)

    def test_other_platform_uses_software(self):
        self.write('sys/firmware/devicetree/base/compatible', 'vendor,other\0')
        self.run_install()
        self.assertEqual(json.loads(self.config.read_text())['flow_offloading_hw'], '0')
        self.assertEqual(self.template.read_text(), FIXED + '\n')

    def test_supported_platforms(self):
        for soc in ['mt7621-soc', 'mt7622', 'mt7981', 'mt7986', 'mt7988']:
            with self.subTest(soc=soc):
                self.config.write_text('{}')
                self.write('sys/firmware/devicetree/base/compatible', 'mediatek,' + soc + '\0')
                self.run_install()
                self.assertEqual(json.loads(self.config.read_text())['flow_offloading_hw'], '1')

    def test_existing_fix_still_applies_new_flags(self):
        self.template.write_text(FIXED + '\n')
        self.run_install()
        self.assertEqual((self.root / 'events').read_text(), 'check\nreload\n')

    def test_failed_check_reload_or_commit_restores_both_files(self):
        for failure in [{'FAIL_FW4': 'check'}, {'FAIL_FW4': 'reload'}, {'FAIL_COMMIT': '1'}]:
            with self.subTest(failure=failure):
                config = self.config.read_bytes()
                template = self.template.read_bytes()
                self.run_install(success=False, **failure)
                self.assertEqual(self.config.read_bytes(), config)
                self.assertEqual(self.template.read_bytes(), template)
                self.assertFalse((self.root / 'pending').exists())

    def test_unknown_template_rolls_back(self):
        self.template.write_text('unknown template\n')
        before = self.config.read_bytes()
        self.run_install(success=False)
        self.assertEqual(self.config.read_bytes(), before)
        self.assertEqual(self.template.read_text(), 'unknown template\n')

    def test_pending_user_changes_are_untouched(self):
        pending = self.write('pending', '{"user_setting": "keep"}')
        before = self.config.read_bytes()
        self.run_install(success=False)
        self.assertEqual(pending.read_text(), '{"user_setting": "keep"}')
        self.assertEqual(self.config.read_bytes(), before)
        self.assertFalse((self.root / 'events').exists())


if __name__ == '__main__':
    unittest.main()
