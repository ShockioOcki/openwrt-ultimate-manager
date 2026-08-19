#!/bin/sh
set -eu
ROOT="$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)"
"$ROOT/tools/build.sh"
sh -n "$ROOT/dist/oum-test.sh"
ruby -c "$ROOT/helpers/source_converter.rb"
printf 'syntax tests: OK\n'
