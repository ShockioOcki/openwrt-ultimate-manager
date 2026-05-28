#!/bin/sh
# OUM NAS — Mount and filesystem

NAS_ROOT="/mnt/nas"

setup_mount() {
    dev="$1"
    fs="$2"
    opts="$3"
    
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
    echo "UUID=$UUID $NAS_ROOT $fs $opts 0 0" >> /etc/fstab
    
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
