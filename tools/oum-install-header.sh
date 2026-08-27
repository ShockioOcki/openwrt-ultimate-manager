#!/bin/sh
set -eu

OUM_INSTALLER_VERSION='@OUM_INSTALLER_VERSION@'
OUM_PAYLOAD_SHA256='@OUM_PAYLOAD_SHA256@'
OUM_PAYLOAD_SIZE='@OUM_PAYLOAD_SIZE@'
OUM_BASE_PACKAGES='luci-base rpcd rpcd-mod-ucode uhttpd uhttpd-mod-ubus curl ca-bundle ruby ruby-yaml unzip jsonfilter nftables-json iw'

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
	tail -c "$OUM_PAYLOAD_SIZE" "$self" >"$destination" || oum_die 'cannot extract embedded payload'
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

oum_is_installed() {
	[ -x /usr/libexec/oum-firstboot ] && [ -f /usr/share/luci/menu.d/luci-app-oum.json ]
}

oum_install_base_packages() {
	missing=''
	for package in $OUM_BASE_PACKAGES; do
		apk info -e "$package" >/dev/null 2>&1 || missing="$missing $package"
	done
	[ -n "$missing" ] || return 0
	printf 'OUM installer: installing required packages:%s\n' "$missing"
	apk update || oum_die 'cannot update OpenWrt package index'
	apk add $missing || oum_die 'cannot install required OUM packages'
}

oum_install_package() {
	oum_install_base_packages
	oum_backup_current
	mkdir -p "$OUM_INSTALL_TMP/package"
	tar -xzf "$payload" -C "$OUM_INSTALL_TMP/package" || oum_die 'cannot unpack payload'
	[ -x "$OUM_INSTALL_TMP/package/tools/install-luci-dev.sh" ] || oum_die 'invalid payload: installer missing'

	sh "$OUM_INSTALL_TMP/package/tools/install-luci-dev.sh" \
		"$OUM_INSTALL_TMP/package/luci-app-oum" || oum_die 'installation failed; backup was preserved'
	if [ "${OUM_SKIP_AWG:-0}" = "1" ]; then
		printf 'OUM installer: skip AmneziaWG installation (OUM_SKIP_AWG=1)\n'
	else
		/usr/libexec/oum-awg-manager install || oum_die 'AmneziaWG package installation failed'
	fi
	mkdir -p /etc/oum
	printf '%s\n' "$OUM_INSTALLER_VERSION" > /etc/oum/version
	printf '%s\n' $OUM_BASE_PACKAGES > /etc/oum/base-packages
	chmod 600 /etc/oum/version /etc/oum/base-packages

	printf '\nOUM %s успешно установлен.\n' "$OUM_INSTALLER_VERSION"
	printf 'Панель: /cgi-bin/luci/oum\n'
	[ ! -f /etc/oum/reboot-required-awg ] || printf 'Для первичной активации AmneziaWG один раз перезапустите роутер.\n'
}

oum_confirm() {
	printf '%s [y/N]: ' "$1"
	IFS= read -r answer || return 1
	case "$answer" in
		y|Y|yes|YES|д|Д|да|ДА) return 0 ;;
		*) return 1 ;;
	esac
}

oum_first_run() {
	if ! oum_is_installed; then
		printf '\nСначала установите OUM, выбрав пункт 1.\n'
		return 0
	fi

	if [ "$(uci -q get oum.main.setup_complete || echo 0)" = '1' ]; then
		printf '\nПервичная настройка уже завершена.\n'
		printf 'Повторный запуск удалит текущий VPN-профиль, включит сеть FirstRun\n'
		printf 'и может оборвать текущее подключение к роутеру.\n'
		oum_confirm 'Запустить мастер заново?' || { printf 'Действие отменено.\n'; return 0; }
		/usr/libexec/oum-reset-first-run
	else
		printf '\nПервый запуск включит Wi-Fi сеть FirstRun и может оборвать текущее подключение.\n'
		oum_confirm 'Продолжить?' || { printf 'Действие отменено.\n'; return 0; }
		/usr/libexec/oum-firstboot
	fi

	printf '\nПервый запуск подготовлен.\n'
	printf 'Подключитесь к Wi-Fi FirstRun (пароль: admin123) и откройте 192.168.5.1.\n'
}

oum_print_menu() {
	if oum_is_installed; then
		installed='установлен'
	else
		installed='не установлен'
	fi

	printf '\n====================================================\n'
	printf '       OUM — OpenWrt Ultimate Manager\n'
	printf '====================================================\n'
	printf ' Сборка: %s · Состояние: %s\n' "$OUM_INSTALLER_VERSION" "$installed"
	printf '\n'
	printf ' 1) Установить / обновить OUM\n'
	printf ' 2) Первый запуск\n'
	printf ' 0) Выход\n'
	printf '\nВыбор: '
}

oum_menu() {
	while :; do
		oum_print_menu
		IFS= read -r choice || exit 0
		case "$choice" in
			1) oum_install_package ;;
			2) oum_first_run ;;
			0) printf 'Выход.\n'; exit 0 ;;
			*) printf '\nВведите 1, 2 или 0.\n' ;;
		esac
	done
}

oum_need awk
oum_need mktemp
oum_need sha256sum
oum_need tail
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
command -v apk >/dev/null 2>&1 || oum_die 'this build requires OpenWrt 25.12 with apk'

case "${1:-}" in
	--install) oum_install_package ;;
	--first-run) oum_first_run ;;
	'') oum_menu ;;
	*) oum_die 'unknown option (use --check, --install or --first-run)' ;;
esac

exit 0

__OUM_PAYLOAD_BELOW__
