#!/bin/sh
set -eu

OUM_INSTALLER_VERSION='@OUM_INSTALLER_VERSION@'
OUM_PAYLOAD_SHA256='@OUM_PAYLOAD_SHA256@'
OUM_PAYLOAD_MARKER='__OUM_PAYLOAD_BELOW__'

oum_die() {
	printf 'OUM installer: %s\n' "$*" >&2
	exit 1
}

oum_need() {
	command -v "$1" >/dev/null 2>&1 || oum_die "required command not found: $1"
}

oum_cleanup() {
	[ -z "${OUM_INSTALL_TMP:-}" ] || rm -rf "$OUM_INSTALL_TMP"
}

oum_extract_payload() {
	self="$1"
	destination="$2"
	awk -v marker="$OUM_PAYLOAD_MARKER" '
		found { print }
		$0 == marker { found = 1 }
	' "$self" | base64 -d >"$destination" || oum_die 'cannot decode embedded payload'
	actual="$(sha256sum "$destination" | awk '{ print $1 }')"
	[ "$actual" = "$OUM_PAYLOAD_SHA256" ] || oum_die 'payload checksum mismatch'
}

oum_backup_current() {
	backup_root='/etc/oum/install-backups'
	stamp="$(date +%Y%m%d-%H%M%S)"
	backup="$backup_root/before-$OUM_INSTALLER_VERSION-$stamp.tar.gz"
	mkdir -p "$backup_root"
	chmod 700 "$backup_root"

	set --
	for absolute in \
		/etc/config/oum \
		/usr/share/luci/menu.d/luci-app-oum.json \
		/usr/share/ucode/luci/controller/oum.uc \
		/usr/share/rpcd/acl.d/luci-app-oum.json \
		/usr/share/rpcd/ucode/oum \
		/usr/libexec/oum \
		/usr/libexec/oum-* \
		/usr/share/oum \
		/www/luci-static/resources/view/oum
	do
		[ -e "$absolute" ] || continue
		set -- "$@" "${absolute#/}"
	done

	if [ "$#" -eq 0 ]; then
		printf 'OUM installer: clean installation, no previous OUM files found\n'
		return 0
	fi

	tar -czf "$backup" -C / "$@" || oum_die 'cannot create backup'
	chmod 600 "$backup"
	printf 'OUM installer: backup saved to %s\n' "$backup"
}

oum_need awk
oum_need base64
oum_need mktemp
oum_need sha256sum
oum_need tar

self="$0"
[ -f "$self" ] || oum_die 'save the installer to a file before running it'
OUM_INSTALL_TMP="$(mktemp -d /tmp/oum-install.XXXXXX)" || oum_die 'cannot create temporary directory'
trap oum_cleanup EXIT INT TERM

payload="$OUM_INSTALL_TMP/payload.tar.gz"
oum_extract_payload "$self" "$payload"

if [ "${1:-}" = '--check' ]; then
	printf 'OUM installer: payload %s verified\n' "$OUM_INSTALLER_VERSION"
	exit 0
fi

[ "$(id -u)" = 0 ] || oum_die 'run this installer as root'
[ -f /etc/openwrt_release ] || oum_die 'this installer is intended for OpenWrt'
[ -x /etc/init.d/rpcd ] || oum_die 'rpcd is not installed'
[ -x /etc/init.d/uhttpd ] || oum_die 'uhttpd is not installed'

oum_backup_current
mkdir -p "$OUM_INSTALL_TMP/package"
tar -xzf "$payload" -C "$OUM_INSTALL_TMP/package" || oum_die 'cannot unpack payload'
[ -x "$OUM_INSTALL_TMP/package/tools/install-luci-dev.sh" ] || oum_die 'invalid payload: installer missing'

sh "$OUM_INSTALL_TMP/package/tools/install-luci-dev.sh" \
	"$OUM_INSTALL_TMP/package/luci-app-oum" || oum_die 'installation failed; backup was preserved'

printf '\nOUM %s installed successfully.\n' "$OUM_INSTALLER_VERSION"
printf 'Open /cgi-bin/luci/oum and refresh the page with Ctrl+F5.\n'
printf 'For a clean router, start FirstRun explicitly: /usr/libexec/oum-firstboot\n'
exit 0

__OUM_PAYLOAD_BELOW__
