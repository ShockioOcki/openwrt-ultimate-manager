#!/bin/sh
# Enable flow offloading and the Zapret compatibility fix as one transaction.
set -eu
umask 077

hardware=0
if [ -r /sys/firmware/devicetree/base/compatible ]; then
	case "$(tr '\000' '\n' < /sys/firmware/devicetree/base/compatible)" in
		*mediatek,mt7621*|*mediatek,mt7622*|*mediatek,mt7981*|*mediatek,mt7986*|*mediatek,mt7988*) hardware=1 ;;
	esac
fi

# Never commit or discard settings being edited in LuCI or another UCI client.
pending="$(uci changes firewall)"
[ -z "$pending" ] || { echo 'Сначала примените или отмените несохранённые изменения firewall.' >&2; exit 1; }
[ "$(uci -q get 'firewall.@defaults[0]')" = defaults ] || { echo 'Секция defaults firewall не найдена.' >&2; exit 1; }

config=/etc/config/firewall
template=/usr/share/firewall4/templates/ruleset.uc
fixed='meta l4proto { tcp, udp } ct original packets ge 30 flow offload @ft;'
if [ "$(uci -q get 'firewall.@defaults[0].flow_offloading' || true)" = 1 ] &&
	[ "$(uci -q get 'firewall.@defaults[0].flow_offloading_hw' || true)" = "$hardware" ] &&
	grep -Fq "$fixed" "$template"; then
	echo "OUM: ускорение уже настроено (hardware=$hardware), FIX Zapret применён."
	exit 0
fi

backup="$(mktemp -d /etc/oum/rollback/offloading-install.XXXXXX)"
cp -p "$config" "$backup/firewall"
cp -p "$template" "$backup/ruleset.uc"
changed=0
cleanup() {
	result=$?
	trap - EXIT HUP INT TERM
	if [ "$changed" = 1 ]; then
		uci -q revert firewall || true
		cp -p "$backup/firewall" "$config"
		cp -p "$backup/ruleset.uc" "$template"
		if ! fw4 reload >> "$backup/check.log" 2>&1; then
			echo "Не удалось перезагрузить восстановленный firewall; резерв: $backup" >&2
		fi
		echo "Настройка ускорения не завершена; исходные файлы восстановлены из $backup." >&2
	fi
	exit "$result"
}
trap cleanup EXIT
trap 'exit 1' HUP INT TERM
changed=1
uci set 'firewall.@defaults[0].flow_offloading=1'
uci set "firewall.@defaults[0].flow_offloading_hw=$hardware"
uci commit firewall
# The manager validates the patched ruleset and rolls it back on reload failure.
# If already patched, it returns without reloading, so validate/apply flags below.
/usr/libexec/oum-zapret-manager fix
fw4 check > "$backup/check.log" 2>&1
fw4 reload >> "$backup/check.log" 2>&1
changed=0
echo "OUM: программное ускорение включено, hardware=$hardware, FIX Zapret применён."
echo "OUM: резерв настроек ускорения: $backup"
