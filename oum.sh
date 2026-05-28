#!/bin/sh
# OUM v8.0 — OpenWrt Ultimate Manager
# NAS + Podkop Watchdog + SQM + GearUP + VPN
# GitHub DNS Fix включён

OUM_VERSION="8.0.0"

# ==========================================
# GitHub DNS Fix (как в Zapret-Manager)
# ==========================================
GITHUB_FIX_APPLIED=0
if ! grep -q "raw.githubusercontent.com" /etc/hosts 2>/dev/null; then
    echo -e "\033[1;36m[OUM] Добавляем GitHub домены в /etc/hosts...\033[0m"
    printf "#githubusercontent.com\n185.199.109.133 raw.githubusercontent.com release-assets.githubusercontent.com\n185.199.108.133 private-user-images.githubusercontent.com gist.githubusercontent.com avatars.githubusercontent.com\n" >> /etc/hosts
    /etc/init.d/dnsmasq restart >/dev/null 2>&1
    echo -e "\033[0;32m[OUM] GitHub домены добавлены!\033[0m"
    GITHUB_FIX_APPLIED=1
fi

# ==========================================
# Colors
# ==========================================
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[1;36m'
MAGENTA='\033[1;35m'
BLUE='\033[0;34m'
NC='\033[0m'
DGRAY='\033[38;5;244m'

err() { echo -e "${RED}✗ $1${NC}"; }
ok() { echo -e "${GREEN}✓ $1${NC}"; }
inf() { echo -e "${CYAN}ℹ $1${NC}"; }
wrn() { echo -e "${YELLOW}⚠ $1${NC}"; }
hdr() { echo -e "\033[1;36m$1\033[0m"; }

header() {
    clear
    echo -e "${CYAN}==================================================${NC}"
    echo -e "${GREEN}        OUM v${OUM_VERSION} — OpenWrt Ultimate Manager        ${NC}"
    echo -e "${CYAN}==================================================${NC}"
}

pause() {
    echo -e "\n${YELLOW}Нажмите [Enter] для продолжения...${NC}"
    read -r _
}

check_root() {
    [ "$(id -u)" -ne 0 ] && { err "Запускайте от root!"; exit 1; }
}

# ==========================================
# Auto-update OUM
# ==========================================
auto_update() {
    inf "Проверка обновлений OUM..."
    TMP_OUM="/tmp/oum_new.sh"
    if wget -q -U "Mozilla/5.0" -O "$TMP_OUM" "https://raw.githubusercontent.com/ShockioOcki/openwrt-ultimate-manager/main/oum.sh" 2>/dev/null; then
        if [ -f "$TMP_OUM" ] && [ -s "$TMP_OUM" ]; then
            if ! cmp -s "$TMP_OUM" "$0" 2>/dev/null; then
                inf "Найдена новая версия OUM!"
                cp "$TMP_OUM" "$0"
                chmod +x "$0"
                ok "OUM обновлён до новой версии!"
                rm -f "$TMP_OUM"
                echo -e "${YELLOW}Перезапускаем OUM...${NC}"
                exec "$0"
            else
                ok "У вас актуальная версия OUM"
                rm -f "$TMP_OUM"
            fi
        fi
    else
        wrn "Не удалось проверить обновления (возможно, нет интернета)"
    fi
}

# ==========================================
# NAS Setup Functions
# ==========================================
NAS_ROOT="/mnt/nas"
DOCKER_ROOT="/mnt/nas/docker"
COMPOSE_FILE="/mnt/nas/docker-compose.yml"
CONFIG_DIR="/mnt/nas/config"

nas_detect_pkg() {
    if command -v apk >/dev/null 2>&1; then
        NAS_PKG_MGR="apk"; NAS_PKG_INSTALL="apk add"; NAS_PKG_QUERY="apk info -e"; NAS_PKG_UPDATE="apk update"
    elif command -v opkg >/dev/null 2>&1; then
        NAS_PKG_MGR="opkg"; NAS_PKG_INSTALL="opkg install"; NAS_PKG_QUERY="opkg list-installed | grep -q"; NAS_PKG_UPDATE="opkg update"
    else
        err "Не найден пакетный менеджер"; return 1
    fi
    ok "Пакетный менеджер: $NAS_PKG_MGR"
}

nas_detect_arch() {
    ARCH=$(uname -m)
    case "$ARCH" in
        aarch64|arm64) DOCKER_ARCH="aarch64" ;;
        x86_64|amd64) DOCKER_ARCH="x86_64" ;;
        *) DOCKER_ARCH="unknown" ;;
    esac
    inf "Архитектура: $ARCH | Docker: $DOCKER_ARCH"
}

nas_check_ram() {
    RAM_KB=$(grep MemTotal /proc/meminfo 2>/dev/null | awk '{print $2}')
    RAM_MB=$((RAM_KB / 1024))
    inf "RAM: ${RAM_MB}МБ"
    if [ "$RAM_MB" -lt 512 ]; then
        wrn "Мало RAM (${RAM_MB}МБ). Docker может работать медленно."
    fi
}

nas_check_net() {
    inf "Проверка интернета..."
    if ping -c 1 -W 3 8.8.8.8 >/dev/null 2>&1; then
        ok "Интернет доступен"
    else
        err "Интернет недоступен!"
        return 1
    fi
}

nas_install_pkgs() {
    hdr "=== Установка пакетов ==="
    inf "Обновление списка пакетов..."
    $NAS_PKG_UPDATE >/dev/null 2>&1 || { err "Не удалось обновить пакеты"; return 1; }

    for pkg in block-mount e2fsprogs kmod-fs-ext4 kmod-usb-storage kmod-usb3 dockerd docker docker-compose; do
        inf "Установка $pkg..."
        $NAS_PKG_INSTALL $pkg >/dev/null 2>&1 || wrn "$pkg не установлен (возможно уже есть)"
    done
    ok "Пакеты установлены"
}

nas_detect_disks() {
    hdr "=== Обнаружение дисков ==="
    inf "Сканирование..."

    DISK_LIST=""
    DISK_SIZES=""

    if command -v lsblk >/dev/null 2>&1; then
        lsblk -dpno NAME,SIZE,TYPE 2>/dev/null | grep -E "disk|nvme" | grep -vE "mmcblk|mtd|zram|loop|ubiblock|fit" > /tmp/disklist.txt 2>/dev/null || true
        if [ -s /tmp/disklist.txt ]; then
            DISK_LIST=$(awk '{print $1}' /tmp/disklist.txt)
            DISK_SIZES=$(awk '{print $2}' /tmp/disklist.txt)
        fi
    fi

    if [ -z "$DISK_LIST" ]; then
        for dev in /dev/sda /dev/sdb /dev/sdc /dev/sdd /dev/nvme0n1 /dev/nvme1n1; do
            if [ -b "$dev" ]; then
                size=$(blockdev --getsize64 "$dev" 2>/dev/null || echo "0")
                if [ "$size" -gt 0 ]; then
                    DISK_LIST="$DISK_LIST $dev"
                    size_gb=$((size / 1024 / 1024 / 1024))
                    DISK_SIZES="$DISK_SIZES ${size_gb}ГБ"
                fi
            fi
        done
    fi

    if [ -z "$DISK_LIST" ]; then
        err "Диски не найдены"
        return 1
    fi

    echo ""
    echo "  №   Устройство         Размер"
    echo "  ------------------------------"

    i=1
    set -- $DISK_SIZES
    for dev in $DISK_LIST; do
        size="$1"
        printf "  [%s] %-18s %s\n" "$i" "$dev" "$size"
        i=$((i + 1))
        shift
    done

    printf "\nВыберите диск [1]: "
    read choice
    [ -z "$choice" ] && choice=1

    disk_count=$(echo "$DISK_LIST" | wc -w)
    if [ "$choice" -lt 1 ] || [ "$choice" -gt "$disk_count" ] 2>/dev/null; then
        choice=1
    fi

    i=1
    for dev in $DISK_LIST; do
        if [ "$i" -eq "$choice" ]; then
            NAS_DISK="$dev"
            break
        fi
        i=$((i + 1))
    done

    if [ -z "$NAS_DISK" ]; then
        err "Неверный выбор"
        return 1
    fi

    ok "Выбран: $NAS_DISK"
    return 0
}

nas_select_fs() {
    echo ""
    echo "  [1] ext4  (по умолчанию — стабильно)"
    echo "  [2] btrfs (сжатие, snapshots)"
    echo "  [3] xfs   (для больших файлов)"
    printf "Выберите ФС [1]: "
    read fs_choice
    [ -z "$fs_choice" ] && fs_choice=1

    case "$fs_choice" in
        2) NAS_FS="btrfs" ;;
        3) NAS_FS="xfs" ;;
        *) NAS_FS="ext4" ;;
    esac
    ok "Файловая система: $NAS_FS"
}

nas_format_disk() {
    dev="$1"
    fs="$2"
    hdr "=== Форматирование ==="

    inf "Остановка Docker..."
    /etc/init.d/dockerd stop 2>/dev/null || true
    sleep 2

    if mount | grep -q "$dev"; then
        wrn "Диск используется! Отмонтирование..."
        umount -l "${dev}1" 2>/dev/null || true
        umount -l "$NAS_ROOT" 2>/dev/null || true
        sleep 2
    fi

    inf "Форматирование $dev в $fs..."

    if [ "$fs" = "btrfs" ] && ! command -v mkfs.btrfs >/dev/null 2>&1; then
        inf "Установка btrfs-progs..."
        $NAS_PKG_INSTALL btrfs-progs >/dev/null 2>&1 || { err "Не удалось установить btrfs-progs"; return 1; }
    fi

    if [ "$fs" = "xfs" ] && ! command -v mkfs.xfs >/dev/null 2>&1; then
        inf "Установка xfs-mkfs..."
        $NAS_PKG_INSTALL xfs-mkfs >/dev/null 2>&1 || { err "Не удалось установить xfs-mkfs"; return 1; }
    fi

    dd if=/dev/zero of="$dev" bs=512 count=1 conv=notrunc 2>/dev/null
    parted -s "$dev" mklabel gpt 2>/dev/null || true
    parted -s "$dev" mkpart primary 0% 100% 2>/dev/null || true
    sleep 1

    case "$fs" in
        ext4) mkfs.ext4 -F "${dev}1" >/dev/null 2>&1 ;;
        btrfs) mkfs.btrfs -f "${dev}1" >/dev/null 2>&1 ;;
        xfs) mkfs.xfs -f "${dev}1" >/dev/null 2>&1 ;;
    esac

    ok "Форматирование завершено"
}

nas_setup_mount() {
    dev="$1"
    fs="$2"

    hdr "=== Монтирование ==="

    sleep 2
    UUID=$(blkid "${dev}1" 2>/dev/null | head -1 | grep -o 'UUID="[^"]*"' | head -1 | cut -d'"' -f2)
    if [ -z "$UUID" ]; then
        err "Не удалось получить UUID"
        return 1
    fi

    inf "UUID: $UUID"
    mkdir -p "$NAS_ROOT"

    grep -v "$NAS_ROOT" /etc/fstab | grep -v "^UUID=[^ ]*$" > /tmp/fstab.new 2>/dev/null || cp /etc/fstab /tmp/fstab.new
    mv /tmp/fstab.new /etc/fstab
    echo "UUID=$UUID $NAS_ROOT $fs defaults,noatime 0 0" >> /etc/fstab

    mount "$NAS_ROOT" 2>/dev/null || mount -a

    MOUNTED=0
    if command -v mountpoint >/dev/null 2>&1; then
        mountpoint -q "$NAS_ROOT" && MOUNTED=1
    else
        mount | grep -q " $NAS_ROOT " && MOUNTED=1
    fi

    if [ "$MOUNTED" -eq 0 ]; then
        err "Ошибка монтирования"
        return 1
    fi

    inf "Создание папок..."
    for dir in docker torrents/watch torrents/incomplete torrents/complete downloads/incomplete downloads/complete media/movies media/tv media/music config/qbittorrent config/radarr config/sonarr config/prowlarr config/bazarr config/jellyfin/config config/jellyfin/cache config/aria2 config/samba scripts; do
        mkdir -p "$NAS_ROOT/$dir"
    done
    chmod 777 "$NAS_ROOT"

    ok "Смонтировано в $NAS_ROOT"
    df -h "$NAS_ROOT"
}

nas_setup_docker() {
    hdr "=== Docker ==="
    mkdir -p "$DOCKER_ROOT"

    if [ -f /etc/config/dockerd ]; then
        inf "Настройка через uci..."
        uci set dockerd.globals.data_root="$DOCKER_ROOT"
        uci commit dockerd
    else
        inf "Настройка через daemon.json..."
        mkdir -p /etc/docker
        echo '{"data-root":"'$DOCKER_ROOT'","storage-driver":"overlay2","log-driver":"json-file","log-opts":{"max-size":"10m","max-file":"3"}}' > /etc/docker/daemon.json
    fi

    /etc/init.d/dockerd enable 2>/dev/null || true
    /etc/init.d/dockerd stop 2>/dev/null || true
    sleep 2
    /etc/init.d/dockerd start 2>/dev/null || true

    inf "Ожидание Docker..."
    i=0
    while [ "$i" -lt 30 ]; do
        if docker info >/dev/null 2>&1; then
            break
        fi
        sleep 1
        i=$((i + 1))
    done

    if ! docker info >/dev/null 2>&1; then
        err "Docker не запустился"
        return 1
    fi
    ok "Docker готов"
}

nas_gen_compose() {
    hdr "=== Docker Compose ==="

    LAN_IFACE=$(ip route | grep default | awk '{print $5}' | head -1)
    [ -z "$LAN_IFACE" ] && LAN_IFACE="br-lan"
    [ -z "$LAN_IFACE" ] && LAN_IFACE="eth0"
    inf "LAN интерфейс: $LAN_IFACE"

    cat > "$COMPOSE_FILE" << 'COMPOSEEOF'
services:
  samba:
    image: ghcr.io/servercontainers/samba:latest
    container_name: nas-samba
    hostname: openwrt-nas
    network_mode: host
    restart: unless-stopped
    cap_add:
      - CAP_NET_ADMIN
    volumes:
      - NAS_ROOT:/shares/nas
    environment:
      - TZ=Europe/Moscow
      - SAMBA_VOLUME_CONFIG_nas=[nas]; path=/shares/nas; browseable=yes; read only=no; guest ok=yes; writeable=yes; create mask=0777; directory mask=0777; force user=root; force group=root
      - WSDD2_PARAMETERS=-i LAN_IFACE

  qbittorrent:
    image: linuxserver/qbittorrent:latest
    container_name: nas-qbittorrent
    network_mode: host
    restart: unless-stopped
    volumes:
      - NAS_ROOT/torrents/complete:/downloads
      - NAS_ROOT/torrents/incomplete:/downloads/incomplete
      - NAS_ROOT/torrents/watch:/watch
      - NAS_ROOT/config/qbittorrent:/config
    environment:
      - PUID=0
      - PGID=0
      - WEBUI_PORT=8080

  radarr:
    image: linuxserver/radarr:latest
    container_name: nas-radarr
    network_mode: host
    restart: unless-stopped
    volumes:
      - NAS_ROOT/config/radarr:/config
      - NAS_ROOT/media/movies:/movies
      - NAS_ROOT/torrents/complete:/downloads
    environment:
      - PUID=0
      - PGID=0

  sonarr:
    image: linuxserver/sonarr:latest
    container_name: nas-sonarr
    network_mode: host
    restart: unless-stopped
    volumes:
      - NAS_ROOT/config/sonarr:/config
      - NAS_ROOT/media/tv:/tv
      - NAS_ROOT/torrents/complete:/downloads
    environment:
      - PUID=0
      - PGID=0

  prowlarr:
    image: linuxserver/prowlarr:latest
    container_name: nas-prowlarr
    network_mode: host
    restart: unless-stopped
    volumes:
      - NAS_ROOT/config/prowlarr:/config
    environment:
      - PUID=0
      - PGID=0

  bazarr:
    image: linuxserver/bazarr:latest
    container_name: nas-bazarr
    network_mode: host
    restart: unless-stopped
    volumes:
      - NAS_ROOT/config/bazarr:/config
      - NAS_ROOT/media/movies:/movies
      - NAS_ROOT/media/tv:/tv
    environment:
      - PUID=0
      - PGID=0

  jellyfin:
    image: jellyfin/jellyfin:latest
    container_name: nas-jellyfin
    network_mode: host
    restart: unless-stopped
    volumes:
      - NAS_ROOT/media:/media
      - NAS_ROOT/config/jellyfin/config:/config
      - NAS_ROOT/config/jellyfin/cache:/cache
    environment:
      - PUID=0
      - PGID=0

  aria2:
    image: p3terx/aria2-pro:latest
    container_name: nas-aria2
    network_mode: host
    restart: unless-stopped
    volumes:
      - NAS_ROOT/downloads/complete:/downloads
      - NAS_ROOT/downloads/incomplete:/downloads/incomplete
      - NAS_ROOT/config/aria2:/config
    environment:
      - PUID=0
      - PGID=0
      - RPC_PORT=6800

  aria2ng:
    image: p3terx/ariang:latest
    container_name: nas-aria2ng
    network_mode: host
    restart: unless-stopped
    environment:
      - ARIA2_RPC_URL=http://127.0.0.1:6800/jsonrpc
COMPOSEEOF

    sed -i "s|NAS_ROOT|$NAS_ROOT|g" "$COMPOSE_FILE"
    sed -i "s|LAN_IFACE|$LAN_IFACE|g" "$COMPOSE_FILE"
    ok "Compose создан"
}

qbittorrent_fix_password() {
    inf "Установка пароля qBittorrent: admin..."
    mkdir -p "$CONFIG_DIR/qbittorrent/qBittorrent/config"
    cat > "$CONFIG_DIR/qbittorrent/qBittorrent/config/qBittorrent.conf" << 'QBITCONF'
[BitTorrent]
Session\DefaultSavePath=/downloads
Session\TempPath=/downloads/incomplete
Session\AddExtensionToIncompleteFiles=true

[Preferences]
WebUI\Port=8080
WebUI\LocalHostAuth=false
WebUI\Username=admin
WebUI\Password_PBKDF2="@ByteArray(ARQ77eY1NUZaQsuDHbIMCA==:0WMRkYTUWVT9wVvdDtHAjU9b3b7uB8NR1Gur2hmQCvDCpmvs7yWaWXMgrULczQJeEaJdzOJqEiWsBlG34Hk0vg==:10000)"
Downloads\SavePath=/downloads
Downloads\TempPath=/downloads/incomplete
QBITCONF
}

jellyfin_ru_config() {
    inf "Настройка Jellyfin на русский..."
    mkdir -p "$CONFIG_DIR/jellyfin/config/config"
    cat > "$CONFIG_DIR/jellyfin/config/config/system.xml" << 'JELLYCONF'
<?xml version="1.0" encoding="utf-8"?>
<ServerConfiguration xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema">
  <LogFileRetentionDays>3</LogFileRetentionDays>
  <IsStartupWizardCompleted>false</IsStartupWizardCompleted>
  <EnableUPnP>false</EnableUPnP>
  <PublicPort>8096</PublicPort>
  <PublicHttpsPort>8920</PublicHttpsPort>
  <HttpServerPortNumber>8096</HttpServerPortNumber>
  <HttpsPortNumber>8920</HttpsPortNumber>
  <EnableHttps>false</EnableHttps>
  <AutoRunWebApp>false</AutoRunWebApp>
  <AutoDiscovery>true</AutoDiscovery>
  <EnableRemoteAccess>true</EnableRemoteAccess>
  <PreferredMetadataLanguage>ru</PreferredMetadataLanguage>
  <MetadataCountryCode>RU</MetadataCountryCode>
  <LibraryMonitorDelay>60</LibraryMonitorDelay>
  <LibraryUpdateDuration>30</LibraryUpdateDuration>
  <ImageSavingConvention>Compatible</ImageSavingConvention>
  <EnableAutomaticRestart>false</EnableAutomaticRestart>
  <ServerName></ServerName>
  <BaseUrl></BaseUrl>
  <UICulture>ru-RU</UICulture>
  <SaveMetadataHidden>false</SaveMetadataHidden>
  <RemoteClientBitrateLimit>0</RemoteClientBitrateLimit>
  <EnableFolderView>false</EnableFolderView>
  <EnableGroupingIntoCollections>false</EnableGroupingIntoCollections>
  <DisplaySpecialsWithinSeasons>true</DisplaySpecialsWithinSeasons>
  <CodecsUsed></CodecsUsed>
  <PluginRepositories>
    <RepositoryInfo>
      <Name>Jellyfin Stable</Name>
      <Url>https://repo.jellyfin.org/releases/plugin/manifest-stable.json</Url>
      <Enabled>true</Enabled>
    </RepositoryInfo>
  </PluginRepositories>
  <ImageExtractionTimeoutMs>0</ImageExtractionTimeoutMs>
  <PathSubstitutions></PathSubstitutions>
  <EnableSlowResponseWarning>true</EnableSlowResponseWarning>
  <SlowResponseThresholdMs>500</SlowResponseThresholdMs>
  <CorsHosts></CorsHosts>
  <ActivityLogRetentionDays>30</ActivityLogRetentionDays>
  <LibraryScanFanoutConcurrency>0</LibraryScanFanoutConcurrency>
  <LibraryMetadataRefreshConcurrency>0</LibraryMetadataRefreshConcurrency>
  <RemoveOldPlugins>false</RemoveOldPlugins>
  <AllowClientLogUpload>true</AllowClientLogUpload>
  <DummyChapterDuration>300</DummyChapterDuration>
  <ChapterImageResolution>MatchSource</ChapterImageResolution>
  <EnableExternalContentInSuggestions>false</EnableExternalContentInSuggestions>
  <RequireHttps>false</RequireHttps>
</ServerConfiguration>
JELLYCONF
}

aria2_config() {
    inf "Настройка Aria2..."
    mkdir -p "$CONFIG_DIR/aria2"
    cat > "$CONFIG_DIR/aria2/aria2.conf" << 'ARIA2CONF'
dir=/downloads/complete
max-connection-per-server=16
split=16
min-split-size=10M
seed-time=0
bt-stop-timeout=600
enable-dht=true
enable-peer-exchange=true
bt-enable-lpd=true
enable-rpc=true
rpc-listen-port=6800
rpc-listen-all=true
rpc-allow-origin-all=true
disable-ipv6=true
input-file=/config/aria2.session
save-session=/config/aria2.session
ARIA2CONF
    touch "$CONFIG_DIR/aria2/aria2.session"
}

nas_cfg_services() {
    hdr "=== Настройка сервисов ==="
    qbittorrent_fix_password
    jellyfin_ru_config
    aria2_config
    ok "Конфиги созданы"
}

nas_setup_fw() {
    hdr "=== Firewall NAS ==="
    for port in 139 445 8080 7878 8989 9696 6767 8096 6800 6880; do
        if command -v nft >/dev/null 2>&1; then
            nft add rule inet fw4 input_lan tcp dport $port accept 2>/dev/null || true
        fi
        if command -v iptables >/dev/null 2>&1; then
            iptables -I input_rule -p tcp --dport $port -j ACCEPT 2>/dev/null || true
        fi
    done
    /etc/init.d/firewall restart 2>/dev/null || true
    ok "Firewall настроен"
}

nas_start_svcs() {
    hdr "=== Запуск сервисов ==="
    cd /mnt/nas || return
    docker compose up -d 2>/dev/null || docker-compose up -d 2>/dev/null || { err "Docker Compose не запустился"; return 1; }
    ok "Сервисы запущены"
}

nas_check_svcs() {
    hdr "=== Проверка сервисов ==="
    sleep 5
    for svc in nas-samba nas-qbittorrent nas-radarr nas-sonarr nas-prowlarr nas-bazarr nas-jellyfin nas-aria2 nas-aria2ng; do
        if docker ps --format '{{.Names}}' | grep -q "$svc"; then
            ok "$svc: работает"
        else
            wrn "$svc: не запущен"
        fi
    done
}

# ==========================================
# Podkop Watchdog
# ==========================================
install_watchdog() {
    inf "Установка Podkop Watchdog..."
    cat > /usr/bin/podkop-watchdog.sh << 'EOF'
#!/bin/sh

TARGET="mail.ru"
PING_COUNT=3
PING_TIMEOUT=3
RESTART_DELAY=30
MAX_ATTEMPTS=3

attempt=1
echo "=== Podkop Watchdog ==="
echo "Цель проверки: $TARGET"
echo "Максимум попыток: $MAX_ATTEMPTS"
echo ""

while [ $attempt -le $MAX_ATTEMPTS ]; do
    echo "Попытка $attempt из $MAX_ATTEMPTS: проверяем доступность $TARGET..."

    if ping -c $PING_COUNT -W $PING_TIMEOUT $TARGET > /dev/null 2>&1; then
        echo "  [OK] $TARGET доступен. Интернет работает."
        echo ""
        echo "=== Результат: Интернет в порядке, podkop не требует перезапуска ==="
        exit 0
    fi

    echo "  [FAIL] $TARGET недоступен. Перезапуск podkop..."
    /etc/init.d/podkop restart
    echo "  [OK] podkop перезапущен."

    if [ $attempt -lt $MAX_ATTEMPTS ]; then
        echo "  Ожидание $RESTART_DELAY сек перед следующей проверкой..."
        sleep $RESTART_DELAY
    fi

    attempt=$((attempt + 1))
done

echo ""
echo "=== Результат: Интернет НЕ восстановлен после $MAX_ATTEMPTS попыток ==="
exit 1
EOF
    chmod +x /usr/bin/podkop-watchdog.sh
    ok "Watchdog установлен: /usr/bin/podkop-watchdog.sh"

    inf "Добавляем в rc.local..."
    if ! grep -q "podkop-watchdog" /etc/rc.local 2>/dev/null; then
        sed -i '/exit 0/d' /etc/rc.local 2>/dev/null || true
        echo "(sleep 60 && /usr/bin/podkop-watchdog.sh) &" >> /etc/rc.local
        echo "exit 0" >> /etc/rc.local
        ok "Добавлено в rc.local"
    else
        wrn "Watchdog уже есть в rc.local"
    fi
}

run_watchdog() {
    if [ -f /usr/bin/podkop-watchdog.sh ]; then
        inf "Запуск Podkop Watchdog..."
        /usr/bin/podkop-watchdog.sh
    else
        err "Watchdog не установлен. Сначала установите его."
    fi
}

podkop_status() {
    hdr "=== Статус Podkop ==="
    if /etc/init.d/podkop status 2>/dev/null | grep -q running; then
        ok "Podkop: работает"
    else
        err "Podkop: не запущен"
    fi
    if [ -f /usr/bin/podkop-watchdog.sh ]; then
        ok "Watchdog: установлен"
    else
        err "Watchdog: не установлен"
    fi
}

# ==========================================
# NAS Full Setup
# ==========================================
nas_full_setup() {
    check_root
    nas_detect_pkg || return 1
    nas_detect_arch
    nas_check_ram
    nas_check_net
    hdr "╔══════════════════════════════════════════════════════════════╗"
    hdr "║           NAS Setup — Полная настройка v${OUM_VERSION}          ║"
    hdr "╚══════════════════════════════════════════════════════════════╝"
    nas_install_pkgs
    nas_detect_disks || { err "Диски не найдены"; return 1; }
    nas_select_fs
    printf "Форматировать %s? [Y/n]: " "$NAS_DISK"
    read do_fmt
    [ "$do_fmt" != "n" ] && nas_format_disk "$NAS_DISK" "$NAS_FS"
    nas_setup_mount "$NAS_DISK" "$NAS_FS"
    nas_setup_docker
    nas_gen_compose
    nas_cfg_services
    nas_setup_fw
    nas_start_svcs
    nas_check_svcs
    LAN_IP=$(ip addr show br-lan 2>/dev/null | grep "inet " | awk '{print $2}' | cut -d/ -f1)
    [ -z "$LAN_IP" ] && LAN_IP="192.168.1.1"
    hdr "╔══════════════════════════════════════════════════════════════╗"
    hdr "║                    NAS НАСТРОЙКА ЗАВЕРШЕНА                   ║"
    hdr "╠══════════════════════════════════════════════════════════════╣"
    echo "║  Samba:    \\\\${LAN_IP}\\nas    (guest, чтение+запись)"
    echo "║  qBit:     http://${LAN_IP}:8080  (admin / admin)"
    echo "║  Radarr:   http://${LAN_IP}:7878"
    echo "║  Sonarr:   http://${LAN_IP}:8989"
    echo "║  Prowlarr: http://${LAN_IP}:9696"
    echo "║  Bazarr:   http://${LAN_IP}:6767"
    echo "║  Jellyfin: http://${LAN_IP}:8096"
    echo "║  Aria2:    http://${LAN_IP}:6800"
    echo "║  AriaNg:   http://${LAN_IP}:6880"
    hdr "╚══════════════════════════════════════════════════════════════╝"
}

# ==========================================
# Menus
# ==========================================
nas_menu() {
    while true; do
        header
        echo -e "${CYAN}=== Меню NAS Setup ===${NC}"
        echo "1) Полная настройка NAS (диск + Docker + сервисы)"
        echo "2) Только диски (обнаружение, формат, монтирование)"
        echo "3) Только Docker (установка, настройка)"
        echo "4) Только сервисы (compose, конфиги, запуск)"
        echo "5) Проверка работы сервисов"
        echo "6) Перезапустить NAS сервисы"
        echo "7) Остановить NAS сервисы"
        echo ""
        echo -e "${YELLOW}Enter — Назад в главное меню${NC}"
        read -p "Выбор: " choice
        case "$choice" in
            "") break ;;
            1) nas_full_setup; pause ;;
            2) nas_detect_disks && nas_select_fs && { printf "Форматировать? [Y/n]: "; read df; [ "$df" != "n" ] && nas_format_disk "$NAS_DISK" "$NAS_FS"; nas_setup_mount "$NAS_DISK" "$NAS_FS"; }; pause ;;
            3) nas_setup_docker; pause ;;
            4) nas_gen_compose; nas_cfg_services; nas_setup_fw; nas_start_svcs; nas_check_svcs; pause ;;
            5) nas_check_svcs; pause ;;
            6) cd /mnt/nas && docker compose restart; ok "Сервисы перезапущены"; pause ;;
            7) cd /mnt/nas && docker compose down; ok "Сервисы остановлены"; pause ;;
            *) err "Неверный выбор" ;;
        esac
    done
}

podkop_menu() {
    while true; do
        header
        echo -e "${CYAN}=== Меню Podkop ===${NC}"
        echo "1) Установить Podkop Watchdog"
        echo "2) Запустить Watchdog вручную"
        echo "3) Статус Podkop + Watchdog"
        echo "4) Перезапустить Podkop"
        echo ""
        echo -e "${YELLOW}Enter — Назад${NC}"
        read -p "Выбор: " choice
        case "$choice" in
            "") break ;;
            1) install_watchdog; pause ;;
            2) run_watchdog; pause ;;
            3) podkop_status; pause ;;
            4) /etc/init.d/podkop restart; ok "Podkop перезапущен"; pause ;;
            *) err "Неверный выбор" ;;
        esac
    done
}

main_menu() {
    while true; do
        header
        echo "0) Информация о сервисах"
        echo "1) NAS Setup (Samba, qBit, Jellyfin, Aria2)"
        echo "2) Podkop Watchdog (мониторинг и авто-перезапуск)"
        echo "3) Проверить обновления OUM"
        echo ""
        echo -e "${YELLOW}Enter — Выход из скрипта${NC}"
        read -p "Выбор: " choice

        case "$choice" in
            0) 
                echo ""
                echo "OUM v${OUM_VERSION} — модульная платформа для OpenWrt"
                echo ""
                echo "Возможности:"
                echo "  • NAS Setup: Samba, qBittorrent, Radarr, Sonarr,"
                echo "    Prowlarr, Bazarr, Jellyfin, Aria2, AriaNg"
                echo "  • Podkop Watchdog: авто-мониторинг интернета"
                echo "  • Samba: гостевой доступ с полными правами"
                echo "  • Jellyfin: русский язык по умолчанию"
                echo "  • qBittorrent: пароль admin/admin"
                echo ""
                if [ "$GITHUB_FIX_APPLIED" -eq 1 ]; then
                    echo "GitHub DNS Fix: применён (добавлены IP в /etc/hosts)"
                fi
                pause 
                ;;
            1) nas_menu ;;
            2) podkop_menu ;;
            3) auto_update; pause ;;
            "")
                echo -e "${YELLOW}Выход из OUM? (Enter = да)${NC}"
                read -r confirm
                [ -z "$confirm" ] && { echo -e "${GREEN}До свидания!${NC}"; exit 0; }
                ;;
            *) err "Неверный выбор" ;;
        esac
    done
}

# ==========================================
# Entry Point
# ==========================================
check_root
main_menu
