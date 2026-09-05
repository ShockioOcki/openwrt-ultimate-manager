#!/bin/sh

set -eu

ROOT="$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)"
SETTINGS="$ROOT/luci-app-oum/htdocs/luci-static/resources/view/oum/settings-v43.js"
DASHBOARD="$ROOT/luci-app-oum/htdocs/luci-static/resources/view/oum/dashboard-v43.js"
RPC="$ROOT/luci-app-oum/root/usr/share/rpcd/ucode/oum"
JOB="$ROOT/luci-app-oum/root/usr/libexec/oum-system-job"
ACL="$ROOT/luci-app-oum/root/usr/share/rpcd/acl.d/luci-app-oum.json"

grep -Fq 'wisp_supported:' "$RPC"
grep -Fq 'scanWifi:' "$RPC"
grep -Fq "temporaryIface = band == '5g' ? 'oum_scan5' : 'oum_scan2'" "$RPC"
grep -Fq 'interface add ${temporaryIface} type managed' "$RPC"
grep -Fq 'iw dev ${temporaryIface} del' "$RPC"
grep -Fq 'setWisp:' "$RPC"
grep -Fq "return startSystemJob('wisp'" "$RPC"
grep -Fq "network.interface.wwan" "$RPC"
grep -Fq 'apply_wisp()' "$JOB"
grep -Fq 'rollback_wisp()' "$JOB"
grep -Fq 'firewall.$wan_zone.network=wwan' "$JOB"
grep -Fq 'callScanWifi' "$SETTINGS"
grep -Fq 'callSetWisp' "$SETTINGS"
grep -Fq "'data-wan-type-btn': 'wisp'" "$SETTINGS"
grep -Fq "id: 'wisp-settings'" "$SETTINGS"
grep -Fq "id: 'wan-wired-actions'" "$SETTINGS"
[ "$(grep -Fc "id: 'scan-wisp'" "$SETTINGS")" -eq 1 ]
[ "$(grep -Fc "id: 'enable-wisp'" "$SETTINGS")" -eq 1 ]
! grep -Fq 'Интернет от другой Wi-Fi сети (WISP)' "$SETTINGS"
grep -Fq "fresh.wan?.via === 'wifi'" "$DASHBOARD"
grep -Fq '"wispStatus", "scanWifi"' "$ACL"
grep -Fq '"setWisp"' "$ACL"

printf 'WISP tests: OK\n'
