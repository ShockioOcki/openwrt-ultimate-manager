#!/bin/sh
set -eu

ROOT="$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)"
RPC="$ROOT/luci-app-oum/root/usr/share/rpcd/ucode/oum"
ACL="$ROOT/luci-app-oum/root/usr/share/rpcd/acl.d/luci-app-oum.json"
HELP="$ROOT/luci-app-oum/htdocs/luci-static/resources/view/oum/help-v3.js"
RUNTIME="$ROOT/luci-app-oum/root/usr/libexec/oum-support"

grep -Fq 'supportStatus:' "$RPC"
grep -Fq 'startSupportSession:' "$RPC"
grep -Fq 'stopSupportSession:' "$RPC"
grep -Fq 'restoreSupportBackup:' "$RPC"
grep -Fq 'client_ready:' "$RPC"
grep -Fq "params: [ 'mode', 'duration', 'consent' ]" "$HELP"
grep -Fq 'Pinggy' "$HELP"
grep -Fq 'Скопировать команду' "$HELP"
grep -Fq 'tcp@free.pinggy.io' "$RUNTIME"
grep -Fq '127.0.0.1:22022' "$RUNTIME"
grep -Fq 'no-port-forwarding,no-agent-forwarding,no-X11-forwarding' "$RUNTIME"
grep -Fq 'Время сеанса истекло' "$RUNTIME"
grep -Fq 'cleanup-boot)' "$RUNTIME"
grep -Fq 'stop remote' "$ROOT/luci-app-oum/root/usr/libexec/oum-support-shell"
grep -Fq 'restoreSupportBackup' "$HELP"
grep -Fq 'Откатить изменения поддержки' "$HELP"
grep -Fq 'oum-support cleanup-boot' "$ROOT/luci-app-oum/root/etc/init.d/oum-support"
grep -Fq '+openssh-client' "$ROOT/luci-app-oum/Makefile"

TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT INT TERM
mkdir -p "$TMP/state" "$TMP/persist" "$TMP/dropbear" "$TMP/config"
printf 'original-key\n' >"$TMP/dropbear/authorized_keys"
printf 'network-original\n' >"$TMP/config/network"
printf 'ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAITestOnlySupportKey oum-test\n' >"$TMP/support_key.pub"
cat >"$TMP/ssh" <<'EOF'
#!/bin/sh
if [ "${1:-}" = -V ]; then echo 'OpenSSH_10.0'; exit 0; fi
echo 'tcp://test-tunnel.a.free.pinggy.link:34567'
trap 'exit 0' TERM INT
while :; do sleep 1; done
EOF
chmod 755 "$TMP/ssh"
cat >"$TMP/dropbear-bin" <<'EOF'
#!/bin/sh
trap 'exit 0' TERM INT
while :; do sleep 1; done
EOF
chmod 755 "$TMP/dropbear-bin"
cat >"$TMP/sysupgrade" <<'EOF'
#!/bin/sh
[ "$1" = -b ] || exit 2
printf 'backup\n' >"$2"
EOF
chmod 755 "$TMP/sysupgrade"

SUPPORT_ENV="OUM_SUPPORT_STATE_DIR=$TMP/state OUM_SUPPORT_PERSIST_DIR=$TMP/persist OUM_SUPPORT_KEYS_FILE=$TMP/dropbear/authorized_keys OUM_SUPPORT_PUBLIC_KEY_FILE=$TMP/support_key.pub OUM_SUPPORT_CONFIG_DIR=$TMP/config OUM_SUPPORT_SSH=$TMP/ssh OUM_SUPPORT_DROPBEAR=$TMP/dropbear-bin OUM_SUPPORT_SYSUPGRADE=$TMP/sysupgrade OUM_SUPPORT_START_DELAY=0 OUM_SUPPORT_DISCOVERY_TRIES=2 OUM_SUPPORT_NO_WATCH=1"
cat >"$TMP/state/request" <<EOF
mode=repair
started_at=$(date +%s)
expires_at=$(($(date +%s) + 300))
EOF
env $SUPPORT_ENV "$RUNTIME" start
grep -Fq 'state=active' "$TMP/state/status"
grep -Fq 'hostname=test-tunnel.a.free.pinggy.link' "$TMP/state/status"
grep -Fq 'port=34567' "$TMP/state/status"
grep -Fq 'connect_command=ssh -p 34567 root@test-tunnel.a.free.pinggy.link' "$TMP/state/status"
grep -Fq 'oum-support-' "$TMP/dropbear/authorized_keys"
grep -Fq 'no-port-forwarding,no-agent-forwarding,no-X11-forwarding' "$TMP/dropbear/authorized_keys"
[ -s "$TMP/persist/pre-support-backup.tar.gz" ]
cp "$TMP/state/status" "$TMP/active.status"
! env $SUPPORT_ENV "$RUNTIME" start >/dev/null 2>&1
cmp "$TMP/active.status" "$TMP/state/status"
printf 'network-changed\n' >"$TMP/config/network"
env $SUPPORT_ENV "$RUNTIME" stop user
grep -Fxq 'original-key' "$TMP/dropbear/authorized_keys"
grep -Fq 'changed_configs=1' "$TMP/persist/audit.log"

printf 'original-key\nssh-ed25519 TEST oum-support-stale\n' >"$TMP/dropbear/authorized_keys"
env $SUPPORT_ENV "$RUNTIME" cleanup-boot
grep -Fxq 'original-key' "$TMP/dropbear/authorized_keys"
! grep -Fq 'oum-support-' "$TMP/dropbear/authorized_keys"

printf 'remote support contracts: OK\n'
