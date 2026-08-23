#!/bin/sh

set -eu

ROOT="$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)"
BACKUP="$ROOT/luci-app-oum/root/usr/libexec/oum-backup"
RESET="$ROOT/luci-app-oum/root/usr/libexec/oum-reset-vpn"
ENGINE="$ROOT/luci-app-oum/root/usr/libexec/oum-engine-manager"
RPC="$ROOT/luci-app-oum/root/usr/share/rpcd/ucode/oum"
PODKOP="$ROOT/luci-app-oum/root/usr/libexec/oum-podkop-config"
PASSWALL_SOURCE="$ROOT/luci-app-oum/root/usr/libexec/oum-passwall-source-job"
DASHBOARD="$ROOT/luci-app-oum/htdocs/luci-static/resources/view/oum/dashboard-v11.js"

grep -Fq 'OUM_BACKUP_VERSION=2' "$BACKUP"
grep -Fq 'ENGINE=%s' "$BACKUP"
grep -Fq 'passwall)' "$BACKUP"
grep -Fq 'podkop)' "$BACKUP"
grep -Fq '/etc/config/zapret' "$BACKUP"
grep -Fq 'passwall-before-vpn-reset' "$RESET"
grep -Fq 'podkop-before-vpn-reset' "$RESET"
grep -Fq 'PACKAGE_CACHE=/etc/oum/packages' "$ENGINE"
grep -Fq 'stage_asset passwall' "$ENGINE"
grep -Fq '/etc/uci-defaults/luci-passwall' "$ENGINE"
grep -Fq 'PassWall configuration was not created.' "$ENGINE"
grep -Fq 'passwall-before-source' "$PASSWALL_SOURCE"
grep -Fq 'subscribe.lua' "$PASSWALL_SOURCE"
grep -Fq "fail unsupported_type 'AWG" "$PASSWALL_SOURCE"
grep -Fq "OUM_RUNTIME='curl ruby ruby-yaml unzip'" "$ENGINE"
grep -Fq 'ensure_oum_runtime || die' "$ENGINE"
grep -Fq 'download_podkop' "$ENGINE"
grep -Fq 'PodkopTable' "$ENGINE"
grep -Fq 'configurePodkop' "$RPC"
grep -Fq '/usr/libexec/oum-passwall-source-job' "$RPC"
grep -Fq 'podkopRoutingStatus' "$RPC"
grep -Fq 'applyPodkopRouting' "$RPC"
grep -Fq 'podkopDiagnostics' "$RPC"
grep -Fq 'podkopInstalled()' "$RPC"
grep -Fq 'WS_USER="root"' "$PODKOP"
grep -Fq 'podkop_routing' "$ROOT/luci-app-oum/root/usr/libexec/oum-system-job"
grep -Fq 'data-podkop-tab' "$DASHBOARD"
grep -Fq 'podkop-diagnostic-grid' "$DASHBOARD"
grep -Fq 'unmanaged_tunnels' "$RPC"
grep -Fq "length(args.admin_password) < 6" "$RPC"

if grep -Rq 'test_speedtest_yaml' "$ROOT/.github"; then
	echo 'Removed speed-test test is still referenced' >&2
	exit 1
fi

printf 'OUM contract tests: OK\n'
