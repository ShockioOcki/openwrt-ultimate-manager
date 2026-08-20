#!/bin/sh

set -eu

ROOT="$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT INT TERM
mkdir -p "$TMP/bin"

cat > "$TMP/bin/uci" <<'EOF'
#!/bin/sh
case "$*" in
  *oum.main.active_source*) printf '%s\n' subscription ;;
  *openclash.oum_subscription_info.url*) printf '%s\n' 'https://subscription.invalid/test' ;;
  *) exit 1 ;;
esac
EOF

cat > "$TMP/bin/curl" <<'EOF'
#!/bin/sh
headers=''
while [ "$#" -gt 0 ]; do
  case "$1" in
    -D) headers="$2"; shift 2 ;;
    *) shift ;;
  esac
done
[ -n "$headers" ] || exit 2
printf 'HTTP/2 200\r\n%s\r\n' "${OUM_TEST_HEADER:-}" > "$headers"
EOF
chmod 755 "$TMP/bin/uci" "$TMP/bin/curl"

run_helper() {
  PATH="$TMP/bin:$PATH" \
  OUM_SUBSCRIPTION_TEMP_PREFIX="$TMP/runtime" \
  OUM_SUBSCRIPTION_CACHE="$TMP/cache.json" \
  "$ROOT/luci-app-oum/root/usr/libexec/oum-subscription-info"
}

OUM_TEST_HEADER='Subscription-Userinfo: upload=10; download=20; total=100; expire=2000000000' \
  run_helper
grep -q '"available":true' "$TMP/cache.json"
grep -q '"upload":10,"download":20,"total":100,"expire":2000000000' "$TMP/cache.json"

OUM_TEST_HEADER='' run_helper
grep -q '"available":false' "$TMP/cache.json"

printf '%s\n' 'subscription info tests: OK'
