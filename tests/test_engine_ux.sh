#!/bin/sh

set -eu

ROOT="$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)"
SETTINGS="$ROOT/luci-app-oum/htdocs/luci-static/resources/view/oum/settings-v4.js"
RPC="$ROOT/luci-app-oum/root/usr/share/rpcd/ucode/oum"
JOB="$ROOT/luci-app-oum/root/usr/libexec/oum-system-job"
ACL="$ROOT/luci-app-oum/root/usr/share/rpcd/acl.d/luci-app-oum.json"

grep -Fq "engineActionLabel = engineMissing ? 'Установить движок' : 'Заменить движок'" "$SETTINGS"
grep -Fq "dnsSelect('dns-current'" "$SETTINGS"
grep -Fq "callSetEngineDnsPreferences(engines.current, activeServer, activeBootstrap)" "$SETTINGS"
! grep -Fq "dnsSelect('dns-openclash'" "$SETTINGS"
grep -Fq 'showEngineJob' "$SETTINGS"
grep -Fq 'Перезагрузить сейчас' "$SETTINGS"
grep -Fq 'Позже' "$SETTINGS"
grep -Fq 'rebootRouter:' "$RPC"
grep -Fq 'reboot_required:' "$RPC"
grep -Fq 'reboot-required' "$JOB"
grep -Fq 'rebootRouter' "$ACL"
grep -Fq 'requested_engine="$(json_value .engine)"' "$JOB"
grep -Fq 'oum.main.dns_$engine=$server' "$JOB"
! grep -Fq 'oum.main.dns_openclash=$openclash' "$JOB"

printf 'engine UX tests: OK\n'
