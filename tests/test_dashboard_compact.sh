#!/bin/sh

set -eu

ROOT="$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)"
DASHBOARD="$ROOT/luci-app-oum/htdocs/luci-static/resources/view/oum/dashboard-v11.js"
RPC="$ROOT/luci-app-oum/root/usr/share/rpcd/ucode/oum"
QR="$ROOT/luci-app-oum/htdocs/luci-static/resources/view/oum/qrcode.min.js"

grep -Fq "password_set: length(iface.key ?? '') > 0" "$RPC"
grep -Fq 'Показать QR' "$DASHBOARD"
grep -Fq 'Наведи камерой телефона' "$DASHBOARD"
grep -Fq 'WIFI:T:WPA' "$DASHBOARD"
grep -Fq "load('qrcode.min.js')" "$DASHBOARD"
grep -Fq 'Выбрать ноду' "$DASHBOARD"
grep -Fq 'Список нод (' "$DASHBOARD"
! grep -Fq "E('div', { 'class': 'oum-node-title' }, 'Быстрый доступ')" "$DASHBOARD"
! grep -Fq "id: 'subscription-progress'" "$DASHBOARD"
test -s "$QR"
test -s "$QR.LICENSE.txt"

if command -v node >/dev/null 2>&1; then
	node - "$QR" <<'NODE'
const qrcode = require(process.argv[2]);
qrcode.stringToBytes = qrcode.stringToBytesFuncs['UTF-8'];
const code = qrcode(0, 'M');
code.addData('WIFI:T:WPA;S:ax6s;P:пароль-123;;', 'Byte');
code.make();
if (code.getModuleCount() < 21 || !code.isDark(0, 0)) throw new Error('QR generation failed');
NODE
fi

printf 'compact dashboard tests: OK\n'
