#!/bin/sh

set -eu

ROOT="$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)"
RPC="$ROOT/luci-app-oum/root/usr/share/rpcd/ucode/oum"
DASHBOARD="$ROOT/luci-app-oum/htdocs/luci-static/resources/view/oum/dashboard-v43.js"
ACL="$ROOT/luci-app-oum/root/usr/share/rpcd/acl.d/luci-app-oum.json"

grep -Fq 'setDeviceAlias:' "$RPC"
grep -Fq "uci.set('oum', section, 'alias', alias)" "$RPC"
grep -Fq "uci.delete('oum', section, 'alias')" "$RPC"
grep -Fq "!deviceSectionHasState(uci, section)" "$RPC"
grep -Fq "name: aliases[mac] ?? dhcpNames[mac]" "$RPC"
grep -Fq "!match(leaseName, /^android-[0-9a-f]+$/i)" "$RPC"
! sed -n '/setDevicePolicy:/,/nodeStatus:/p' "$RPC" | grep -Fq "uci.set('oum', section, 'name'"

grep -Fq 'callSetDeviceAlias' "$DASHBOARD"
grep -Fq 'data-device-alias-input' "$DASHBOARD"
grep -Fq "ev.key === 'Enter'" "$DASHBOARD"
grep -Fq "ev.key === 'Escape'" "$DASHBOARD"
grep -Fq 'setDeviceAlias' "$ACL"

if command -v node >/dev/null 2>&1; then
	node <<'NODE'
function validDeviceAlias(alias) {
	return Array.from(alias).length <= 32 && /^[\p{L}\p{N} _.\-]*$/u.test(alias);
}
const valid = ['', 'Ноутбук', 'S22 Ultra', 'PC-01.home', 'Мария_5'];
const invalid = ['<script>', 'line\nbreak', 'x'.repeat(33), 'Телефон📱'];
for (const value of valid) {
	if (!validDeviceAlias(value)) throw new Error(`valid alias rejected: ${JSON.stringify(value)}`);
}
for (const value of invalid) {
	if (validDeviceAlias(value)) throw new Error(`invalid alias accepted: ${JSON.stringify(value)}`);
}
NODE
fi

printf 'device alias tests: OK\n'
