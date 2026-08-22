oum_pkg_manager() {
    if command -v apk >/dev/null 2>&1; then
        printf '%s\n' apk
    elif command -v opkg >/dev/null 2>&1; then
        printf '%s\n' opkg
    else
        return 1
    fi
}

oum_pkg_installed() {
    pkg="$1"
    case "$(oum_pkg_manager 2>/dev/null)" in
        apk) apk info -e "$pkg" >/dev/null 2>&1 ;;
        opkg) opkg list-installed 2>/dev/null | grep -q "^${pkg} " ;;
        *) return 1 ;;
    esac
}

oum_require_runtime() {
    missing=""
    for command_name in ruby uci; do
        command -v "$command_name" >/dev/null 2>&1 || missing="$missing $command_name"
    done
    if [ -n "$missing" ]; then
        oum_err "Не найдены зависимости:$missing"
        oum_info "Для импортёров необходимы ruby и ruby-yaml"
        return 1
    fi
}

oum_openclash_config() {
    config_path="$(uci -q get openclash.config.config_path 2>/dev/null)"
    if [ -n "$config_path" ] && [ -f "$config_path" ]; then
        printf '%s\n' "$config_path"
        return 0
    fi
    for config_path in "$OPENCLASH_DIR"/config/*.yaml "$OPENCLASH_DIR"/config/*.yml; do
        [ -f "$config_path" ] && { printf '%s\n' "$config_path"; return 0; }
    done
    return 1
}

oum_mihomo_core() {
    for core in "$OPENCLASH_DIR/core/clash_meta" "$OPENCLASH_DIR/core/mihomo" "$OPENCLASH_DIR/core/clash"; do
        [ -x "$core" ] && { printf '%s\n' "$core"; return 0; }
    done
    return 1
}
