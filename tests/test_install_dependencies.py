"""Exercise installation decisions with hardware/package/service doubles; no router writes."""
import os
from pathlib import Path
import subprocess
import tempfile
import unittest

ROOT = Path(__file__).resolve().parents[1]
HEADER = (ROOT / 'tools/oum-install-header.sh').read_text()
USB = (ROOT / 'luci-app-oum/root/usr/libexec/oum-usb-manager').read_text()
ENGINE = (ROOT / 'luci-app-oum/root/usr/libexec/oum-engine-manager').read_text()


def function(source, name):
    start = source.index(name + '() {')
    return source[start:source.index('\n}', start) + 2] + '\n'


def run(code, **env):
    return subprocess.run(['sh', '-eu', '-c', code], text=True, capture_output=True,
                          env={**os.environ, **env})


class Dependencies(unittest.TestCase):
    def test_controller_detection(self):
        with tempfile.TemporaryDirectory() as root:
            tree = Path(root)
            code = function(HEADER, 'oum_usb_controller_packages') + 'oum_usb_controller_packages'
            self.assertEqual(run(code, OUM_DEVICE_TREE=root).stdout, '')
            node = tree / 'soc/usb@11200000'
            node.mkdir(parents=True)
            (node / 'compatible').write_bytes(b'mediatek,mt7986-xhci\0mediatek,mtk-xhci\0')
            for status in [None, 'okay', 'ok']:
                if status:
                    (node / 'status').write_bytes(status.encode() + b'\0')
                result = run(code, OUM_DEVICE_TREE=root)
                self.assertEqual(result.returncode, 0, result.stderr)
                self.assertEqual(set(result.stdout.split()), {'kmod-usb3', 'kmod-usb-xhci-mtk'})
            (node / 'status').write_bytes(b'disabled\0')
            self.assertEqual(run(code, OUM_DEVICE_TREE=root).stdout, '')
            (node / 'status').write_bytes(b'okay\0')
            (tree / 'soc/status').write_bytes(b'disabled\0')
            self.assertEqual(run(code, OUM_DEVICE_TREE=root).stdout, '')

    def test_base_install_has_no_optional_apps(self):
        packages = HEADER.split("OUM_BASE_PACKAGES='")[1].split("'")[0]
        forbidden = {'aria2', 'ariang', 'ksmbd-server', 'minidlna', 'parted', 'tcping', 'kmod-usb-storage', 'luci-proto-3g', 'comgt'}
        self.assertFalse(forbidden.intersection(packages.split()))
        code = 'OUM_BASE_PACKAGES="' + packages + '"\n' + function(HEADER, 'oum_install_base_packages') + '''
apk() {
 case "$*" in
  'info -e dnsmasq-full') return 0;;
  info*) return 1;;
  *) printf '%s\\n' "$*";;
 esac
}
oum_die() { exit 1; }
oum_install_base_packages
'''
        result = run(code)
        self.assertEqual(result.returncode, 0, result.stderr)
        add = next(line for line in result.stdout.splitlines() if line.startswith('add ')).split()
        self.assertNotIn('dnsmasq', add)
        self.assertFalse(forbidden.intersection(add))
        for pkg in ['luci-i18n-base-ru', 'luci-i18n-firewall-ru', 'luci-i18n-package-manager-ru']:
            self.assertIn(pkg, add)

    def test_storage_setup_requires_device_and_is_lazy(self):
        for host, attached, ready, success in [(False, False, False, False), (True, False, False, False),
                                              (True, True, False, True), (True, True, True, True)]:
            code = USB[USB.index('STORAGE_PACKAGES='):USB.index('SMB_PACKAGES=')]
            code += function(USB, 'prepare')
            for name, value in [('usb_host_present', host), ('storage_attached', attached), ('packages_ready', ready)]:
                code += name + '() { ' + ('true' if value else 'false') + '; }\n'
            code += 'apk() { echo "INSTALL $*"; }; modprobe() { :; }; usb_disk() { echo /dev/sda; }; prepare'
            result = run(code)
            self.assertEqual(result.returncode == 0, success, result.stderr)
            self.assertEqual('INSTALL' in result.stdout, success and not ready)
            self.assertNotIn('aria2', result.stdout)
        # A failing package transaction must stop setup, not claim a prepared disk.
        result = run(function(USB, 'prepare') + '''
STORAGE_PACKAGES=block-mount
usb_host_present() { true; }; storage_attached() { true; }; packages_ready() { false; }
apk() { return 7; }; modprobe() { echo SHOULD_NOT_REACH; }; prepare
''')
        self.assertNotEqual(result.returncode, 0)
        self.assertNotIn('SHOULD_NOT_REACH', result.stdout)

    def test_aria2_requires_mount(self):
        code = function(USB, 'aria2_enable') + '''
managed_mountpoint() { return 1; }
apk() { echo SHOULD_NOT_INSTALL; }
aria2_enable
'''
        result = run(code)
        self.assertNotEqual(result.returncode, 0)
        self.assertNotIn('SHOULD_NOT_INSTALL', result.stdout)

    def test_ppp_modem_dependencies_are_automatic(self):
        source = (ROOT / 'luci-app-oum/root/usr/libexec/oum-mobile-manager').read_text()
        code = function(source, 'ensure_protocol') + '\ninstalled() { [ "$1" = comgt ]; }\ninstall_packages() { printf \'%s\\n\' "$*"; }\nensure_protocol ppp\n'
        result = run(code)
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual(set(result.stdout.split()), {'comgt', 'luci-proto-3g'})

    def test_engine_keeps_dns_variant(self):
        core = ENGINE.split("OUM_CORE_RUNTIME='")[1].split("'")[0]
        for variant in ['dnsmasq', 'dnsmasq-full']:
            with tempfile.TemporaryDirectory() as tmp:
                code = function(ENGINE, 'ensure_oum_runtime') + '''
OUM_RUNTIME='curl ruby ruby-yaml unzip'
OUM_CORE_RUNTIME=''' + repr(core) + '''
apk() { printf '%s\\n' "$*"; }
installed() { [ "$1" = "$DNS_VARIANT" ] || [ "$1" = ruby-yaml ]; }
ruby() { :; }; curl() { :; }
ensure_oum_runtime
'''
                log = str(Path(tmp) / 'log')
                result = run(code, LOG=log, DNS_VARIANT=variant)
                self.assertEqual(result.returncode, 0, result.stderr)
                args = Path(log).read_text().splitlines()[1].split()
                self.assertIn(variant, args)
                self.assertNotIn('dnsmasq' if variant == 'dnsmasq-full' else 'dnsmasq-full', args)
                self.assertFalse(any(arg.startswith('libubus20') for arg in args))


if __name__ == '__main__':
    unittest.main()
