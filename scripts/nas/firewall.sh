#!/bin/sh
# OUM NAS — Firewall rules

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
