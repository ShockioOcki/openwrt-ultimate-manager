RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[1;36m'
NC='\033[0m'

oum_err() { printf "${RED}✗ %s${NC}\n" "$*" >&2; }
oum_ok() { printf "${GREEN}✓ %s${NC}\n" "$*"; }
oum_info() { printf "${CYAN}ℹ %s${NC}\n" "$*"; }
oum_warn() { printf "${YELLOW}⚠ %s${NC}\n" "$*" >&2; }

oum_header() {
    clear 2>/dev/null || true
    printf "${CYAN}==================================================${NC}\n"
    printf "${GREEN} OUM v%s — тестовая OpenClash Edition${NC}\n" "$OUM_VERSION"
    printf "${CYAN}==================================================${NC}\n"
}

oum_pause() {
    printf "\n${YELLOW}Нажмите Enter для продолжения...${NC}"
    IFS= read -r _
}

oum_check_root() {
    [ "$(id -u)" -eq 0 ] || { oum_err "Запускайте OUM от root"; exit 1; }
}

oum_prepare_dirs() {
    umask 077
    mkdir -p "$OUM_STATE_DIR" "$OUM_BACKUP_DIR" "$OUM_TMP_DIR"
    chmod 700 "$OUM_STATE_DIR" "$OUM_BACKUP_DIR" "$OUM_TMP_DIR" 2>/dev/null || true
}

oum_cleanup() {
    [ -n "${OUM_TMP_DIR:-}" ] && [ -d "$OUM_TMP_DIR" ] && find "$OUM_TMP_DIR" -mindepth 1 -maxdepth 1 -exec rm -f {} \; 2>/dev/null
    rmdir "$OUM_TMP_DIR" 2>/dev/null || true
}
trap oum_cleanup EXIT INT TERM

oum_log() {
    # Передавать сюда только сообщения без URL, UUID и ключей.
    mkdir -p /var/log/oum
    printf '%s %s\n' "$(date '+%Y-%m-%d %H:%M:%S')" "$*" >> /var/log/oum/oum.log
}

oum_read_secret() {
    prompt="$1"
    printf '%s' "$prompt" >&2
    if [ -t 0 ] && command -v stty >/dev/null 2>&1; then
        stty -echo
        IFS= read -r value
        stty echo
        printf '\n' >&2
    else
        IFS= read -r value
    fi
    printf '%s' "$value"
}

oum_download() {
    url="$1"
    destination="$2"
    if command -v curl >/dev/null 2>&1; then
        curl -fL --connect-timeout 15 --retry 3 --retry-delay 2 -o "$destination" "$url"
    else
        wget -qO "$destination" "$url"
    fi
    [ -s "$destination" ]
}

oum_backup_system() {
    oum_prepare_dirs
    backup="$OUM_BACKUP_DIR/system-$(date +%Y%m%d-%H%M%S).tar.gz"
    if sysupgrade -b "$backup" 2>/dev/null; then
        chmod 600 "$backup"
        oum_ok "Резервная копия: $backup"
        return 0
    fi
    oum_err "Не удалось создать резервную копию"
    return 1
}
