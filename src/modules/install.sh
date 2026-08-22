OPENCLASH_VERSION="0.47.156"
OPENCLASH_APK_URL="https://github.com/vernesong/OpenClash/releases/download/v0.47.156/luci-app-openclash-0.47.156.apk"
OPENCLASH_APK_SHA256="1e4f330fc654e0270ac9cfa762af221335567d9b89388219890e8a7745b914ab"
OPENCLASH_IPK_URL="https://github.com/vernesong/OpenClash/releases/download/v0.47.156/luci-app-openclash_0.47.156_all.ipk"
OPENCLASH_IPK_SHA256="b5d48ef26cb6de2942c3573e27b74490d354c0cfadaf24afe748daf806434eed"
MIHOMO_VERSION="1.19.30"
MIHOMO_ARM64_URL="https://github.com/MetaCubeX/mihomo/releases/download/v1.19.30/mihomo-linux-arm64-v1.19.30.gz"
MIHOMO_ARM64_SHA256="58896873736d28628f66de3677c8654fa0f180662523148e136cff4f6e890069"

oum_verify_sha256() {
    file="$1"
    expected="$2"
    actual="$(sha256sum "$file" 2>/dev/null | awk '{print $1}')"
    [ "$actual" = "$expected" ] || {
        oum_err "Контрольная сумма загруженного файла не совпала"
        return 1
    }
}

oum_install_mihomo() {
    case "$(uname -m)" in
        aarch64|arm64) core_url="$MIHOMO_ARM64_URL"; core_sha="$MIHOMO_ARM64_SHA256" ;;
        *) oum_err "Для архитектуры $(uname -m) в тестовой версии нет закреплённого ядра"; return 1 ;;
    esac
    archive="$OUM_TMP_DIR/mihomo.gz"
    core_tmp="$OUM_TMP_DIR/clash_meta"
    oum_info "Загружаем Mihomo $MIHOMO_VERSION"
    oum_download "$core_url" "$archive" || { oum_err "Не удалось загрузить Mihomo"; return 1; }
    oum_verify_sha256 "$archive" "$core_sha" || return 1
    gzip -dc "$archive" > "$core_tmp" || return 1
    chmod 755 "$core_tmp"
    mkdir -p "$OPENCLASH_DIR/core"
    mv "$core_tmp" "$OPENCLASH_DIR/core/clash_meta"
    chmod 755 "$OPENCLASH_DIR/core/clash_meta"
    "$OPENCLASH_DIR/core/clash_meta" -v >/dev/null 2>&1 || {
        oum_err "Загруженное ядро Mihomo не запускается"
        return 1
    }
}

oum_install_openclash() {
    oum_header
    oum_prepare_dirs
    if oum_pkg_installed luci-app-openclash && oum_require_runtime && oum_mihomo_core >/dev/null 2>&1; then
        oum_ok "OpenClash, Ruby и Mihomo уже установлены"
        return 0
    fi

    oum_info "Первичная установка OpenClash $OPENCLASH_VERSION"
    case "$(oum_pkg_manager 2>/dev/null)" in
        apk)
            package_file="$OUM_TMP_DIR/openclash.apk"
            apk update || { oum_err "Не удалось обновить индекс пакетов"; return 1; }
            oum_download "$OPENCLASH_APK_URL" "$package_file" || return 1
            oum_verify_sha256 "$package_file" "$OPENCLASH_APK_SHA256" || return 1
            apk add --allow-untrusted "$package_file" || { oum_err "Не удалось установить OpenClash"; return 1; }
            ;;
        opkg)
            package_file="$OUM_TMP_DIR/openclash.ipk"
            opkg update || { oum_err "Не удалось обновить индекс пакетов"; return 1; }
            oum_download "$OPENCLASH_IPK_URL" "$package_file" || return 1
            oum_verify_sha256 "$package_file" "$OPENCLASH_IPK_SHA256" || return 1
            opkg install "$package_file" || { oum_err "Не удалось установить OpenClash"; return 1; }
            ;;
        *) oum_err "Пакетный менеджер OpenWrt не найден"; return 1 ;;
    esac

    oum_require_runtime || return 1
    oum_install_mihomo || return 1
    mkdir -p "$OPENCLASH_DIR/config" "$OPENCLASH_DIR/rule_provider"
    /etc/init.d/openclash stop >/dev/null 2>&1 || true
    /etc/init.d/openclash disable >/dev/null 2>&1 || true
    /etc/init.d/rpcd restart >/dev/null 2>&1 || true
    /etc/init.d/uhttpd restart >/dev/null 2>&1 || true
    oum_ok "OpenClash $OPENCLASH_VERSION и Mihomo $MIHOMO_VERSION установлены"
    oum_info "Сервис запустится после добавления первого подключения"
}

oum_ensure_openclash() {
    if oum_pkg_installed luci-app-openclash && oum_require_runtime && oum_mihomo_core >/dev/null 2>&1; then
        return 0
    fi
    oum_warn "OpenClash ещё не установлен"
    printf 'Установить сейчас? [Y/n]: '
    IFS= read -r answer
    case "$answer" in n|N|no|NO) return 1 ;; esac
    oum_install_openclash
}
