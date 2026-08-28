#!/bin/sh

set -eu

ROOT="$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)"
RPC="$ROOT/luci-app-oum/root/usr/share/rpcd/ucode/oum"
JOB="$ROOT/luci-app-oum/root/usr/libexec/oum-system-job"
SETTINGS="$ROOT/luci-app-oum/htdocs/luci-static/resources/view/oum/settings-v4.js"
FIRST="$ROOT/luci-app-oum/htdocs/luci-static/resources/view/oum/first-run-v2.js"
ACL="$ROOT/luci-app-oum/root/usr/share/rpcd/acl.d/luci-app-oum.json"

grep -Fq 'setWifiEnabled:' "$RPC"
grep -Fq "startSystemJob('wifi_toggle'" "$RPC"
grep -Fq 'toggle_wifi()' "$JOB"
grep -Fq 'wireless-toggle-enabled' "$JOB"
grep -Fq 'Отключение Wi-Fi оборвёт беспроводное подключение' "$SETTINGS"
grep -Fq 'setWifiEnabled' "$ACL"
grep -Fq 'admin_no_password' "$RPC"
grep -Fq "request.args.admin_no_password ? '' : request.args.admin_password" "$RPC"
grep -Fq 'Вход admin без пароля' "$FIRST"
grep -Fq 'Пароль root' "$FIRST"

printf 'Wi-Fi and access tests: OK\n'
