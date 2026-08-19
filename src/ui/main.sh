oum_quick_setup() {
    while true; do
        oum_header
        printf '%s\n' \
            "=== Быстрая настройка ===" \
            "1) Настроить Wi-Fi" \
            "2) Добавить подключение или подписку" \
            "3) Проверить OpenClash" \
            "" \
            "Ключи вводятся только в момент добавления источника." \
            "Enter — Назад"
        printf 'Выбор: '
        IFS= read -r choice
        case "$choice" in
            "") break ;;
            1) oum_wifi_setup; oum_pause ;;
            2) oum_sources_menu ;;
            3) oum_validate_active_config; oum_pause ;;
            *) oum_err "Неверный выбор"; oum_pause ;;
        esac
    done
}

oum_routing_menu() {
    oum_header
    oum_info "Профиль массовой маршрутизации будет подключён следующим тестовым изменением."
    oum_info "Текущая версия отвечает только за безопасный импорт источников и нод."
    oum_pause
}

oum_services_menu() {
    oum_header
    oum_info "NAS, SQM, GearUP и остальные модули сохранены в scripts/."
    oum_info "Они будут подключаться после стабилизации OpenClash-ядра OUM."
    oum_pause
}

oum_advanced_menu() {
    oum_header
    printf 'Версия: %s\n' "$OUM_VERSION"
    printf 'State: %s\n' "$OUM_STATE_DIR"
    printf 'Backups: %s\n' "$OUM_BACKUP_DIR"
    printf 'OpenClash: %s\n' "$OPENCLASH_DIR"
    oum_warn "Это тестовая ветка. Не используйте постоянные ключи."
    oum_pause
}

oum_main_menu() {
    while true; do
        oum_header
        printf '%s\n' \
            "1) Быстрая настройка роутера" \
            "2) Подключения и ноды" \
            "3) Маршрутизация" \
            "4) Wi-Fi и локальная сеть" \
            "5) Дополнительные сервисы" \
            "6) Диагностика и восстановление" \
            "7) Расширенные настройки" \
            "" \
            "Enter — Выход"
        printf 'Выбор: '
        IFS= read -r choice
        case "$choice" in
            "") return 0 ;;
            1) oum_quick_setup ;;
            2) oum_sources_menu ;;
            3) oum_routing_menu ;;
            4) oum_network_menu ;;
            5) oum_services_menu ;;
            6) oum_diagnostics_menu ;;
            7) oum_advanced_menu ;;
            *) oum_err "Неверный выбор"; oum_pause ;;
        esac
    done
}

oum_check_root
oum_prepare_dirs
oum_main_menu
