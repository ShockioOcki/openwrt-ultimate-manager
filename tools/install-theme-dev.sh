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
cp "$SOURCE_DIR/htdocs/luci-static/oum/logo.svg" /www/luci-static/oum/logo.svg
cp "$SOURCE_DIR/htdocs/luci-static/oum/brand.svg" /www/luci-static/oum/brand.svg
cp "$SOURCE_DIR/htdocs/luci-static/oum/fonts/"* /www/luci-static/oum/fonts/
cp "$SOURCE_DIR/htdocs/luci-static/oum/icons/"*.svg /www/luci-static/oum/icons/
cp "$SOURCE_DIR/htdocs/luci-static/resources/menu-oum.js" /www/luci-static/resources/menu-oum.js
cp "$SOURCE_DIR/ucode/template/themes/oum/"*.ut /usr/share/ucode/luci/template/themes/oum/
cp "$SOURCE_DIR/root/usr/share/rpcd/acl.d/luci-theme-oum.json" /usr/share/rpcd/acl.d/luci-theme-oum.json

[ -f /etc/config/oum_theme ] || cp "$SOURCE_DIR/root/etc/config/oum_theme" /etc/config/oum_theme
sh "$SOURCE_DIR/root/etc/uci-defaults/30_luci-theme-oum"

chmod 644 \
	/www/luci-static/oum/bootstrap-base.css \
	/www/luci-static/oum/bootstrap-mobile.css \
	/www/luci-static/oum/cascade.css \
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
