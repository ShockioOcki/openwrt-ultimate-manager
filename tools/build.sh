#!/bin/sh
set -eu

ROOT="$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)"
OUT="$ROOT/dist/oum-test.sh"
TMP="$OUT.tmp"
mkdir -p "$ROOT/dist"

{
    cat "$ROOT/src/header.sh"
    cat "$ROOT/src/core/common.sh"
    cat "$ROOT/src/core/platform.sh"
    cat "$ROOT/src/modules/install.sh"
    printf '%s\n' 'oum_write_source_converter() {' '    destination="$1"' "    cat > \"\$destination\" <<'OUM_RUBY_EOF'"
    cat "$ROOT/helpers/source_converter.rb"
    printf '%s\n' 'OUM_RUBY_EOF' '}'
    cat "$ROOT/src/modules/sources.sh"
    cat "$ROOT/src/modules/network.sh"
    cat "$ROOT/src/modules/diagnostics.sh"
    cat "$ROOT/src/ui/main.sh"
} > "$TMP"

chmod 755 "$TMP"
mv "$TMP" "$OUT"
printf 'Built %s\n' "$OUT"
