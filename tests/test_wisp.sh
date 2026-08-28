#!/bin/sh

set -eu

ROOT="$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)"
SETTINGS="$ROOT/luci-app-oum/htdocs/luci-static/resources/view/oum/settings-v4.js"
DASHBOARD="$ROOT/luci-app-oum/htdocs/luci-static/resources/view/oum/dashboard-v11.js"
RPC="$ROOT/luci-app-oum/root/usr/share/rpcd/ucode/oum"
JOB="$ROOT/luci-app-oum/root/usr/libexec/oum-system-job"
ACL="$ROOT/luci-app-oum/root/usr/share/rpcd/acl.d/luci-app-oum.json"

grep -Fq 'wisp_supported:' "$RPC"
grep -Fq 'scanWifi:' "$RPC"
grep -Fq 'setWisp:' "$RPC"
grep -Fq "return startSystemJob('wisp'" "$RPC"
grep -Fq "network.interface.wwan" "$RPC"
grep -Fq 'apply_wisp()' "$JOB"
grep -Fq 'rollback_wisp()' "$JOB"
grep -Fq 'firewall.$wan_zone.network=wwan' "$JOB"
grep -Fq 'callScanWifi' "$SETTINGS"
grep -Fq 'callSetWisp' "$SETTINGS"
grep -Fq 'Интернет от другой Wi-Fi сети (WISP)' "$SETTINGS"
grep -Fq "fresh.wan?.via === 'wifi'" "$DASHBOARD"
grep -Fq '"wispStatus", "scanWifi"' "$ACL"
grep -Fq '"setWisp"' "$ACL"

printf 'WISP tests: OK\n'
