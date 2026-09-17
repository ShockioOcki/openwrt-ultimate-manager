#!/bin/sh
set -eu

# The app shell and Proton must be present before retiring the experimental theme.
test -s /usr/share/ucode/luci/template/themes/oum-app/header.ut
test -s /usr/share/ucode/luci/template/themes/proton2025/header.ut
[ "$(uci -q get luci.main.mediaurlbase)" = /luci-static/proton2025 ]
archive="/etc/oum/experimental/luci-theme-oum-$(date +%Y%m%d-%H%M%S)"
for path in /www/luci-static/oum /www/luci-static/resources/menu-oum.js \
 /www/luci-static/resources/oum-theme-ux.js /usr/share/ucode/luci/template/themes/oum \
 /usr/share/rpcd/acl.d/luci-theme-oum.json /etc/config/oum_theme; do
	[ -e "$path" ] || continue
	target="$archive$path"
	mkdir -p "${target%/*}"
	mv "$path" "$target"
done
uci -q delete luci.themes.OUM || true
uci commit luci
