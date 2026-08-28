#!/bin/sh

set -eu

ROOT="$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)"
RPC="$ROOT/luci-app-oum/root/usr/share/rpcd/ucode/oum"
PAGE="$ROOT/luci-app-oum/htdocs/luci-static/resources/view/oum/parental-v1.js"
MENU="$ROOT/luci-app-oum/root/usr/share/luci/menu.d/luci-app-oum.json"
ACL="$ROOT/luci-app-oum/root/usr/share/rpcd/acl.d/luci-app-oum.json"
CRON="$ROOT/luci-app-oum/root/usr/libexec/oum-parental-cron"
ADGUARD="$ROOT/luci-app-oum/root/usr/libexec/oum-adguard"
JOB="$ROOT/luci-app-oum/root/usr/libexec/oum-system-job"

grep -Fq 'parentalStatus:' "$RPC"
grep -Fq 'setParentalSchedule:' "$RPC"
grep -Fq 'setAdGuard:' "$RPC"
grep -Fq 'setDeviceAdGuard:' "$RPC"
grep -Fq "manual_paused" "$RPC"
grep -Fq "schedule_paused" "$CRON"
grep -Fq "oum_adguard_family" "$ADGUARD"
grep -Fq "94.140.14.15,94.140.15.16" "$ADGUARD"
grep -Fq "adguard)" "$JOB"
grep -Fq 'Родительский контроль' "$PAGE"
grep -Fq 'oum/parental' "$MENU"
grep -Fq 'parentalStatus' "$ACL"
grep -Fq 'setParentalSchedule' "$ACL"

printf 'parental tests: OK\n'
