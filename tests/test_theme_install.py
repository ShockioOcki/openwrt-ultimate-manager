#!/usr/bin/env python3
"""Exercise theme installation and reversible migration without changing the host."""
import os
from pathlib import Path
import subprocess
import tempfile
import unittest

ROOT = Path(__file__).resolve().parents[1]


class ThemeInstall(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.root = Path(self.tmp.name)
        self.bin = self.root / 'bin'
        self.bin.mkdir()
        self.env = dict(os.environ, PATH=str(self.bin) + ':' + os.environ['PATH'], TEST_ROOT=str(self.root))
        self.write('usr/share/ucode/luci/template/themes/proton2025/header.ut', 'proton')
        self.write('www/luci-static/proton2025/js/settings-sync.js', 'sync')
        self.write('etc/config/luci', 'unrelated setting')
        self.mock('apk', '''#!/bin/sh
printf '%s\n' "$*" >> "$TEST_ROOT/apk.log"
case "$1" in
 info) test -f "$TEST_ROOT/installed" ;;
 add) touch "$TEST_ROOT/installed" ;;
esac
''')
        self.mock('uci', '''#!/bin/sh
case "$*" in
 '-m import proton2025') cat > "$TEST_ROOT/etc/config/proton2025" ;;
 'set luci.main.mediaurlbase=/luci-static/proton2025') echo /luci-static/proton2025 > "$TEST_ROOT/media" ;;
 '-q get luci.main.mediaurlbase') cat "$TEST_ROOT/media" ;;
 '-q delete luci.themes.OUM') rm -f "$TEST_ROOT/theme-registered" ;;
 'commit proton2025'|'commit luci') : ;;
 *) exit 20 ;;
esac
''')

    def write(self, relative, text):
        path = self.root / relative
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(text)
        return path

    def mock(self, name, text):
        p = self.bin / name
        p.write_text(text)
        p.chmod(0o755)

    def run_script(self, name, success=True):
        script = (ROOT / 'tools' / name).read_text()
        # Redirect only target filesystem paths, retaining the real source payload/hash.
        for path in ['/usr/share/ucode', '/www', '/etc', '/usr/share/rpcd']:
            script = script.replace(path, str(self.root) + path)
        # UCI values are URLs, not target filesystem paths.
        script = script.replace('target="$archive$path"', 'target="$archive${path#' + str(self.root) + '}"')
        staged = self.root / name
        staged.write_text(script)
        result = subprocess.run(['sh', str(staged), str(ROOT / 'luci-app-oum')], env=self.env, capture_output=True, text=True)
        self.assertEqual(result.returncode == 0, success, result.stdout + result.stderr)
        return result

    def test_fresh_install_and_preserved_preferences_on_repeat(self):
        self.run_script('install-proton.sh')
        self.assertIn('add --allow-untrusted', (self.root / 'apk.log').read_text())
        defaults = (ROOT / 'luci-app-oum/root/usr/share/oum/proton2025.defaults').read_text()
        self.assertEqual((self.root / 'etc/config/proton2025').read_text(), defaults)
        self.write('etc/config/proton2025', "option mode 'dark'\noption zoom '110'\n")
        self.run_script('install-proton.sh')
        self.assertEqual((self.root / 'apk.log').read_text().count('add --allow-untrusted'), 1)
        self.assertIn("zoom '110'", (self.root / 'etc/config/proton2025').read_text())
        self.assertEqual((self.root / 'etc/config/luci').read_text(), 'unrelated setting')

    def test_installed_proton_is_retained(self):
        self.write('installed', 'newer installed version')
        self.run_script('install-proton.sh')
        self.assertNotIn('add ', (self.root / 'apk.log').read_text())

    def test_archive_requires_ready_replacements_and_is_repeatable(self):
        old = self.write('www/luci-static/oum/cascade.css', 'original theme')
        self.write('theme-registered', 'yes')
        self.run_script('archive-luci-theme.sh', success=False)
        self.assertTrue(old.exists())
        self.write('usr/share/ucode/luci/template/themes/oum-app/header.ut', 'new shell')
        self.write('media', '/luci-static/proton2025\n')
        self.run_script('archive-luci-theme.sh')
        self.assertFalse(old.exists())
        copies = list((self.root / 'etc/oum/experimental').glob('*/www/luci-static/oum/cascade.css'))
        self.assertEqual(len(copies), 1)
        self.assertEqual(copies[0].read_text(), 'original theme')
        self.run_script('archive-luci-theme.sh')
        self.assertTrue(copies[0].exists())
        self.assertFalse((self.root / 'theme-registered').exists())


if __name__ == '__main__':
    unittest.main()
