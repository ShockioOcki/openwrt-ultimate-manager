#!/bin/sh
# OUM NAS — Docker setup

NAS_ROOT="/mnt/nas"
DOCKER_ROOT="/mnt/nas/docker"

setup_docker() {
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
