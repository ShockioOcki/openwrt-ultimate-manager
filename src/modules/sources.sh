oum_deploy_converter() {
    converter="$OUM_TMP_DIR/source_converter.rb"
    oum_write_source_converter "$converter"
    chmod 700 "$converter"
    printf '%s\n' "$converter"
}

oum_profile_name() {
    case "$1" in
        subscription) printf '%s\n' 'Subscription.yaml' ;;
        awg) printf '%s\n' 'AWG_Tunnel.yaml' ;;
        reality) printf '%s\n' 'Proxy.yaml' ;;
        *) return 1 ;;
    esac
}

oum_managed_profiles() {
    printf '%s\n' \
        'Subscription.yaml' 'AWG_Tunnel.yaml' 'Proxy.yaml' \
        'oum-subscription.yaml' 'oum-amnezia.yaml' 'oum-reality.yaml' 'oum.yaml'
}

oum_clear_subscription_info() {
    uci -q delete openclash.oum_subscription_info >/dev/null 2>&1 || true
}

oum_set_subscription_info() {
    url="$1"
    oum_clear_subscription_info
    uci set openclash.oum_subscription_info='subscribe_info'
    uci set openclash.oum_subscription_info.name='Subscription'
    uci set "openclash.oum_subscription_info.url=$url"
}

oum_discard_source_transaction() {
    transaction="$1"
    [ -d "$transaction" ] || return 0
    find "$transaction" -type f -exec rm -f {} \; 2>/dev/null || true
    rmdir "$transaction/config" 2>/dev/null || true
    rmdir "$transaction" 2>/dev/null || true
}

oum_restore_source_transaction() {
    transaction="$1"
    was_running="$2"
    /etc/init.d/openclash stop >/dev/null 2>&1 || true
    for profile in $(oum_managed_profiles); do
        rm -f "$OPENCLASH_DIR/config/$profile" "$OPENCLASH_DIR/$profile"
    done
    if [ -d "$transaction/config" ]; then
        for saved in "$transaction"/config/*; do
            [ -f "$saved" ] && cp "$saved" "$OPENCLASH_DIR/config/$(basename "$saved")"
        done
    fi
    if [ -f "$transaction/openclash.uci" ]; then
        cp "$transaction/openclash.uci" /etc/config/openclash
    fi
    if [ "$was_running" = 1 ]; then
        /etc/init.d/openclash start >/dev/null 2>&1 || true
    fi
    oum_discard_source_transaction "$transaction"
}

oum_activate_single_profile() {
    candidate="$1"
    source_kind="$2"
    subscription_url="${3:-}"
    profile="$(oum_profile_name "$source_kind")" || return 1
    target="$OPENCLASH_DIR/config/$profile"
    core="$(oum_mihomo_core)" || { oum_err "Mihomo не найден"; return 1; }
    transaction="$OUM_BACKUP_DIR/source-switch-$(date +%Y%m%d-%H%M%S)"
    mkdir -p "$transaction/config" "$OPENCLASH_DIR/config"
    chmod 700 "$transaction" "$transaction/config"
    cp /etc/config/openclash "$transaction/openclash.uci" || return 1
    chmod 600 "$transaction/openclash.uci"
    for old_profile in $(oum_managed_profiles); do
        [ -f "$OPENCLASH_DIR/config/$old_profile" ] && cp "$OPENCLASH_DIR/config/$old_profile" "$transaction/config/$old_profile"
    done
    was_running=0
    pgrep -f 'clash_meta|mihomo|/clash ' >/dev/null 2>&1 && was_running=1

    oum_info "Останавливаем OpenClash и проверяем новый профиль"
    /etc/init.d/openclash stop >/dev/null 2>&1 || true
    if ! "$core" -t -d "$OPENCLASH_DIR" -f "$candidate"; then
        [ "$was_running" = 1 ] && /etc/init.d/openclash start >/dev/null 2>&1 || true
        oum_discard_source_transaction "$transaction"
        oum_err "Mihomo отклонил новый профиль; старый источник не изменён"
        return 1
    fi

    cp "$candidate" "$target" || {
        oum_restore_source_transaction "$transaction" "$was_running"
        return 1
    }
    chmod 600 "$target"
    uci set "openclash.config.config_path=$target"
    uci set openclash.config.enable='1'
    if [ "$source_kind" = subscription ]; then
        oum_set_subscription_info "$subscription_url"
    else
        oum_clear_subscription_info
    fi
    uci commit openclash
    chmod 600 /etc/config/openclash
    /etc/init.d/podkop stop >/dev/null 2>&1 || true
    /etc/init.d/podkop disable >/dev/null 2>&1 || true
    /etc/init.d/openclash enable >/dev/null 2>&1 || true
    /etc/init.d/openclash start >/dev/null 2>&1 || true

    elapsed=0
    started=0
    while [ "$elapsed" -lt 45 ]; do
        if pgrep -f "/etc/openclash/$profile" >/dev/null 2>&1; then
            started=1
            break
        fi
        sleep 2
        elapsed=$((elapsed + 2))
    done
    if [ "$started" -ne 1 ]; then
        oum_err "OpenClash не загрузил выбранный профиль; выполняем откат"
        oum_restore_source_transaction "$transaction" "$was_running"
        return 1
    fi

    for old_profile in $(oum_managed_profiles); do
        [ "$old_profile" = "$profile" ] && continue
        rm -f "$OPENCLASH_DIR/config/$old_profile" "$OPENCLASH_DIR/$old_profile"
    done
    for provider in "$OPENCLASH_DIR"/proxy_provider/oum-*.yaml; do
        [ -f "$provider" ] && rm -f "$provider"
    done
    printf '%s\n' "$source_kind" > "$OUM_STATE_DIR/active_source"
    printf '%s\n' "$target" > "$OUM_STATE_DIR/active_profile"
    chmod 600 "$OUM_STATE_DIR/active_source" "$OUM_STATE_DIR/active_profile"
    printf '%s\n' openclash > "$OUM_STATE_DIR/proxy_backend"
    chmod 600 "$OUM_STATE_DIR/proxy_backend"
    oum_discard_source_transaction "$transaction"
    oum_log "active source replaced type=$source_kind profile=$profile"
    oum_ok "$profile активирован; предыдущий OUM-источник удалён"
}

oum_install_source() {
    mode="$1"
    input="$2"
    display_name="$3"
    source_kind="$4"
    subscription_url="${5:-}"
    oum_ensure_openclash || return 1
    oum_require_runtime || return 1
    converter="$(oum_deploy_converter)" || return 1
    provider_tmp="$OUM_TMP_DIR/source.yaml"
    candidate="$OUM_TMP_DIR/profile.yaml"

    case "$mode" in
        awg) ruby "$converter" awg "$input" "$provider_tmp" "$display_name" || return 1 ;;
        uris) ruby "$converter" uris "$input" "$provider_tmp" || return 1 ;;
        subscription) ruby "$converter" subscription "$input" "$provider_tmp" || return 1 ;;
        *) oum_err "Неизвестный тип источника"; return 1 ;;
    esac
    chmod 600 "$provider_tmp"
    ruby "$converter" standalone "$candidate" "$provider_tmp" "$source_kind" || return 1
    chmod 600 "$candidate"
    oum_activate_single_profile "$candidate" "$source_kind" "$subscription_url"
}

oum_import_subscription() {
    oum_header
    oum_prepare_dirs
    oum_warn "Новый профиль Subscription полностью заменит текущий OUM-источник"
    url="$(oum_read_secret 'URL подписки (ввод скрыт): ')"
    [ -n "$url" ] || { oum_warn "Отменено"; return; }
    case "$url" in http://*|https://*) ;; *) unset url; oum_err "Нужен URL http(s)"; return 1 ;; esac
    input="$OUM_TMP_DIR/subscription.input"
    if ! oum_download "$url" "$input"; then
        unset url
        oum_err "Не удалось загрузить подписку"
        return 1
    fi
    chmod 600 "$input"
    oum_install_source subscription "$input" "" subscription "$url"
    result=$?
    unset url
    return "$result"
}

oum_import_uri_text() {
    oum_header
    oum_prepare_dirs
    oum_warn "Новый профиль Proxy полностью заменит текущий OUM-источник"
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
    oum_install_source uris "$input" "" reality
}

oum_import_awg_file() {
    oum_header
    oum_warn "Новый профиль AWG_Tunnel полностью заменит текущий OUM-источник"
    printf 'Путь к AWG .conf: '
    IFS= read -r input
    [ -f "$input" ] || { oum_err "Файл не найден"; return 1; }
    printf 'Название ноды [AWG_Node]: '
    IFS= read -r display_name
    [ -n "$display_name" ] || display_name="AWG_Node"
    oum_install_source awg "$input" "$display_name" awg
}

oum_import_awg_text() {
    oum_header
    oum_prepare_dirs
    oum_warn "Новый профиль AWG_Tunnel полностью заменит текущий OUM-источник"
    oum_info "Вставьте AWG-конфиг целиком; после него введите одну точку: ."
    input="$OUM_TMP_DIR/awg.input"
    : > "$input"
    chmod 600 "$input"
    while IFS= read -r line; do
        [ "$line" = "." ] && break
        printf '%s\n' "$line" >> "$input"
    done
    [ -s "$input" ] || { oum_warn "Ничего не введено"; return; }
    printf 'Название ноды [AWG_Node]: '
    IFS= read -r display_name
    [ -n "$display_name" ] || display_name="AWG_Node"
    oum_install_source awg "$input" "$display_name" awg
}

oum_show_active_source() {
    oum_header
    source_kind="$(sed -n '1p' "$OUM_STATE_DIR/active_source" 2>/dev/null)"
    profile="$(uci -q get openclash.config.config_path 2>/dev/null)"
    runtime=""
    for managed in Subscription.yaml AWG_Tunnel.yaml Proxy.yaml; do
        pgrep -f "/etc/openclash/$managed" >/dev/null 2>&1 && runtime="$managed"
    done
    printf 'Источник: %s\n' "${source_kind:-не настроен}"
    printf 'Выбранный профиль: %s\n' "${profile:-не настроен}"
    printf 'Загружен ядром: %s\n' "${runtime:-не запущен}"
    if [ -n "$profile" ] && [ "$(basename "$profile")" = "$runtime" ]; then
        oum_ok "Выбранный и запущенный профили совпадают"
    elif [ -n "$profile" ]; then
        oum_err "Выбранный профиль не совпадает с запущенным"
    fi
}

oum_sources_menu() {
    while true; do
        oum_header
        printf '%s\n' \
            "=== Единственное активное подключение ===" \
            "1) Subscription — добавить подписку URL" \
            "2) Proxy — вставить VLESS/Hysteria2/Reality" \
            "3) AWG_Tunnel — вставить конфиг" \
            "4) AWG_Tunnel — импортировать файл" \
            "5) Показать активный источник" \
            "" \
            "Добавление нового источника заменяет предыдущий." \
            "Enter — Назад"
        printf 'Выбор: '
        IFS= read -r choice
        case "$choice" in
            "") break ;;
            1) oum_import_subscription; oum_pause ;;
            2) oum_import_uri_text; oum_pause ;;
            3) oum_import_awg_text; oum_pause ;;
            4) oum_import_awg_file; oum_pause ;;
            5) oum_show_active_source; oum_pause ;;
            *) oum_err "Неверный выбор"; oum_pause ;;
        esac
    done
}
