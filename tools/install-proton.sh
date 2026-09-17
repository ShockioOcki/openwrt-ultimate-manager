#!/bin/sh
set -eu

SOURCE_DIR="${1:-luci-app-oum}"
PROTON_PACKAGE="$SOURCE_DIR/root/usr/share/oum/packages/proton2025/luci-theme-proton2025-1.4.1-r1.apk"
PROTON_SHA256='01a779aad7e26fec6e9ad4dde00cec9b0f44883b9c09b88083a498a6108fbb97'
DEFAULTS="$SOURCE_DIR/root/usr/share/oum/proton2025.defaults"

# Verify the bundled official release even when an installed version is retained.
printf '%s  %s\n' "$PROTON_SHA256" "$PROTON_PACKAGE" | sha256sum -c -
if ! apk info -e luci-theme-proton2025 >/dev/null 2>&1; then
	apk add --allow-untrusted "$PROTON_PACKAGE"
fi
test -s /usr/share/ucode/luci/template/themes/proton2025/header.ut
test -s /www/luci-static/proton2025/js/settings-sync.js

mkdir -p /etc/oum
# Apply the supplied visual profile once; later updates preserve user changes.
if [ ! -f /etc/oum/proton-defaults-applied ]; then
	uci -m import proton2025 < "$DEFAULTS"
	uci commit proton2025
	printf '%s\n' '20260917' > /etc/oum/proton-defaults-applied
fi
uci set luci.main.mediaurlbase='/luci-static/proton2025'
uci commit luci
printf '%s\n' 'Proton2025 installed and selected for standard LuCI.'
