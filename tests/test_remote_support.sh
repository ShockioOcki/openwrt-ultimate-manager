#!/bin/sh
set -eu

ROOT="$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)"
RPC="$ROOT/luci-app-oum/root/usr/share/rpcd/ucode/oum"
ACL="$ROOT/luci-app-oum/root/usr/share/rpcd/acl.d/luci-app-oum.json"
HELP="$ROOT/luci-app-oum/htdocs/luci-static/resources/view/oum/help-v3.js"
RUNTIME="$ROOT/luci-app-oum/root/usr/libexec/oum-support"
SUPPORT_SHELL="$ROOT/luci-app-oum/root/usr/libexec/oum-support-shell"

grep -Fq 'supportStatus:' "$RPC"
grep -Fq 'startSupportSession:' "$RPC"
grep -Fq 'stopSupportSession:' "$RPC"
grep -Fq 'restoreSupportBackup:' "$RPC"
grep -Fq 'client_ready:' "$RPC"
grep -Fq "params: [ 'mode', 'duration', 'consent' ]" "$HELP"
grep -Fq 'Pinggy' "$HELP"
grep -Fq 'Скопировать команду' "$HELP"
grep -Fq 'Веб-интерфейс через SSH' "$HELP"
grep -Fq 'support.web_command' "$HELP"
grep -Fq 'tcp@free.pinggy.io' "$RUNTIME"
grep -Fq '127.0.0.1:22022' "$RUNTIME"
grep -Fq 'web_command="ssh -N -L 8080:127.0.0.1:80' "$RUNTIME"
grep -Fq "forward_flags='-j -k'" "$RUNTIME"
grep -Fq "forward_flags='-k'" "$RUNTIME"
grep -Fq 'permitopen="127.0.0.1:80"' "$RUNTIME"
grep -Fq 'no-port-forwarding,no-agent-forwarding,no-X11-forwarding' "$RUNTIME"
grep -Fq -- '-D "$AUTH_DIR"' "$RUNTIME"
grep -Fq 'Время сеанса истекло' "$RUNTIME"
grep -Fq 'cleanup-boot)' "$RUNTIME"
grep -Fq 'stop remote' "$ROOT/luci-app-oum/root/usr/libexec/oum-support-shell"
grep -Fq 'sanitized_summary' "$ROOT/luci-app-oum/root/usr/libexec/oum-support-shell"
! grep -Fq 'ubus call oum dashboardStatus 2>/dev/null || true' "$ROOT/luci-app-oum/root/usr/libexec/oum-support-shell"
grep -Fq 'restoreSupportBackup' "$HELP"
grep -Fq 'Откатить изменения поддержки' "$HELP"
grep -Fq 'oum-support cleanup-boot' "$ROOT/luci-app-oum/root/etc/init.d/oum-support"
grep -Fq '+openssh-client' "$ROOT/luci-app-oum/Makefile"
grep -Fq 'oum-support-2026-09' "$ROOT/luci-app-oum/root/etc/oum/support/support_key.pub"
grep -Fq 'oum-support-repair-shell" /usr/libexec/oum-support-repair-shell' "$ROOT/tools/install-luci-dev.sh"
grep -Fq 'support_key.pub" /etc/oum/support/support_key.pub' "$ROOT/tools/install-luci-dev.sh"

TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT INT TERM
mkdir -p "$TMP/state" "$TMP/persist" "$TMP/dropbear" "$TMP/support-auth" "$TMP/config"
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

SUPPORT_ENV="OUM_SUPPORT_STATE_DIR=$TMP/state OUM_SUPPORT_PERSIST_DIR=$TMP/persist OUM_SUPPORT_KEYS_FILE=$TMP/support-auth/authorized_keys OUM_SUPPORT_PUBLIC_KEY_FILE=$TMP/support_key.pub OUM_SUPPORT_CONFIG_DIR=$TMP/config OUM_SUPPORT_SSH=$TMP/ssh OUM_SUPPORT_DROPBEAR=$TMP/dropbear-bin OUM_SUPPORT_SYSUPGRADE=$TMP/sysupgrade OUM_SUPPORT_START_DELAY=0 OUM_SUPPORT_DISCOVERY_TRIES=2 OUM_SUPPORT_NO_WATCH=1"
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
grep -Fq 'web_command=ssh -N -L 8080:127.0.0.1:80 -p 34567 root@test-tunnel.a.free.pinggy.link' "$TMP/state/status"
grep -Fq 'web_url=http://127.0.0.1:8080/cgi-bin/luci/' "$TMP/state/status"
grep -Fq 'oum-support-' "$TMP/support-auth/authorized_keys"
grep -Fxq 'original-key' "$TMP/dropbear/authorized_keys"
grep -Fq 'no-agent-forwarding,no-X11-forwarding' "$TMP/support-auth/authorized_keys"
grep -Fq 'permitopen="127.0.0.1:80"' "$TMP/support-auth/authorized_keys"
! grep -Fq 'no-port-forwarding' "$TMP/support-auth/authorized_keys"
[ -s "$TMP/persist/pre-support-backup.tar.gz" ]
cp "$TMP/state/status" "$TMP/active.status"
! env $SUPPORT_ENV "$RUNTIME" start >/dev/null 2>&1
cmp "$TMP/active.status" "$TMP/state/status"
printf 'network-changed\n' >"$TMP/config/network"
env $SUPPORT_ENV "$RUNTIME" stop user
grep -Fxq 'original-key' "$TMP/dropbear/authorized_keys"
! test -e "$TMP/support-auth/authorized_keys"
grep -Fxq 'connect_command=' "$TMP/state/status"
grep -Fxq 'web_command=' "$TMP/state/status"
grep -Fxq 'web_url=' "$TMP/state/status"
grep -Fq 'changed_configs=1' "$TMP/persist/audit.log"

cat >"$TMP/state/request" <<EOF
mode=diagnostic
started_at=$(date +%s)
expires_at=$(($(date +%s) + 300))
EOF
env $SUPPORT_ENV "$RUNTIME" start
grep -Fxq 'web_command=' "$TMP/state/status"
grep -Fxq 'web_url=' "$TMP/state/status"
grep -Fq 'no-port-forwarding' "$TMP/support-auth/authorized_keys"
env $SUPPORT_ENV "$RUNTIME" stop user

printf 'ssh-ed25519 TEST oum-support-stale\n' >"$TMP/support-auth/authorized_keys"
env $SUPPORT_ENV "$RUNTIME" cleanup-boot
grep -Fxq 'original-key' "$TMP/dropbear/authorized_keys"
! test -e "$TMP/support-auth/authorized_keys"

mkdir -p "$TMP/bin"
cat >"$TMP/bin/ubus" <<'EOF'
#!/bin/sh
case "$*" in
	'system board') printf '%s\n' board ;;
	'network.interface.wan status') printf '%s\n' wan ;;
	'oum dashboardStatus') printf '%s\n' dashboard ;;
esac
EOF
cat >"$TMP/bin/jsonfilter" <<'EOF'
#!/bin/sh
while [ "$#" -gt 0 ]; do
	[ "$1" != -e ] || { expression="$2"; break; }
	shift
done
case "$expression" in
	'@.model') echo 'Test Router' ;;
	'@.kernel') echo '6.12-test' ;;
	'@.release.version') echo '25.12-test' ;;
	'@.up') echo true ;;
	'@.vpn_engine') echo passwall ;;
	'@.vpn_enabled'|'@.vpn_ready') echo true ;;
esac
EOF
cat >"$TMP/bin/logread" <<'EOF'
#!/bin/sh
echo 'oum ssid=ax6s peer=192.168.5.20 mac=08:BF:B8:84:FF:43 token=abcdefghijklmnopqrstuvwxyz123456 url=vless://secret@example.test'
EOF
chmod 755 "$TMP/bin/ubus" "$TMP/bin/jsonfilter" "$TMP/bin/logread"
PATH="$TMP/bin:$PATH" SSH_ORIGINAL_COMMAND=summary "$SUPPORT_SHELL" >"$TMP/summary"
PATH="$TMP/bin:$PATH" SSH_ORIGINAL_COMMAND=logs "$SUPPORT_SHELL" >"$TMP/logs"
grep -Fq 'model: Test Router' "$TMP/summary"
grep -Fq 'vpn_engine: passwall' "$TMP/summary"
! grep -Fq 'ax6s' "$TMP/summary"
! grep -Eq 'ax6s|192\.168\.5\.20|08:BF:B8:84:FF:43|abcdefghijklmnopqrstuvwxyz123456|secret@example' "$TMP/logs"
grep -Fq 'ssid=<redacted>' "$TMP/logs"
grep -Fq 'peer=<ip>' "$TMP/logs"
grep -Fq 'mac=<mac>' "$TMP/logs"

printf 'remote support contracts: OK\n'
