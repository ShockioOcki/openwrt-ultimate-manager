#!/bin/sh

set -eu

SOURCE_DIR="${1:-luci-app-oum}"
[ -d "$SOURCE_DIR" ] || { echo "Directory not found: $SOURCE_DIR" >&2; exit 1; }
REPO_DIR="$(CDPATH= cd -- "$SOURCE_DIR/.." && pwd)"
[ -f "$REPO_DIR/dist/oum-test.sh" ] || { echo "Build dist/oum-test.sh first" >&2; exit 1; }
[ -f "$REPO_DIR/helpers/source_converter.rb" ] || { echo "Converter source not found" >&2; exit 1; }

mkdir -p /etc/config /usr/share/luci/menu.d /usr/share/rpcd/acl.d /usr/share/rpcd/ucode \
	/usr/libexec/oum /www/luci-static/resources/view/oum

[ -f /etc/config/oum ] || cp "$SOURCE_DIR/root/etc/config/oum" /etc/config/oum
cp "$SOURCE_DIR/root/usr/share/luci/menu.d/luci-app-oum.json" /usr/share/luci/menu.d/luci-app-oum.json
cp "$SOURCE_DIR/root/usr/share/rpcd/acl.d/luci-app-oum.json" /usr/share/rpcd/acl.d/luci-app-oum.json
cp "$SOURCE_DIR/root/usr/share/rpcd/ucode/oum" /usr/share/rpcd/ucode/oum
cp "$SOURCE_DIR/root/usr/libexec/oum-firstboot" /usr/libexec/oum-firstboot
cp "$SOURCE_DIR/root/usr/libexec/oum-source-job" /usr/libexec/oum-source-job
cp "$SOURCE_DIR/root/usr/libexec/oum-reset-first-run" /usr/libexec/oum-reset-first-run
cp "$REPO_DIR/dist/oum-test.sh" /usr/libexec/oum-runtime.sh
cp "$REPO_DIR/helpers/source_converter.rb" /usr/libexec/oum/source_converter.rb
cp "$SOURCE_DIR/htdocs/luci-static/resources/view/oum/first-run.js" /www/luci-static/resources/view/oum/first-run.js
cp "$SOURCE_DIR/htdocs/luci-static/resources/view/oum/dashboard.js" /www/luci-static/resources/view/oum/dashboard.js

chmod 600 /etc/config/oum
chmod 755 /usr/libexec/oum-firstboot /usr/libexec/oum-source-job /usr/libexec/oum-reset-first-run /usr/libexec/oum-runtime.sh
chmod 600 /usr/libexec/oum/source_converter.rb
chmod 644 /usr/share/luci/menu.d/luci-app-oum.json /usr/share/rpcd/acl.d/luci-app-oum.json \
	/usr/share/rpcd/ucode/oum /www/luci-static/resources/view/oum/first-run.js \
	/www/luci-static/resources/view/oum/dashboard.js

rm -f /tmp/luci-indexcache /tmp/luci-modulecache/* 2>/dev/null || true
/etc/init.d/rpcd restart
/etc/init.d/uhttpd restart

echo "OUM LuCI development files installed. Run /usr/libexec/oum-firstboot when ready."
