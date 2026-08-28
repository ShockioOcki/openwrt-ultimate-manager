#!/bin/sh

set -eu

ROOT="$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)"
RPC="$ROOT/luci-app-oum/root/usr/share/rpcd/ucode/oum"
DASH="$ROOT/luci-app-oum/htdocs/luci-static/resources/view/oum/dashboard-v11.js"
TRAFFIC="$ROOT/luci-app-oum/root/usr/libexec/oum-traffic"
HELP="$ROOT/luci-app-oum/htdocs/luci-static/resources/view/oum/help-v1.js"
MENU="$ROOT/luci-app-oum/root/usr/share/luci/menu.d/luci-app-oum.json"

grep -Fq 'function healthStatus()' "$RPC"
grep -Fq 'function trafficStatusData()' "$RPC"
grep -Fq 'health: healthStatus()' "$RPC"
grep -Fq 'trafficCell(client.traffic)' "$DASH"
grep -Fq 'Трафик за 24 ч' "$DASH"
grep -Fq 'Up ${formatUptime' "$DASH"
grep -Fq 'table inet oum_traffic' "$TRAFFIC"
grep -Fq 'netsh int tcp set global timestamps=enabled' "$HELP"
grep -Fq 'Это необязательная настройка ПК' "$HELP"
grep -Fq 'oum/help' "$MENU"

printf 'health and help tests: OK\n'
