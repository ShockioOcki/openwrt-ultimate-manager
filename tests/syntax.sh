#!/bin/sh
set -eu
ROOT="$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)"
"$ROOT/tools/build.sh"
sh -n "$ROOT/dist/oum-test.sh"
ruby -c "$ROOT/helpers/source_converter.rb"
ruby -c "$ROOT/luci-app-oum/root/usr/libexec/oum-policy-yaml.rb"
ruby -c "$ROOT/luci-app-oum/root/usr/libexec/oum-speedtest-yaml.rb"
ruby -c "$ROOT/tests/test_speedtest_yaml.rb"
sh -n "$ROOT/tools/install-luci-dev.sh"
sh -n "$ROOT/luci-app-oum/root/usr/libexec/oum-firstboot"
sh -n "$ROOT/luci-app-oum/root/usr/libexec/oum-source-job"
sh -n "$ROOT/luci-app-oum/root/usr/libexec/oum-reset-first-run"
sh -n "$ROOT/luci-app-oum/root/usr/libexec/oum-mihomo-api"
sh -n "$ROOT/luci-app-oum/root/usr/libexec/oum-device-policy"
sh -n "$ROOT/luci-app-oum/root/usr/libexec/oum-subscription-info"
sh -n "$ROOT/luci-app-oum/root/usr/libexec/oum-speedtest"
sh -n "$ROOT/tests/test_subscription_info.sh"
sh -n "$ROOT/luci-app-oum/root/etc/uci-defaults/90_oum_firstboot"
python3 -m json.tool "$ROOT/luci-app-oum/root/usr/share/luci/menu.d/luci-app-oum.json" >/dev/null
python3 -m json.tool "$ROOT/luci-app-oum/root/usr/share/rpcd/acl.d/luci-app-oum.json" >/dev/null
if command -v node >/dev/null 2>&1; then
	node --check "$ROOT/luci-app-oum/htdocs/luci-static/resources/view/oum/first-run.js"
	node --check "$ROOT/luci-app-oum/htdocs/luci-static/resources/view/oum/dashboard.js"
fi
printf 'syntax tests: OK\n'
