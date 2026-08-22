#!/bin/sh

set -eu

ROOT="$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)"
TEMP="$(mktemp -d)"
trap 'rm -rf "$TEMP"' EXIT INT TERM
mkdir -p "$TEMP/bin"

printf "%s\n" "let scope = { duser: 'root', fuser: user };" > "$TEMP/dispatcher.uc"
printf '%s\n' '#!/bin/sh' 'exit 0' > "$TEMP/bin/ucode"
chmod 755 "$TEMP/bin/ucode"

PATH="$TEMP/bin:$PATH" OUM_DISPATCHER="$TEMP/dispatcher.uc" \
	"$ROOT/luci-app-oum/root/usr/libexec/oum-login-default"
PATH="$TEMP/bin:$PATH" OUM_DISPATCHER="$TEMP/dispatcher.uc" \
	"$ROOT/luci-app-oum/root/usr/libexec/oum-login-default"

grep -Fq "resolved.ctx.request_path?.[0] == 'oum'" "$TEMP/dispatcher.uc"
[ "$(grep -Fc '/* OUM default login */' "$TEMP/dispatcher.uc")" -eq 1 ]

printf '%s\n' 'OUM login default tests: OK'
