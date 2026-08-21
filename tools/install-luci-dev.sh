#!/bin/sh

set -eu

SOURCE_DIR="${1:-luci-app-oum}"
[ -d "$SOURCE_DIR" ] || { echo "Directory not found: $SOURCE_DIR" >&2; exit 1; }
REPO_DIR="$(CDPATH= cd -- "$SOURCE_DIR/.." && pwd)"
[ -f "$REPO_DIR/dist/oum-test.sh" ] || { echo "Build dist/oum-test.sh first" >&2; exit 1; }
[ -f "$REPO_DIR/helpers/source_converter.rb" ] || { echo "Converter source not found" >&2; exit 1; }

mkdir -p /etc/config /usr/share/luci/menu.d /usr/share/ucode/luci/controller /usr/share/rpcd/acl.d /usr/share/rpcd/ucode \
	/usr/libexec/oum /www/luci-static/resources/view/oum

[ -f /etc/config/oum ] || cp "$SOURCE_DIR/root/etc/config/oum" /etc/config/oum
cp "$SOURCE_DIR/root/usr/share/luci/menu.d/luci-app-oum.json" /usr/share/luci/menu.d/luci-app-oum.json
cp "$SOURCE_DIR/root/usr/share/ucode/luci/controller/oum.uc" /usr/share/ucode/luci/controller/oum.uc
cp "$SOURCE_DIR/root/usr/share/rpcd/acl.d/luci-app-oum.json" /usr/share/rpcd/acl.d/luci-app-oum.json
cp "$SOURCE_DIR/root/usr/share/rpcd/ucode/oum" /usr/share/rpcd/ucode/oum
cp "$SOURCE_DIR/root/usr/libexec/oum-firstboot" /usr/libexec/oum-firstboot
cp "$SOURCE_DIR/root/usr/libexec/oum-source-job" /usr/libexec/oum-source-job
cp "$SOURCE_DIR/root/usr/libexec/oum-reset-first-run" /usr/libexec/oum-reset-first-run
cp "$SOURCE_DIR/root/usr/libexec/oum-mihomo-api" /usr/libexec/oum-mihomo-api
cp "$SOURCE_DIR/root/usr/libexec/oum-passwall-nodes" /usr/libexec/oum-passwall-nodes
cp "$SOURCE_DIR/root/usr/libexec/oum-passwall-policy" /usr/libexec/oum-passwall-policy
cp "$SOURCE_DIR/root/usr/libexec/oum-device-policy" /usr/libexec/oum-device-policy
cp "$SOURCE_DIR/root/usr/libexec/oum-policy-yaml.rb" /usr/libexec/oum-policy-yaml.rb
cp "$SOURCE_DIR/root/usr/libexec/oum-subscription-info" /usr/libexec/oum-subscription-info
cp "$SOURCE_DIR/root/usr/libexec/oum-speedtest" /usr/libexec/oum-speedtest
cp "$SOURCE_DIR/root/usr/libexec/oum-speedtest-yaml.rb" /usr/libexec/oum-speedtest-yaml.rb
cp "$SOURCE_DIR/root/usr/libexec/oum-backup" /usr/libexec/oum-backup
cp "$SOURCE_DIR/root/usr/libexec/oum-backup-codec.rb" /usr/libexec/oum-backup-codec.rb
cp "$SOURCE_DIR/root/usr/libexec/oum-reset-vpn" /usr/libexec/oum-reset-vpn
cp "$SOURCE_DIR/root/usr/libexec/oum-system-job" /usr/libexec/oum-system-job
cp "$SOURCE_DIR/root/usr/libexec/oum-login-default" /usr/libexec/oum-login-default
cp "$REPO_DIR/dist/oum-test.sh" /usr/libexec/oum-runtime.sh
cp "$REPO_DIR/helpers/source_converter.rb" /usr/libexec/oum/source_converter.rb
cp "$SOURCE_DIR/htdocs/luci-static/resources/view/oum/first-run.js" /www/luci-static/resources/view/oum/first-run.js
cp "$SOURCE_DIR/htdocs/luci-static/resources/view/oum/dashboard-v7.js" /www/luci-static/resources/view/oum/dashboard-v7.js
cp "$SOURCE_DIR/htdocs/luci-static/resources/view/oum/settings.js" /www/luci-static/resources/view/oum/settings.js

chmod 600 /etc/config/oum
chmod 755 /usr/libexec/oum-firstboot /usr/libexec/oum-source-job /usr/libexec/oum-reset-first-run \
	/usr/libexec/oum-mihomo-api /usr/libexec/oum-passwall-nodes /usr/libexec/oum-passwall-policy /usr/libexec/oum-device-policy /usr/libexec/oum-policy-yaml.rb \
	/usr/libexec/oum-subscription-info /usr/libexec/oum-speedtest /usr/libexec/oum-speedtest-yaml.rb \
	/usr/libexec/oum-backup /usr/libexec/oum-backup-codec.rb /usr/libexec/oum-reset-vpn \
	/usr/libexec/oum-system-job \
	/usr/libexec/oum-login-default \
	/usr/libexec/oum-runtime.sh
chmod 600 /usr/libexec/oum/source_converter.rb
chmod 644 /usr/share/luci/menu.d/luci-app-oum.json /usr/share/ucode/luci/controller/oum.uc /usr/share/rpcd/acl.d/luci-app-oum.json \
	/usr/share/rpcd/ucode/oum /www/luci-static/resources/view/oum/first-run.js \
	/www/luci-static/resources/view/oum/dashboard-v7.js /www/luci-static/resources/view/oum/settings.js

rm -f /tmp/luci-indexcache /tmp/luci-modulecache/* 2>/dev/null || true
/usr/libexec/oum-login-default
/etc/init.d/rpcd restart
/etc/init.d/uhttpd restart

echo "OUM LuCI development files installed. Run /usr/libexec/oum-firstboot when ready."
