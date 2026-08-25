#!/bin/sh
set -eu

OUM_INSTALLER_VERSION='@OUM_INSTALLER_VERSION@'
OUM_PAYLOAD_SHA256='@OUM_PAYLOAD_SHA256@'
OUM_PAYLOAD_SIZE='@OUM_PAYLOAD_SIZE@'

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

oum_install_package() {
	oum_backup_current
	mkdir -p "$OUM_INSTALL_TMP/package"
	tar -xzf "$payload" -C "$OUM_INSTALL_TMP/package" || oum_die 'cannot unpack payload'
	[ -x "$OUM_INSTALL_TMP/package/tools/install-luci-dev.sh" ] || oum_die 'invalid payload: installer missing'

	sh "$OUM_INSTALL_TMP/package/tools/install-luci-dev.sh" \
		"$OUM_INSTALL_TMP/package/luci-app-oum" || oum_die 'installation failed; backup was preserved'

	printf '\nOUM %s успешно установлен.\n' "$OUM_INSTALLER_VERSION"
	printf 'Панель: /cgi-bin/luci/oum\n'
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
	printf 'Подключитесь к Wi-Fi FirstRun (пароль: admin123) и откройте 192.168.1.1.\n'
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
[ -x /etc/init.d/rpcd ] || oum_die 'rpcd is not installed'
[ -x /etc/init.d/uhttpd ] || oum_die 'uhttpd is not installed'

case "${1:-}" in
	--install) oum_install_package ;;
	--first-run) oum_first_run ;;
	'') oum_menu ;;
	*) oum_die 'unknown option (use --check, --install or --first-run)' ;;
esac

exit 0

__OUM_PAYLOAD_BELOW__
