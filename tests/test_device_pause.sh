#!/bin/sh

set -eu

ROOT="$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)"
RPC="$ROOT/luci-app-oum/root/usr/share/rpcd/ucode/oum"
POLICY="$ROOT/luci-app-oum/root/usr/libexec/oum-device-policy"
DASHBOARD="$ROOT/luci-app-oum/htdocs/luci-static/resources/view/oum/dashboard-v11.js"
ACL="$ROOT/luci-app-oum/root/usr/share/rpcd/acl.d/luci-app-oum.json"

grep -Fq 'setDevicePaused:' "$RPC"
grep -Fq 'offline_clients: offlineClients' "$RPC"
grep -Fq "uci.set('oum', section, 'paused', '1')" "$RPC"
grep -Fq 'setDevicePaused' "$ACL"
grep -Fq 'table inet oum_pause' "$POLICY"
grep -Fq 'hook forward priority -1' "$POLICY"
grep -Fq 'ip saddr %s counter drop' "$POLICY"
grep -Fq 'Недавно были (офлайн)' "$DASHBOARD"
grep -Fq 'Не знаешь, какое это устройство?' "$DASHBOARD"
grep -Fq 'callSetDevicePaused' "$DASHBOARD"

printf 'device pause tests: OK\n'
