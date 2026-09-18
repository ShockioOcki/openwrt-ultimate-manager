#!/bin/sh

set -eu

SOURCE_DIR="${1:-luci-app-oum}"
[ -d "$SOURCE_DIR" ] || { echo "Directory not found: $SOURCE_DIR" >&2; exit 1; }
REPO_DIR="$(CDPATH= cd -- "$SOURCE_DIR/.." && pwd)"
[ -f "$REPO_DIR/dist/oum-test.sh" ] || { echo "Build dist/oum-test.sh first" >&2; exit 1; }
[ -f "$REPO_DIR/helpers/source_converter.rb" ] || { echo "Converter source not found" >&2; exit 1; }

mkdir -p /etc/config /usr/share/luci/menu.d /usr/share/ucode/luci/controller /usr/share/rpcd/acl.d /usr/share/rpcd/ucode \
	/usr/libexec/oum /www/luci-static/resources/view/oum /www/luci-static/resources/oum /etc/init.d /etc/oum/support

[ -f /etc/config/oum ] || cp "$SOURCE_DIR/root/etc/config/oum" /etc/config/oum
mkdir -p /www/luci-static/oum-app /usr/share/ucode/luci/template/themes/oum-app
cp "$SOURCE_DIR/htdocs/luci-static/oum-app/"* /www/luci-static/oum-app/
cp "$SOURCE_DIR/htdocs/luci-static/resources/menu-oum-app.js" /www/luci-static/resources/menu-oum-app.js
for template in "$SOURCE_DIR/root/usr/share/ucode/luci/template/themes/oum-app/"*.ut; do
	cat "$template" > "/usr/share/ucode/luci/template/themes/oum-app/${template##*/}"
done
chmod 644 /www/luci-static/oum-app/* /www/luci-static/resources/menu-oum-app.js /usr/share/ucode/luci/template/themes/oum-app/*.ut
cp "$SOURCE_DIR/root/usr/share/luci/menu.d/luci-app-oum.json" /usr/share/luci/menu.d/luci-app-oum.json
cp "$SOURCE_DIR/root/usr/share/ucode/luci/controller/oum.uc" /usr/share/ucode/luci/controller/oum.uc
mkdir -p /usr/share/ucode/luci/template/oum
cp "$SOURCE_DIR/root/usr/share/ucode/luci/template/oum/"*.ut /usr/share/ucode/luci/template/oum/
cp "$SOURCE_DIR/root/usr/share/rpcd/acl.d/luci-app-oum.json" /usr/share/rpcd/acl.d/luci-app-oum.json
cp "$SOURCE_DIR/root/usr/share/rpcd/ucode/oum" /usr/share/rpcd/ucode/oum
cp "$SOURCE_DIR/root/usr/libexec/oum-firstboot" /usr/libexec/oum-firstboot
cp "$SOURCE_DIR/root/usr/libexec/oum-source-job" /usr/libexec/oum-source-job
cp "$SOURCE_DIR/root/usr/libexec/oum-reset-first-run" /usr/libexec/oum-reset-first-run
cp "$SOURCE_DIR/root/usr/libexec/oum-mihomo-api" /usr/libexec/oum-mihomo-api
cp "$SOURCE_DIR/root/usr/libexec/oum-openclash-nodes" /usr/libexec/oum-openclash-nodes
cp "$SOURCE_DIR/root/usr/libexec/oum-passwall-nodes" /usr/libexec/oum-passwall-nodes
cp "$SOURCE_DIR/root/usr/libexec/oum-passwall-policy" /usr/libexec/oum-passwall-policy
cp "$SOURCE_DIR/root/usr/libexec/oum-passwall-source-job" /usr/libexec/oum-passwall-source-job
cp "$SOURCE_DIR/root/usr/libexec/oum-traffic" /usr/libexec/oum-traffic
cp "$SOURCE_DIR/root/usr/libexec/oum-passwall-geodata" /usr/libexec/oum-passwall-geodata
cp "$SOURCE_DIR/root/usr/libexec/oum-adguard" /usr/libexec/oum-adguard
cp "$SOURCE_DIR/root/usr/libexec/oum-passwall-route-check" /usr/libexec/oum-passwall-route-check
cp "$SOURCE_DIR/root/usr/libexec/oum-parental-cron" /usr/libexec/oum-parental-cron
cp "$SOURCE_DIR/root/usr/libexec/oum-passwall-bypass-russia" /usr/libexec/oum-passwall-bypass-russia
cp "$SOURCE_DIR/root/usr/libexec/oum-device-policy" /usr/libexec/oum-device-policy
cp "$SOURCE_DIR/root/usr/libexec/oum-policy-yaml.rb" /usr/libexec/oum-policy-yaml.rb
cp "$SOURCE_DIR/root/usr/libexec/oum-subscription-info" /usr/libexec/oum-subscription-info
cp "$SOURCE_DIR/root/usr/libexec/oum-backup" /usr/libexec/oum-backup
cp "$SOURCE_DIR/root/usr/libexec/oum-backup-codec.rb" /usr/libexec/oum-backup-codec.rb
cp "$SOURCE_DIR/root/usr/libexec/oum-reset-vpn" /usr/libexec/oum-reset-vpn
cp "$SOURCE_DIR/root/usr/libexec/oum-system-job" /usr/libexec/oum-system-job
cp "$SOURCE_DIR/root/usr/libexec/oum-engine-manager" /usr/libexec/oum-engine-manager
cp "$SOURCE_DIR/root/usr/libexec/oum-podkop-config" /usr/libexec/oum-podkop-config
cp "$SOURCE_DIR/root/usr/libexec/oum-awg-manager" /usr/libexec/oum-awg-manager
cp "$SOURCE_DIR/root/usr/libexec/oum-dns-manager" /usr/libexec/oum-dns-manager
cp "$SOURCE_DIR/root/usr/libexec/oum-mesh-manager" /usr/libexec/oum-mesh-manager
cp "$SOURCE_DIR/root/usr/libexec/oum-mesh-runtime" /usr/libexec/oum-mesh-runtime
cp "$SOURCE_DIR/root/usr/libexec/oum-usb-manager" /usr/libexec/oum-usb-manager
cp "$SOURCE_DIR/root/usr/libexec/oum-mobile-manager" /usr/libexec/oum-mobile-manager
cp "$SOURCE_DIR/root/usr/libexec/oum-media-organizer" /usr/libexec/oum-media-organizer
cp "$SOURCE_DIR/root/usr/libexec/oum-media-organizer-run" /usr/libexec/oum-media-organizer-run
cp "$SOURCE_DIR/root/usr/libexec/oum-project-manager" /usr/libexec/oum-project-manager
cp "$SOURCE_DIR/root/usr/libexec/oum-zapret-strategy" /usr/libexec/oum-zapret-strategy
cp "$SOURCE_DIR/root/usr/libexec/oum-zapret-quic" /usr/libexec/oum-zapret-quic
cp "$SOURCE_DIR/root/usr/libexec/oum-zapret-manager" /usr/libexec/oum-zapret-manager
cp "$SOURCE_DIR/root/usr/libexec/oum-login-default" /usr/libexec/oum-login-default
cp "$SOURCE_DIR/root/usr/libexec/oum-dropbear-blank-password" /usr/libexec/oum-dropbear-blank-password
cp "$SOURCE_DIR/root/usr/libexec/oum-gearup" /usr/libexec/oum-gearup
cp "$SOURCE_DIR/root/usr/libexec/oum-upstream-check" /usr/libexec/oum-upstream-check
cp "$SOURCE_DIR/root/usr/libexec/oum-support" /usr/libexec/oum-support
cp "$SOURCE_DIR/root/usr/libexec/oum-support-shell" /usr/libexec/oum-support-shell
cp "$SOURCE_DIR/root/usr/libexec/oum-support-repair-shell" /usr/libexec/oum-support-repair-shell
cp "$SOURCE_DIR/root/etc/oum/support/support_key.pub" /etc/oum/support/support_key.pub
cp "$SOURCE_DIR/root/etc/init.d/oum-support" /etc/init.d/oum-support
cp "$REPO_DIR/dist/oum-test.sh" /usr/libexec/oum-runtime.sh
cp "$REPO_DIR/helpers/source_converter.rb" /usr/libexec/oum/source_converter.rb
rm -f /www/luci-static/resources/view/oum/first-run.js \
	/www/luci-static/resources/view/oum/dashboard-v8.js \
	/www/luci-static/resources/view/oum/dashboard-v9.js \
	/www/luci-static/resources/view/oum/dashboard-v10.js \
	/www/luci-static/resources/view/oum/settings-v2.js \
	/www/luci-static/resources/view/oum/settings-v3.js
cp "$SOURCE_DIR/htdocs/luci-static/resources/view/oum/first-run-v4.js" /www/luci-static/resources/view/oum/first-run-v4.js
cp "$SOURCE_DIR/htdocs/luci-static/resources/view/oum/dashboard-v64.js" /www/luci-static/resources/view/oum/dashboard-v64.js
cp "$SOURCE_DIR/htdocs/luci-static/resources/view/oum/settings-v64.js" /www/luci-static/resources/view/oum/settings-v64.js
cp "$SOURCE_DIR/htdocs/luci-static/resources/view/oum/parental-v5.js" /www/luci-static/resources/view/oum/parental-v5.js
cp "$SOURCE_DIR/htdocs/luci-static/resources/view/oum/help-v5.js" /www/luci-static/resources/view/oum/help-v5.js
cp "$SOURCE_DIR/htdocs/luci-static/resources/view/oum/qrcode.min.js" /www/luci-static/resources/view/oum/qrcode.min.js
cp "$SOURCE_DIR/htdocs/luci-static/resources/view/oum/qrcode.min.js.LICENSE.txt" /www/luci-static/resources/view/oum/qrcode.min.js.LICENSE.txt
cp "$SOURCE_DIR/htdocs/luci-static/resources/oum/oum.css" /www/luci-static/resources/oum/oum.css
mkdir -p /www/luci-static/resources/oum/icons
cp "$SOURCE_DIR/htdocs/luci-static/resources/oum/icons/"*.svg /www/luci-static/resources/oum/icons/
chmod 644 /www/luci-static/resources/oum/icons/*.svg

chmod 755 /usr/libexec/oum-parental-cron
chmod 755 /usr/libexec/oum-passwall-route-check
chmod 755 /usr/libexec/oum-adguard
chmod 755 /usr/libexec/oum-passwall-geodata
chmod 755 /usr/libexec/oum-traffic
chmod 600 /etc/config/oum
chmod 755 /usr/libexec/oum-mobile-manager
chmod 755 /usr/libexec/oum-firstboot /usr/libexec/oum-source-job /usr/libexec/oum-reset-first-run \
		/usr/libexec/oum-mihomo-api /usr/libexec/oum-openclash-nodes /usr/libexec/oum-passwall-nodes /usr/libexec/oum-passwall-policy /usr/libexec/oum-device-policy /usr/libexec/oum-policy-yaml.rb \
	/usr/libexec/oum-passwall-source-job /usr/libexec/oum-passwall-bypass-russia \
	/usr/libexec/oum-subscription-info \
	/usr/libexec/oum-backup /usr/libexec/oum-backup-codec.rb /usr/libexec/oum-reset-vpn \
	/usr/libexec/oum-system-job \
	/usr/libexec/oum-engine-manager \
	/usr/libexec/oum-podkop-config \
		/usr/libexec/oum-awg-manager \
		/usr/libexec/oum-dns-manager \
		/usr/libexec/oum-mesh-manager \
		/usr/libexec/oum-mesh-runtime \
		/usr/libexec/oum-usb-manager \
		/usr/libexec/oum-media-organizer /usr/libexec/oum-media-organizer-run \
		/usr/libexec/oum-project-manager \
	/usr/libexec/oum-zapret-strategy \
	/usr/libexec/oum-zapret-quic \
	/usr/libexec/oum-zapret-manager \
	/usr/libexec/oum-login-default \
	/usr/libexec/oum-dropbear-blank-password \
	/usr/libexec/oum-gearup \
	/usr/libexec/oum-upstream-check \
	/usr/libexec/oum-support /usr/libexec/oum-support-shell /usr/libexec/oum-support-repair-shell /etc/init.d/oum-support \
	/usr/libexec/oum-runtime.sh
chmod 700 /etc/oum/support
chmod 644 /etc/oum/support/support_key.pub
chmod 600 /usr/libexec/oum/source_converter.rb
mkdir -p /usr/share/oum
cp -R "$SOURCE_DIR/root/usr/share/oum/routing" /usr/share/oum/
cp "$SOURCE_DIR/root/usr/share/oum/zapret-youtube-strategies" /usr/share/oum/zapret-youtube-strategies
cp "$SOURCE_DIR/root/usr/share/oum/proton2025.defaults" /usr/share/oum/proton2025.defaults
rm -rf /usr/share/oum/packages
cp -R "$SOURCE_DIR/root/usr/share/oum/packages" /usr/share/oum/packages
chmod 644 /usr/share/oum/zapret-youtube-strategies
find /usr/share/oum/packages -type f -exec chmod 600 {} \;
chmod 644 /usr/share/luci/menu.d/luci-app-oum.json /usr/share/ucode/luci/controller/oum.uc /usr/share/rpcd/acl.d/luci-app-oum.json \
	/usr/share/rpcd/ucode/oum /www/luci-static/resources/view/oum/first-run-v4.js \
	/www/luci-static/resources/view/oum/dashboard-v64.js /www/luci-static/resources/view/oum/settings-v64.js \
	/www/luci-static/resources/view/oum/parental-v5.js /www/luci-static/resources/view/oum/help-v5.js \
	/www/luci-static/resources/view/oum/qrcode.min.js /www/luci-static/resources/view/oum/qrcode.min.js.LICENSE.txt \
	/www/luci-static/resources/oum/oum.css

rm -f /tmp/luci-indexcache /tmp/luci-modulecache/* 2>/dev/null || true
# LuCI derives its browser module version from the package database mtime.
# Development copies do not change that database, so bump only its timestamp.
if [ -e /lib/apk/db/installed ]; then
	touch /lib/apk/db/installed 2>/dev/null || true
elif [ -e /usr/lib/opkg/status ]; then
	touch /usr/lib/opkg/status 2>/dev/null || true
fi
# Install the scheduled parental control task without running first-boot setup.
sh "$SOURCE_DIR/root/etc/uci-defaults/94_oum_parental"
/usr/libexec/oum-login-default
/etc/init.d/oum-support enable >/dev/null 2>&1 || true
/usr/libexec/oum-support cleanup-boot >/dev/null 2>&1 || true
/etc/init.d/rpcd restart
/etc/init.d/uhttpd restart

echo "OUM LuCI development files installed. Run /usr/libexec/oum-firstboot when ready."
