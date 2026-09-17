#!/bin/sh
# Safe development deploy. Bootstrap is preserved and OUM is inactive by default.
set -eu

HOST="${1:-192.168.5.1}"
KEY="${2:-$HOME/.ssh/oum_router_ed25519}"
MODE="${3:-install-only}"
DIR="$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)"
REMOTE="root@$HOST"

SSH="ssh -i $KEY -o StrictHostKeyChecking=no"

printf 'Installing luci-theme-oum on %s (%s)\n' "$HOST" "$MODE"

$SSH "$REMOTE" '
set -eu
stamp="$(date +%Y%m%d-%H%M%S)"
backup="/etc/oum/rollback/theme-$stamp"
mkdir -p "$backup"
cp -a /etc/config/luci "$backup/luci" 2>/dev/null || true
[ ! -d /www/luci-static/oum ] || cp -a /www/luci-static/oum "$backup/static"
[ ! -d /usr/share/ucode/luci/template/themes/oum ] || cp -a /usr/share/ucode/luci/template/themes/oum "$backup/templates"
[ ! -f /www/luci-static/resources/menu-oum.js ] || cp -a /www/luci-static/resources/menu-oum.js "$backup/menu-oum.js"
printf "%s\n" "$backup" > /etc/oum/last-theme-backup
mkdir -p /www/luci-static/oum /www/luci-static/resources /usr/share/ucode/luci/template/themes/oum
'

tar -C "$DIR/htdocs" -cf - luci-static/oum luci-static/resources/menu-oum.js |
	$SSH "$REMOTE" 'tar -C /www -xf -'
tar -C "$DIR/ucode" -cf - template/themes/oum |
	$SSH "$REMOTE" 'tar -C /usr/share/ucode/luci -xf -'
tar -C "$DIR/root" -cf - etc/config/oum_theme etc/uci-defaults/30_luci-theme-oum usr/share/rpcd/acl.d/luci-theme-oum.json |
	$SSH "$REMOTE" 'tar -C / -xf -'

$SSH "$REMOTE" '
set -eu
chmod 0755 /etc/uci-defaults/30_luci-theme-oum
sh /etc/uci-defaults/30_luci-theme-oum
rm -f /tmp/luci-indexcache /tmp/luci-modulecache/* 2>/dev/null || true
/etc/init.d/rpcd restart
/etc/init.d/uhttpd reload || /etc/init.d/uhttpd restart
test -s /www/luci-static/oum/cascade.css
test -s /www/luci-static/oum/bootstrap-base.css
test -s /www/luci-static/resources/menu-oum.js
test -s /usr/share/ucode/luci/template/themes/oum/header.ut
'

if [ "$MODE" = "--activate" ]; then
	PREVIOUS="$($SSH "$REMOTE" "uci -q get luci.main.mediaurlbase || echo /luci-static/bootstrap")"
	$SSH "$REMOTE" "uci set luci.main.mediaurlbase=/luci-static/oum; uci commit luci; /etc/init.d/uhttpd reload || /etc/init.d/uhttpd restart"
	# Anonymous LuCI requests can legitimately return 403, so validate the
	# selected theme and its complete local asset/template contract instead.
	if ! $SSH "$REMOTE" "
		test \"\$(uci -q get luci.main.mediaurlbase)\" = /luci-static/oum &&
		test -s /www/luci-static/oum/cascade.css &&
		test -s /www/luci-static/oum/bootstrap-base.css &&
		test -s /www/luci-static/resources/menu-oum.js &&
		test -s /usr/share/ucode/luci/template/themes/oum/header.ut &&
		! grep -q 'dispatcher.node()' /usr/share/ucode/luci/template/themes/oum/header.ut
	"; then
		printf 'Theme activation validation failed; restoring %s\n' "$PREVIOUS" >&2
		$SSH "$REMOTE" "uci set luci.main.mediaurlbase='$PREVIOUS'; uci commit luci; /etc/init.d/uhttpd reload || /etc/init.d/uhttpd restart"
		exit 1
	fi
	printf 'Theme activated; previous theme: %s\n' "$PREVIOUS"
	printf 'Rollback: uci set luci.main.mediaurlbase=%s; uci commit luci; /etc/init.d/uhttpd reload\n' "$PREVIOUS"
else
	printf 'Theme installed but not selected. Activate with:\n'
	printf "  ssh -i %s root@%s 'uci set luci.main.mediaurlbase=/luci-static/oum; uci commit luci; /etc/init.d/uhttpd reload'\n" "$KEY" "$HOST"
fi
