#!/bin/sh
# OUM v8.0 — OpenWrt Ultimate Manager
# Modular NAS/VPN/SQM platform for OpenWrt

OUM_VERSION="8.0.0"
OUM_DIR="/etc/oum"
OUM_CONFIG="$OUM_DIR/oum.conf"
OUM_LOG="/var/log/oum.log"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[1;36m'
NC='\033[0m'

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

# Load modules
load_modules() {
    for module in scripts/core/*.sh scripts/nas/*.sh scripts/vpn/*.sh scripts/firewall/*.sh scripts/ui/*.sh; do
        [ -f "$module" ] && . "$module"
    done
}

# NAS Full Setup
nas_full_setup() {
    check_root
    nas_detect_pkg || return 1
    nas_detect_arch
    nas_check_ram
    nas_check_net
    hdr "╔══════════════════════════════════════════════════════════════╗"
    hdr "║           NAS Setup — Полная настройка v${NAS_VERSION}          ║"
    hdr "╚══════════════════════════════════════════════════════════════╝"
    nas_install_pkgs
    nas_detect_disks || { nas_err "Диски не найдены"; return 1; }
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

# NAS Menu
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

# Podkop Menu
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

# Main menu
main_menu() {
    while true; do
        header
        echo "0) Информация о сервисах"
        echo "1) NAS Setup (Samba, qBit, Jellyfin, Aria2)"
        echo "2) Podkop Watchdog (мониторинг и авто-перезапуск)"
        echo ""
        echo -e "${YELLOW}Enter — Выход из скрипта${NC}"
        read -p "Выбор: " choice

        case "$choice" in
            0) echo "OUM v${OUM_VERSION} — модульная платформа для OpenWrt"; pause ;;
            1) nas_menu ;;
            2) podkop_menu ;;
            "")
                echo -e "${YELLOW}Выход из OUM? (Enter = да)${NC}"
                read -r confirm
                [ -z "$confirm" ] && { echo -e "${GREEN}До свидания!${NC}"; exit 0; }
                ;;
            *) err "Неверный выбор" ;;
        esac
    done
}

check_root() {
    [ "$(id -u)" -ne 0 ] && { err "Запускайте от root!"; exit 1; }
}

pause() {
    echo -e "\n${YELLOW}Нажмите [Enter] для продолжения...${NC}"
    read -r _
}

# Entry point
check_root
load_modules
main_menu
