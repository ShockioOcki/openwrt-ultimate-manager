#!/bin/sh
set -eu

ROOT="$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)"
HEADER="$ROOT/tools/oum-install-header.sh"
OUTPUT="$ROOT/dist/oum-install.sh"
BUILD_DIR="$(mktemp -d)"
PAYLOAD="$BUILD_DIR/oum-payload.tar.gz"
PACKAGE="$BUILD_DIR/package"

cleanup() {
	rm -rf "$BUILD_DIR"
}
trap cleanup EXIT INT TERM

[ -f "$HEADER" ] || { echo "Installer header not found: $HEADER" >&2; exit 1; }
"$ROOT/tools/build.sh"

mkdir -p "$PACKAGE/tools" "$PACKAGE/dist" "$PACKAGE/helpers"
cp -R "$ROOT/luci-app-oum" "$PACKAGE/luci-app-oum"
cp -R "$ROOT/luci-theme-oum" "$PACKAGE/luci-theme-oum"
cp "$ROOT/tools/install-luci-dev.sh" "$PACKAGE/tools/install-luci-dev.sh"
cp "$ROOT/tools/install-theme-dev.sh" "$PACKAGE/tools/install-theme-dev.sh"
cp "$ROOT/dist/oum-test.sh" "$PACKAGE/dist/oum-test.sh"
cp "$ROOT/helpers/source_converter.rb" "$PACKAGE/helpers/source_converter.rb"

find "$PACKAGE" -type f -exec touch -h -t 202001010000.00 {} +
tar -czf "$PAYLOAD" -C "$PACKAGE" .
PAYLOAD_SHA256="$(sha256sum "$PAYLOAD" | awk '{ print $1 }')"
PAYLOAD_SIZE="$(wc -c <"$PAYLOAD" | tr -d ' ')"
INSTALLER_VERSION="$(
	find "$PACKAGE" -type f -print0 | sort -z | xargs -0 sha256sum | sha256sum | cut -c1-12
)"

sed \
	-e "s/@OUM_INSTALLER_VERSION@/$INSTALLER_VERSION/g" \
	-e "s/@OUM_PAYLOAD_SHA256@/$PAYLOAD_SHA256/g" \
	-e "s/@OUM_PAYLOAD_SIZE@/$PAYLOAD_SIZE/g" \
	"$HEADER" >"$OUTPUT.tmp"
cat "$PAYLOAD" >>"$OUTPUT.tmp"
chmod 700 "$OUTPUT.tmp"
mv "$OUTPUT.tmp" "$OUTPUT"

printf 'Built %s (%s)\n' "$OUTPUT" "$INSTALLER_VERSION"
