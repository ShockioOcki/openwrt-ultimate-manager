#!/bin/sh
# OUM NAS — Disk detection and formatting

NAS_ROOT="/mnt/nas"

detect_disks() {
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
            SELECTED_DISK="$dev"
            break
        fi
        i=$((i + 1))
    done
    
    if [ -z "$SELECTED_DISK" ]; then
        err "Неверный выбор"
        return 1
    fi
    
    ok "Выбран: $SELECTED_DISK"
    return 0
}
