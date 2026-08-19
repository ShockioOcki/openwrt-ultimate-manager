oum_provider_id() {
    prefix="$1"
    printf 'oum-%s-%s\n' "$prefix" "$(date +%Y%m%d%H%M%S)"
}

oum_deploy_converter() {
    converter="$OUM_TMP_DIR/source_converter.rb"
    oum_write_source_converter "$converter"
    chmod 700 "$converter"
    printf '%s\n' "$converter"
}

oum_apply_openclash_candidate() {
    candidate="$1"
    active="$2"
    core="$(oum_mihomo_core)" || { oum_err "Ядро Mihomo не найдено"; return 1; }
    oum_prepare_dirs
    backup="$OUM_BACKUP_DIR/openclash-$(date +%Y%m%d-%H%M%S).yaml"
    cp "$active" "$backup" || return 1
    chmod 600 "$backup"

    oum_info "Останавливаем OpenClash для проверки без второго ядра в памяти"
    /etc/init.d/openclash stop >/dev/null 2>&1 || true
    if ! "$core" -t -d "$OPENCLASH_DIR" -f "$candidate"; then
        /etc/init.d/openclash start >/dev/null 2>&1 || true
        oum_err "Mihomo отклонил новый конфиг; активный YAML не изменён"
        return 1
    fi
    cp "$candidate" "$active" || {
        cp "$backup" "$active"
        /etc/init.d/openclash start >/dev/null 2>&1 || true
        return 1
    }
    chmod 600 "$active"
    /etc/init.d/podkop stop >/dev/null 2>&1 || true
    /etc/init.d/podkop disable >/dev/null 2>&1 || true
    printf '%s\n' openclash > "$OUM_STATE_DIR/proxy_backend"
    /etc/init.d/openclash enable >/dev/null 2>&1 || true
    /etc/init.d/openclash start >/dev/null 2>&1 || true

    elapsed=0
    while [ "$elapsed" -lt 30 ]; do
        pgrep -f 'clash_meta|mihomo|/clash ' >/dev/null 2>&1 && {
            oum_ok "OpenClash запущен; бэкап: $backup"
            return 0
        }
        sleep 2
        elapsed=$((elapsed + 2))
    done
    oum_err "OpenClash не запустился; восстанавливаем предыдущий YAML"
    cp "$backup" "$active"
    /etc/init.d/openclash restart >/dev/null 2>&1 || true
    return 1
}

oum_save_standalone_config() {
    candidate="$1"
    source_kind="$2"
    core="$(oum_mihomo_core)" || { oum_err "Ядро Mihomo не найдено"; return 1; }
    case "$source_kind" in
        subscription) config_name="oum-subscription.yaml" ;;
        awg) config_name="oum-amnezia.yaml" ;;
        reality) config_name="oum-reality.yaml" ;;
        *) config_name="oum-source.yaml" ;;
    esac
    target="$OPENCLASH_DIR/config/$config_name"
    mkdir -p "$OPENCLASH_DIR/config"
    backup=""
    if [ -f "$target" ]; then
        backup="$OUM_BACKUP_DIR/${config_name%.yaml}-$(date +%Y%m%d-%H%M%S).yaml"
        cp "$target" "$backup"
    fi
    oum_info "Проверяем отдельный конфиг; OpenClash будет кратко остановлен"
    /etc/init.d/openclash stop >/dev/null 2>&1 || true
    if ! "$core" -t -d "$OPENCLASH_DIR" -f "$candidate"; then
        /etc/init.d/openclash start >/dev/null 2>&1 || true
        oum_err "Mihomo отклонил отдельный конфиг"
        return 1
    fi
    cp "$candidate" "$target" || {
        /etc/init.d/openclash start >/dev/null 2>&1 || true
        return 1
    }
    chmod 600 "$target"
    /etc/init.d/openclash start >/dev/null 2>&1 || true
    oum_ok "Создан $target"
    oum_info "Он появится в OpenClash → Config File. Активный конфиг не переключался."
    [ -n "$backup" ] && oum_info "Предыдущая версия: $backup"
}

oum_install_provider() {
    mode="$1"
    input="$2"
    provider_id="$3"
    display_name="$4"
    source_kind="$5"
    oum_require_runtime || return 1
    active="$(oum_openclash_config)" || { oum_err "Активный OpenClash YAML не найден"; return 1; }
    converter="$(oum_deploy_converter)" || return 1
    mkdir -p "$OPENCLASH_DIR/proxy_provider"
    provider_tmp="$OUM_TMP_DIR/${provider_id}.yaml"
    provider_final="$OPENCLASH_DIR/proxy_provider/${provider_id}.yaml"
    candidate="$OUM_TMP_DIR/openclash-candidate.yaml"

    case "$mode" in
        awg) ruby "$converter" awg "$input" "$provider_tmp" "$display_name" || return 1 ;;
        uris) ruby "$converter" uris "$input" "$provider_tmp" || return 1 ;;
        subscription) ruby "$converter" subscription "$input" "$provider_tmp" || return 1 ;;
        *) oum_err "Неизвестный тип источника"; return 1 ;;
    esac
    chmod 600 "$provider_tmp"
    provider_backup=""
    if [ -f "$provider_final" ]; then
        provider_backup="$OUM_BACKUP_DIR/${provider_id}-$(date +%Y%m%d-%H%M%S).yaml"
        cp "$provider_final" "$provider_backup"
    fi
    cp "$provider_tmp" "$provider_final" || return 1
    chmod 600 "$provider_final"
    relative_path="./proxy_provider/${provider_id}.yaml"
    printf '%s\n' \
        "Как подключить источник?" \
        "1) Отдельный Config File (рекомендуется)" \
        "2) Добавить в активный объединённый конфиг"
    printf 'Выбор [1]: '
    IFS= read -r config_mode
    [ -n "$config_mode" ] || config_mode=1
    case "$config_mode" in
        1)
            if ! ruby "$converter" standalone "$active" "$candidate" "$provider_tmp" "$source_kind" || ! oum_save_standalone_config "$candidate" "$source_kind"; then
                if [ -n "$provider_backup" ]; then cp "$provider_backup" "$provider_final"; else rm -f "$provider_final"; fi
                return 1
            fi
            # A standalone Config File contains its nodes inline and must not
            # depend on a second file that OpenClash may clean up while switching.
            rm -f "$provider_final"
            ;;
        2)
            if ! ruby "$converter" attach "$active" "$candidate" "$provider_id" "$relative_path" "$source_kind" || ! oum_apply_openclash_candidate "$candidate" "$active"; then
                if [ -n "$provider_backup" ]; then cp "$provider_backup" "$provider_final"; else rm -f "$provider_final"; fi
                return 1
            fi
            case "$source_kind" in
                subscription) group_name="SUBSCRIPTION" ;;
                awg) group_name="AMNEZIA" ;;
                reality) group_name="REALITY" ;;
                *) group_name="OUM-SOURCES" ;;
            esac
            oum_ok "Источник добавлен в группу $group_name"
            ;;
        *)
            if [ -n "$provider_backup" ]; then cp "$provider_backup" "$provider_final"; else rm -f "$provider_final"; fi
            oum_err "Неверный режим"
            return 1
            ;;
    esac
    oum_log "provider installed id=$provider_id type=$source_kind mode=$config_mode"
}

oum_import_subscription() {
    oum_header
    oum_prepare_dirs
    url="$(oum_read_secret 'URL подписки (ввод скрыт): ')"
    [ -n "$url" ] || { oum_warn "Отменено"; return; }
    case "$url" in http://*|https://*) ;; *) unset url; oum_err "Нужен URL http(s)"; return 1 ;; esac
    input="$OUM_TMP_DIR/subscription.input"
    if ! oum_download "$url" "$input"; then
        unset url
        oum_err "Не удалось загрузить подписку"
        return 1
    fi
    unset url
    chmod 600 "$input"
    provider_id="$(oum_provider_id subscription)"
    oum_install_provider subscription "$input" "$provider_id" "" subscription
}

oum_import_uri_text() {
    oum_header
    oum_prepare_dirs
    oum_info "Вставьте одну или несколько ссылок VLESS/Hysteria2"
    oum_info "После последней строки введите одну точку: ."
    input="$OUM_TMP_DIR/uris.input"
    : > "$input"
    chmod 600 "$input"
    while IFS= read -r line; do
        [ "$line" = "." ] && break
        printf '%s\n' "$line" >> "$input"
    done
    [ -s "$input" ] || { oum_warn "Ничего не введено"; return; }
    provider_id="$(oum_provider_id manual)"
    oum_install_provider uris "$input" "$provider_id" "" reality
}

oum_import_awg_file() {
    oum_header
    printf 'Путь к AWG .conf: '
    IFS= read -r input
    [ -f "$input" ] || { oum_err "Файл не найден"; return 1; }
    printf 'Название ноды [OUM-AWG]: '
    IFS= read -r display_name
    [ -n "$display_name" ] || display_name="OUM-AWG"
    provider_id="$(oum_provider_id awg)"
    oum_install_provider awg "$input" "$provider_id" "$display_name" awg
}

oum_import_awg_text() {
    oum_header
    oum_prepare_dirs
    oum_info "Вставьте AWG-конфиг целиком; после него введите одну точку: ."
    input="$OUM_TMP_DIR/awg.input"
    : > "$input"
    chmod 600 "$input"
    while IFS= read -r line; do
        [ "$line" = "." ] && break
        printf '%s\n' "$line" >> "$input"
    done
    [ -s "$input" ] || { oum_warn "Ничего не введено"; return; }
    printf 'Название ноды [OUM-AWG]: '
    IFS= read -r display_name
    [ -n "$display_name" ] || display_name="OUM-AWG"
    provider_id="$(oum_provider_id awg)"
    oum_install_provider awg "$input" "$provider_id" "$display_name" awg
}

oum_list_sources() {
    oum_header
    oum_info "Локальные OUM providers (содержимое и ключи скрыты):"
    found=0
    for provider in "$OPENCLASH_DIR"/proxy_provider/oum-*.yaml; do
        [ -f "$provider" ] || continue
        found=1
        printf ' • %s\n' "$(basename "$provider")"
    done
    [ "$found" -eq 1 ] || printf 'Пока нет источников.\n'
    printf '\nОтдельные Config Files:\n'
    found=0
    for config_file in "$OPENCLASH_DIR"/config/oum-*.yaml; do
        [ -f "$config_file" ] || continue
        found=1
        printf ' • %s\n' "$(basename "$config_file")"
    done
    [ "$found" -eq 1 ] || printf 'Пока нет отдельных конфигов.\n'
}

oum_sources_menu() {
    while true; do
        oum_header
        printf '%s\n' \
            "=== Подключения и ноды ===" \
            "1) Добавить подписку URL" \
            "2) Вставить VLESS/Hysteria2 ссылку" \
            "3) Вставить AWG-конфиг" \
            "4) Импортировать AWG из файла (расширенный вариант)" \
            "5) Показать источники и Config Files" \
            "" \
            "Enter — Назад"
        printf 'Выбор: '
        IFS= read -r choice
        case "$choice" in
            "") break ;;
            1) oum_import_subscription; oum_pause ;;
            2) oum_import_uri_text; oum_pause ;;
            3) oum_import_awg_text; oum_pause ;;
            4) oum_import_awg_file; oum_pause ;;
            5) oum_list_sources; oum_pause ;;
            *) oum_err "Неверный выбор"; oum_pause ;;
        esac
    done
}
