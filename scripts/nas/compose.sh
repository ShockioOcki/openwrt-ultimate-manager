#!/bin/sh
# OUM NAS — Docker Compose generator

NAS_ROOT="/mnt/nas"
COMPOSE_FILE="/mnt/nas/docker-compose.yml"

get_lan_iface() {
    LAN_IFACE=$(ip route | grep default | awk '{print $5}' | head -1)
    [ -z "$LAN_IFACE" ] && LAN_IFACE="br-lan"
    [ -z "$LAN_IFACE" ] && LAN_IFACE="eth0"
    echo "$LAN_IFACE"
}

gen_compose() {
    hdr "=== Docker Compose ==="
    
    LAN_IFACE=$(get_lan_iface)
    inf "LAN интерфейс: $LAN_IFACE"
    
    cat > "$COMPOSE_FILE" << COMPOSEEOF
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
