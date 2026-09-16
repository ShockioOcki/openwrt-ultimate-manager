#!/bin/sh
set -eu

OUM_INSTALLER_VERSION='@OUM_INSTALLER_VERSION@'
OUM_PAYLOAD_SHA256='@OUM_PAYLOAD_SHA256@'
OUM_PAYLOAD_SIZE='@OUM_PAYLOAD_SIZE@'
OUM_BASE_PACKAGES='luci-base luci-mod-admin-full luci-app-firewall luci-app-package-manager luci-proto-ppp luci-proto-ipv6 luci-lib-uqr luci-i18n-base-ru luci-i18n-firewall-ru luci-i18n-package-manager-ru rpcd rpcd-mod-ucode rpcd-mod-file rpcd-mod-iwinfo rpcd-mod-luci uhttpd uhttpd-mod-ubus curl ca-bundle openssh-client ruby ruby-yaml unzip jsonfilter nftables-json iw iwinfo ip-full ppp ppp-mod-pppoe firewall4'

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
		/etc/config/luci \
		/etc/config/oum \
		/usr/share/luci/menu.d/luci-app-oum.json \
		/usr/share/ucode/luci/controller/oum.uc \
		/usr/share/rpcd/acl.d/luci-app-oum.json \
		/usr/share/rpcd/ucode/oum \
		/usr/libexec/oum \
		/usr/libexec/oum-* \
		/usr/share/oum \
		/www/luci-static/resources/view/oum \
		/etc/config/oum_theme \
		/usr/share/ucode/luci/template/themes/oum \
		/usr/share/rpcd/acl.d/luci-theme-oum.json \
		/www/luci-static/oum \
		/www/luci-static/resources/menu-oum.js
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

# Detect the enabled controller even before its kernel driver is installed.
# USB applications remain opt-in; only the detected controller belongs to base setup.
oum_usb_controller_packages() {
 tree="${OUM_DEVICE_TREE:-/sys/firmware/devicetree/base}"
 [ -d "$tree" ] || return 0
 find "$tree" -name compatible -type f | while IFS= read -r file; do
  case "$(tr '\000' '\n' < "$file")" in
   *mediatek,mtk-xhci*) ;;
   *) continue ;;
  esac
  node="${file%/compatible}"
  enabled=1
  while [ "$node" != "$tree" ] && [ "$node" != / ]; do
   if [ -f "$node/status" ]; then
    case "$(tr -d '\000' < "$node/status")" in okay|ok) ;; *) enabled=0; break ;; esac
   fi
   node="${node%/*}"
  done
  [ "$enabled" = 1 ] || continue
  printf '%s\n' kmod-usb3 kmod-usb-xhci-mtk
 done | sort -u
}

oum_platform_preflight() {
 . /etc/openwrt_release
 case "${DISTRIB_RELEASE:-}" in 25.12.*) ;; *) oum_die 'OUM 0.0.1 requires OpenWrt 25.12; other releases are not validated' ;; esac
 free_kb="$(df -Pk /overlay | awk 'NR == 2 { print $4 }')"
 [ "${free_kb:-0}" -ge 8192 ] || oum_die 'at least 8 MiB free overlay space is required; export old backups first'
 tmp_kb="$(df -Pk /tmp | awk 'NR == 2 { print $4 }')"
 [ "${tmp_kb:-0}" -ge 16384 ] || oum_die 'at least 16 MiB temporary memory is required'
 OUM_PLATFORM_PACKAGES=''
 if [ -r /sys/firmware/devicetree/base/compatible ]; then
  compatible="$(tr '\000' '\n' < /sys/firmware/devicetree/base/compatible)"
  case "$compatible" in
   *mediatek,mt7981*) OUM_PLATFORM_PACKAGES='kmod-mt7915e kmod-mt7981-firmware mt7981-wo-firmware' ;;
   *mediatek,mt7986*) OUM_PLATFORM_PACKAGES='kmod-mt7915e kmod-mt7986-firmware mt7986-wo-firmware' ;;
  esac
 fi
 OUM_USB_PACKAGES="$(oum_usb_controller_packages)"
 if [ -n "$OUM_USB_PACKAGES" ]; then
  printf 'OUM USB: controller detected; storage and applications install when configured\n'
 else
  printf 'OUM USB: no supported controller detected; no USB packages requested\n'
 fi
 printf 'OUM platform: %s / %s / %s; kernel %s\n' "${DISTRIB_TARGET:-unknown}" "${DISTRIB_ARCH:-unknown}" "${DISTRIB_RELEASE:-unknown}" "$(uname -r)"
 # apk resolves the kernel ABI from this firmware's signed feeds; never force kmods.
}

oum_install_base_packages() {
	missing=''
	# Preserve dnsmasq-full: installing dnsmasq alongside it causes a conflict.
 if ! apk info -e dnsmasq >/dev/null 2>&1 && ! apk info -e dnsmasq-full >/dev/null 2>&1; then
  missing="$missing dnsmasq"
 fi
 for package in $OUM_BASE_PACKAGES ${OUM_PLATFORM_PACKAGES:-} ${OUM_USB_PACKAGES:-}; do
		apk info -e "$package" >/dev/null 2>&1 || missing="$missing $package"
	done
	[ -n "$missing" ] || return 0
	printf 'OUM installer: installing required packages:%s\n' "$missing"
	apk update || oum_die 'cannot update OpenWrt package index'
	apk add $missing || oum_die 'cannot install required OUM packages'
}

oum_install_package() {
	oum_platform_preflight
	oum_backup_current
	oum_install_base_packages
	mkdir -p "$OUM_INSTALL_TMP/package"
	tar -xzf "$payload" -C "$OUM_INSTALL_TMP/package" || oum_die 'cannot unpack payload'
	[ -x "$OUM_INSTALL_TMP/package/tools/install-luci-dev.sh" ] || oum_die 'invalid payload: installer missing'

	sh "$OUM_INSTALL_TMP/package/tools/install-luci-dev.sh" \
		"$OUM_INSTALL_TMP/package/luci-app-oum" || oum_die 'installation failed; backup was preserved'
	sh "$OUM_INSTALL_TMP/package/tools/install-theme-dev.sh" \
		"$OUM_INSTALL_TMP/package/luci-theme-oum" || oum_die 'system theme installation failed; backup was preserved'
	# VPN components are installed on demand.
	uci -q set luci.main.lang='ru'
	uci -q commit luci
	mkdir -p /etc/oum
	printf '%s\n' "$OUM_INSTALLER_VERSION" > /etc/oum/version
	printf '%s\n' $OUM_BASE_PACKAGES ${OUM_PLATFORM_PACKAGES:-} ${OUM_USB_PACKAGES:-} > /etc/oum/base-packages
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
