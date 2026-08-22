oum_wifi_interfaces() {
    uci -q show wireless 2>/dev/null | sed -n "s/^wireless\.\([^.=]*\)=wifi-iface$/\1/p"
}

oum_wifi_setup() {
    oum_header
    printf 'Новое имя Wi-Fi (SSID): '
    IFS= read -r ssid
    [ -n "$ssid" ] || { oum_warn "SSID не изменён"; return; }
    password="$(oum_read_secret 'Новый пароль Wi-Fi (минимум 8 символов): ')"
    if [ "${#password}" -lt 8 ]; then
        unset password
        oum_err "Пароль WPA должен содержать минимум 8 символов"
        return 1
    fi
    interfaces="$(oum_wifi_interfaces)"
    [ -n "$interfaces" ] || { unset password; oum_err "Wi-Fi интерфейсы не найдены"; return 1; }
    oum_backup_system || { unset password; return 1; }
    for interface in $interfaces; do
        mode="$(uci -q get "wireless.${interface}.mode")"
        [ "$mode" = "ap" ] || continue
        uci set "wireless.${interface}.ssid=$ssid"
        uci set "wireless.${interface}.encryption=sae-mixed"
        uci set "wireless.${interface}.key=$password"
    done
    unset password
    uci commit wireless
    wifi reload
    oum_ok "SSID и пароль применены ко всем точкам доступа"
}

oum_network_menu() {
    while true; do
        oum_header
        printf '%s\n' \
            "=== Wi-Fi и локальная сеть ===" \
            "1) Изменить SSID и пароль Wi-Fi" \
            "2) Показать LAN IP" \
            "" \
            "Enter — Назад"
        printf 'Выбор: '
        IFS= read -r choice
        case "$choice" in
            "") break ;;
            1) oum_wifi_setup; oum_pause ;;
            2) printf 'LAN IP: %s\n' "$(uci -q get network.lan.ipaddr || echo 'не задан')"; oum_pause ;;
            *) oum_err "Неверный выбор"; oum_pause ;;
        esac
    done
}
