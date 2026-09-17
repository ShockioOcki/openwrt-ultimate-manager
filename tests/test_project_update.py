#!/usr/bin/env python3
"""Exercise update checks and installation guards without network or router writes."""
import json
import os
from pathlib import Path
import subprocess
import tempfile
import unittest

ROOT = Path(__file__).resolve().parents[1]
MANAGER = ROOT / 'luci-app-oum/root/usr/libexec/oum-project-manager'
REVISION = 'a' * 40


class ProjectUpdateTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.base = Path(self.tmp.name)
        self.env = dict(os.environ, PATH=str(self.base) + ':' + os.environ['PATH'],
                        TEST_DIR=str(self.base), TEST_REVISION=REVISION)
        source = MANAGER.read_text().replace('/etc/oum/version', str(self.base / 'version'))
        source = source.replace('/tmp/oum-project-update.XXXXXX', str(self.base / 'download.XXXXXX'))
        source = source.replace('\tsnapshot\n', '\tprintf "snapshot\\n" >> "$TEST_DIR/events"\n')
        self.manager = self.base / 'manager'
        self.manager.write_text(source)
        self.script('curl', '''#!/bin/sh
set -eu
printf '%s\\n' "$*" >> "$TEST_DIR/requests"
[ "${TEST_FAIL:-}" != 1 ] || exit 22
output=''
while [ "$#" -gt 0 ]; do
 case "$1" in -o) output="$2"; shift;; esac
 shift
done
if [ -n "$output" ]; then cp "$TEST_DIR/release" "$output"; else printf '{}'; fi
''')
        self.script('jsonfilter', '#!/bin/sh\ncat >/dev/null\nprintf "%s" "$TEST_REVISION"\n')
        self.release('0.0.2+new-build', '0.0.1+old-build')

    def script(self, name, content):
        path = self.base / name
        path.write_text(content)
        path.chmod(0o700)

    def release(self, candidate, installed):
        (self.base / 'version').write_text(installed + '\n')
        (self.base / 'release').write_text(
            "#!/bin/sh\nset -eu\n\nOUM_INSTALLER_VERSION='" + candidate + "'\n"
            'printf "%s\\n" "$1" >> "$TEST_DIR/events"\n')

    def run_manager(self, *args):
        return subprocess.run(['sh', str(self.manager), *args], env=self.env,
                              text=True, capture_output=True, timeout=5)

    def test_version_order_and_check_never_executes_installer(self):
        for candidate, installed, available in [
            ('0.0.1+different', '0.0.1+installed', False),
            ('0.0.2+build', '0.0.1+installed', True),
            ('0.0.1', '0.0.2', False),
            ('0.0.10', '0.0.9', True),
            ('0.10.0', '0.9.99', True),
            ('1.0.0', '0.99.99', True),
        ]:
            with self.subTest(candidate=candidate, installed=installed):
                self.release(candidate, installed)
                result = self.run_manager('check')
                self.assertEqual(result.returncode, 0, result.stderr)
                data = json.loads(result.stdout)
                self.assertEqual(data['available'], available)
                self.assertEqual(data['version'], candidate.split('+')[0])
                self.assertEqual(data['revision'], REVISION)
                self.assertFalse((self.base / 'events').exists())
                self.assertFalse(list(self.base.glob('download.*')))

    def test_failed_check_does_not_report_up_to_date(self):
        self.env['TEST_FAIL'] = '1'
        result = self.run_manager('check')
        self.assertNotEqual(result.returncode, 0)
        self.assertNotIn('"ok":true', result.stdout)

    def test_invalid_release_and_revision_are_rejected(self):
        for version in ['development', 'garbage', '0.0.2\nmalformed', '0.0', '01.0.2']:
            self.release(version, '0.0.1')
            self.assertNotEqual(self.run_manager('check').returncode, 0)
        self.env['TEST_REVISION'] = 'main;echo unsafe'
        self.assertNotEqual(self.run_manager('check').returncode, 0)
        self.assertFalse((self.base / 'events').exists())

    def test_update_requires_checked_target_and_newer_version(self):
        for args in [('update',), ('update', 'main', '0.0.2'),
                     ('update', REVISION, '0.0.3')]:
            self.assertNotEqual(self.run_manager(*args).returncode, 0)
        for version in ['0.0.1+different', '0.0.0']:
            self.release(version, '0.0.1')
            result = self.run_manager('update', REVISION, version.split('+')[0])
            self.assertNotEqual(result.returncode, 0)
        self.assertFalse((self.base / 'events').exists())

    def test_update_installs_pinned_release_after_validation_and_snapshot(self):
        result = self.run_manager('update', REVISION, '0.0.2')
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual((self.base / 'events').read_text().splitlines(),
                         ['--check', 'snapshot', '--install'])
        requests = (self.base / 'requests').read_text()
        self.assertIn('/' + REVISION + '/dist/oum-install.sh', requests)
        self.assertNotIn('commits/main', requests)
        self.assertFalse(list(self.base.glob('download.*')))


if __name__ == '__main__':
    unittest.main()
