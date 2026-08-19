oum_diagnostics() {
    oum_header
    printf 'OUM: %s\n' "$OUM_VERSION"
    printf 'OpenWrt: %s\n' "$(. /etc/openwrt_release 2>/dev/null; printf '%s' "${DISTRIB_DESCRIPTION:-неизвестно}")"
    printf 'Пакетный менеджер: %s\n' "$(oum_pkg_manager 2>/dev/null || echo 'не найден')"
    config="$(oum_openclash_config 2>/dev/null || true)"
    core="$(oum_mihomo_core 2>/dev/null || true)"
    printf 'OpenClash YAML: %s\n' "${config:-не найден}"
    if [ -n "$core" ]; then
        "$core" -v 2>/dev/null | head -n 1
    else
        printf 'Mihomo: не найден\n'
    fi
    if pgrep -f 'clash_meta|mihomo|/clash ' >/dev/null 2>&1; then
        oum_ok "OpenClash работает"
    else
        oum_warn "OpenClash не запущен"
    fi
    printf '\nПамять:\n'
    free -m 2>/dev/null || true
    printf '\nХранилище:\n'
    df -h /overlay 2>/dev/null || true
    printf '\nOUM active source:\n'
    printf ' • %s\n' "$(sed -n '1p' "$OUM_STATE_DIR/active_source" 2>/dev/null || echo 'не настроен')"
    runtime=""
    for profile_name in Subscription.yaml AWG_Tunnel.yaml Proxy.yaml; do
        pgrep -f "/etc/openclash/$profile_name" >/dev/null 2>&1 && runtime="$profile_name"
    done
    printf ' • загружен ядром: %s\n' "${runtime:-не запущен}"
    printf '\nПоследние события OUM (без секретов):\n'
    tail -n 15 /var/log/oum/oum.log 2>/dev/null || printf 'Лог пока пуст.\n'
}

oum_validate_active_config() {
    config="$(oum_openclash_config)" || { oum_err "OpenClash YAML не найден"; return 1; }
    core="$(oum_mihomo_core)" || { oum_err "Mihomo не найден"; return 1; }
    /etc/init.d/openclash stop >/dev/null 2>&1 || true
    if "$core" -t -d "$OPENCLASH_DIR" -f "$config"; then
        oum_ok "Активная конфигурация корректна"
        result=0
    else
        oum_err "Активная конфигурация содержит ошибку"
        result=1
    fi
    /etc/init.d/openclash start >/dev/null 2>&1 || true
    return "$result"
}

oum_diagnostics_menu() {
    while true; do
        oum_header
        printf '%s\n' \
            "=== Диагностика и восстановление ===" \
            "1) Общий статус" \
            "2) Проверить активный YAML Mihomo" \
            "3) Создать системный бэкап" \
            "4) Перезапустить OpenClash" \
            "" \
            "Enter — Назад"
        printf 'Выбор: '
        IFS= read -r choice
        case "$choice" in
            "") break ;;
            1) oum_diagnostics; oum_pause ;;
            2) oum_validate_active_config; oum_pause ;;
            3) oum_backup_system; oum_pause ;;
            4) /etc/init.d/openclash restart; oum_pause ;;
            *) oum_err "Неверный выбор"; oum_pause ;;
        esac
    done
}
