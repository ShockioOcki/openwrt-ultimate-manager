#!/bin/sh

set -eu

SOURCE_DIR="${1:-luci-theme-oum}"
[ -d "$SOURCE_DIR" ] || { echo "Directory not found: $SOURCE_DIR" >&2; exit 1; }

mkdir -p \
	/etc/config \
	/etc/oum \
	/usr/share/rpcd/acl.d \
	/usr/share/ucode/luci/template/themes/oum \
	/www/luci-static/oum/fonts \
	/www/luci-static/oum/icons \
	/www/luci-static/resources

# Preserve the user's previous system theme once, so recovery never depends
# on the OUM assets being renderable.
if [ ! -s /etc/oum/theme-previous-mediaurlbase ]; then
	uci -q get luci.main.mediaurlbase > /etc/oum/theme-previous-mediaurlbase || \
		printf '%s\n' '/luci-static/bootstrap' > /etc/oum/theme-previous-mediaurlbase
	chmod 600 /etc/oum/theme-previous-mediaurlbase
fi

cp "$SOURCE_DIR/htdocs/luci-static/oum/bootstrap-base.css" /www/luci-static/oum/bootstrap-base.css
cp "$SOURCE_DIR/htdocs/luci-static/oum/bootstrap-mobile.css" /www/luci-static/oum/bootstrap-mobile.css
cp "$SOURCE_DIR/htdocs/luci-static/oum/cascade.css" /www/luci-static/oum/cascade.css
cp "$SOURCE_DIR/htdocs/luci-static/oum/stock-layout.css" /www/luci-static/oum/stock-layout.css
cp "$SOURCE_DIR/htdocs/luci-static/oum/wireless-list.css" /www/luci-static/oum/wireless-list.css
cp "$SOURCE_DIR/htdocs/luci-static/oum/buttons.css" /www/luci-static/oum/buttons.css
cp "$SOURCE_DIR/htdocs/luci-static/oum/compact-inputs.css" /www/luci-static/oum/compact-inputs.css
cp "$SOURCE_DIR/htdocs/luci-static/oum/clients.css" /www/luci-static/oum/clients.css
cp "$SOURCE_DIR/htdocs/luci-static/oum/overview.css" /www/luci-static/oum/overview.css
cp "$SOURCE_DIR/htdocs/luci-static/oum/routes.css" /www/luci-static/oum/routes.css
cp "$SOURCE_DIR/htdocs/luci-static/oum/nftables.css" /www/luci-static/oum/nftables.css
cp "$SOURCE_DIR/htdocs/luci-static/oum/logs.css" /www/luci-static/oum/logs.css
cp "$SOURCE_DIR/htdocs/luci-static/oum/logs.js" /www/luci-static/oum/logs.js
cp "$SOURCE_DIR/htdocs/luci-static/oum/processes.css" /www/luci-static/oum/processes.css
cp "$SOURCE_DIR/htdocs/luci-static/oum/packages.css" /www/luci-static/oum/packages.css
cp "$SOURCE_DIR/htdocs/luci-static/oum/startup.css" /www/luci-static/oum/startup.css
cp "$SOURCE_DIR/htdocs/luci-static/oum/mounts.css" /www/luci-static/oum/mounts.css
cp "$SOURCE_DIR/htdocs/luci-static/oum/flash.css" /www/luci-static/oum/flash.css
cp "$SOURCE_DIR/htdocs/luci-static/oum/network-mobile.css" /www/luci-static/oum/network-mobile.css
cp "$SOURCE_DIR/htdocs/luci-static/oum/desktop-network.css" /www/luci-static/oum/desktop-network.css
cp "$SOURCE_DIR/htdocs/luci-static/oum/dhcp.css" /www/luci-static/oum/dhcp.css
cp "$SOURCE_DIR/htdocs/luci-static/oum/leases.js" /www/luci-static/oum/leases.js
cp "$SOURCE_DIR/htdocs/luci-static/oum/tabs.css" /www/luci-static/oum/tabs.css
cp "$SOURCE_DIR/htdocs/luci-static/oum/field-help.css" /www/luci-static/oum/field-help.css
cp "$SOURCE_DIR/htdocs/luci-static/oum/checkboxes.css" /www/luci-static/oum/checkboxes.css
cp "$SOURCE_DIR/htdocs/luci-static/oum/checkboxes.js" /www/luci-static/oum/checkboxes.js
cp "$SOURCE_DIR/htdocs/luci-static/oum/field-help.js" /www/luci-static/oum/field-help.js
cp "$SOURCE_DIR/htdocs/luci-static/oum/startup.js" /www/luci-static/oum/startup.js
cp "$SOURCE_DIR/htdocs/luci-static/oum/processes.js" /www/luci-static/oum/processes.js
cp "$SOURCE_DIR/htdocs/luci-static/oum/routes.js" /www/luci-static/oum/routes.js
cp "$SOURCE_DIR/htdocs/luci-static/oum/radios.css" /www/luci-static/oum/radios.css
cp "$SOURCE_DIR/htdocs/luci-static/oum/radios.js" /www/luci-static/oum/radios.js
cp "$SOURCE_DIR/htdocs/luci-static/oum/form-actions.js" /www/luci-static/oum/form-actions.js
cp "$SOURCE_DIR/htdocs/luci-static/oum/logo.svg" /www/luci-static/oum/logo.svg
cp "$SOURCE_DIR/htdocs/luci-static/oum/brand.svg" /www/luci-static/oum/brand.svg
cp "$SOURCE_DIR/htdocs/luci-static/oum/fonts/"* /www/luci-static/oum/fonts/
cp "$SOURCE_DIR/htdocs/luci-static/oum/icons/"*.svg /www/luci-static/oum/icons/
cp "$SOURCE_DIR/htdocs/luci-static/resources/menu-oum.js" /www/luci-static/resources/menu-oum.js
# Preserve existing inodes: replacing templates can fail on upgraded overlayfs.
for template in "$SOURCE_DIR/ucode/template/themes/oum/"*.ut; do
	cat "$template" > "/usr/share/ucode/luci/template/themes/oum/${template##*/}"
done
cp "$SOURCE_DIR/root/usr/share/rpcd/acl.d/luci-theme-oum.json" /usr/share/rpcd/acl.d/luci-theme-oum.json

[ -f /etc/config/oum_theme ] || cp "$SOURCE_DIR/root/etc/config/oum_theme" /etc/config/oum_theme
sh "$SOURCE_DIR/root/etc/uci-defaults/30_luci-theme-oum"

chmod 644 \
	/www/luci-static/oum/bootstrap-base.css \
	/www/luci-static/oum/bootstrap-mobile.css \
	/www/luci-static/oum/cascade.css \
	/www/luci-static/oum/stock-layout.css \
	/www/luci-static/oum/wireless-list.css \
	/www/luci-static/oum/buttons.css \
	/www/luci-static/oum/logo.svg \
	/www/luci-static/oum/brand.svg \
	/www/luci-static/oum/fonts/* \
	/www/luci-static/oum/icons/* \
	/www/luci-static/resources/menu-oum.js \
	/usr/share/ucode/luci/template/themes/oum/*.ut \
	/usr/share/rpcd/acl.d/luci-theme-oum.json

test -s /www/luci-static/oum/cascade.css
test -s /www/luci-static/resources/menu-oum.js
test -s /usr/share/ucode/luci/template/themes/oum/header.ut
! grep -q 'dispatcher.node()' /usr/share/ucode/luci/template/themes/oum/header.ut

uci set luci.main.mediaurlbase='/luci-static/oum'
uci commit luci

find /tmp -maxdepth 1 -name 'luci-indexcache*' -delete 2>/dev/null || true
find /tmp/luci-modulecache -mindepth 1 -delete 2>/dev/null || true
if [ -e /lib/apk/db/installed ]; then
	touch /lib/apk/db/installed 2>/dev/null || true
elif [ -e /usr/lib/opkg/status ]; then
	touch /usr/lib/opkg/status 2>/dev/null || true
fi
/etc/init.d/rpcd restart
/etc/init.d/uhttpd reload || /etc/init.d/uhttpd restart

echo "OUM system theme installed and activated."
echo "Fallback: uci set luci.main.mediaurlbase=/luci-static/bootstrap; uci commit luci; /etc/init.d/uhttpd reload"
