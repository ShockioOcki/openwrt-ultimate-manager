#!/bin/sh

set -eu

ROOT="$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)"
BACKUP="$ROOT/luci-app-oum/root/usr/libexec/oum-backup"
RESET="$ROOT/luci-app-oum/root/usr/libexec/oum-reset-vpn"
ENGINE="$ROOT/luci-app-oum/root/usr/libexec/oum-engine-manager"
RPC="$ROOT/luci-app-oum/root/usr/share/rpcd/ucode/oum"

grep -Fq 'OUM_BACKUP_VERSION=2' "$BACKUP"
grep -Fq 'ENGINE=%s' "$BACKUP"
grep -Fq 'passwall)' "$BACKUP"
grep -Fq 'passwall-before-vpn-reset' "$RESET"
grep -Fq 'PACKAGE_CACHE=/etc/oum/packages' "$ENGINE"
grep -Fq 'stage_asset passwall' "$ENGINE"
grep -Fq "OUM_RUNTIME='curl ruby ruby-yaml'" "$ENGINE"
grep -Fq 'ensure_oum_runtime || die' "$ENGINE"
grep -Fq 'unmanaged_tunnels' "$RPC"
grep -Fq "length(args.admin_password) < 6" "$RPC"

if grep -Rq 'test_speedtest_yaml' "$ROOT/.github"; then
	echo 'Removed speed-test test is still referenced' >&2
	exit 1
fi

printf 'OUM contract tests: OK\n'
