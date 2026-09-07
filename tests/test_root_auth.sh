#!/bin/sh

set -eu

ROOT="$(CDPATH= cd -- "$(dirname "$0")/.." && pwd)"
TEMP="$(mktemp -d)"
trap 'rm -rf "$TEMP"' EXIT

cat > "$TEMP/dropbear" <<'EOF'
#!/bin/sh
start_instance() {
	[ "${PasswordAuth}" -eq 0 ] && procd_append_param command -s
}
EOF

OUM_DROPBEAR_INIT="$TEMP/dropbear" "$ROOT/luci-app-oum/root/usr/libexec/oum-dropbear-blank-password"
sh -n "$TEMP/dropbear"
grep -Fq 'procd_append_param command -B # OUM: permit an explicitly empty system password' "$TEMP/dropbear"

OUM_DROPBEAR_INIT="$TEMP/dropbear" "$ROOT/luci-app-oum/root/usr/libexec/oum-dropbear-blank-password"
[ "$(grep -Fc 'OUM: permit an explicitly empty system password' "$TEMP/dropbear")" -eq 1 ]

grep -Fq "passwd -d root" "$ROOT/luci-app-oum/root/usr/share/rpcd/ucode/oum"
grep -Fq 'password=\$p\$root' "$ROOT/luci-app-oum/root/usr/libexec/oum-firstboot"
! grep -Fq "passwd -l root" "$ROOT/luci-app-oum/root/usr/libexec/oum-reset-first-run"

echo "root auth tests passed"
