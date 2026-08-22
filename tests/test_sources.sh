#!/bin/sh
set -eu

ROOT="$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)"
TMP="${TMPDIR:-/tmp}/oum-tests.$$"
mkdir -p "$TMP"
trap 'find "$TMP" -type f -exec rm -f {} \; 2>/dev/null; rmdir "$TMP" 2>/dev/null || true' EXIT INT TERM

ruby "$ROOT/helpers/source_converter.rb" awg "$ROOT/tests/fixtures/awg-v2.conf" "$TMP/awg.yaml" OUM-AWG
ruby -ryaml -e '
  data = YAML.load_file(ARGV[0]); node = data.fetch("proxies").first
  abort "wrong type" unless node["type"] == "wireguard"
  abort "DNS leaked" if node.key?("dns")
  opts = node.fetch("amnezia-wg-option")
  abort "H1 range lost" unless opts["h1"] == "790258072-1982978769"
  abort "wrong AWG version" unless opts["version"] == 2
  abort "I1 lost" unless opts["i1"].include?("0x01020304")
' "$TMP/awg.yaml"

ruby "$ROOT/helpers/source_converter.rb" uris "$ROOT/tests/fixtures/nodes.txt" "$TMP/nodes.yaml"
ruby -ryaml -e '
  nodes = YAML.load_file(ARGV[0]).fetch("proxies")
  abort "wrong node count" unless nodes.length == 2
  vless = nodes.find { |node| node["type"] == "vless" }
  abort "Reality missing" unless vless.dig("reality-opts", "short-id") == "0102030405060708"
  abort "flow missing" unless vless["flow"] == "xtls-rprx-vision"
  abort "encryption missing" unless vless["encryption"] == "none"
  abort "ALPN missing" unless vless["alpn"] == ["h2", "http/1.1"]
  abort "insecure flag missing" unless vless["skip-cert-verify"] == true
  abort "Hysteria2 missing" unless nodes.any? { |node| node["type"] == "hysteria2" }
' "$TMP/nodes.yaml"

ruby "$ROOT/helpers/source_converter.rb" subscription "$ROOT/tests/fixtures/nodes-filter.txt" "$TMP/filtered.yaml"
ruby -ryaml -e '
  nodes = YAML.load_file(ARGV[0]).fetch("proxies")
  abort "subscription node filter failed" unless nodes.map { |node| node["name"] } == ["KEEP"]
' "$TMP/filtered.yaml"

ruby "$ROOT/helpers/source_converter.rb" subscription "$ROOT/tests/fixtures/subscription-clash.yaml" "$TMP/clash-subscription.yaml"
ruby -ryaml -e '
  nodes = YAML.safe_load_file(ARGV[0], aliases: true).fetch("proxies")
  abort "Clash YAML subscription import failed" unless nodes.map { |node| node["name"] } == ["KEEP-YAML"]
' "$TMP/clash-subscription.yaml"

ruby "$ROOT/helpers/source_converter.rb" uris "$ROOT/tests/fixtures/subscription-base64.txt" "$TMP/subscription.yaml"
ruby -ryaml -e 'abort "base64 subscription failed" unless YAML.load_file(ARGV[0]).fetch("proxies").length == 2' "$TMP/subscription.yaml"

ruby "$ROOT/helpers/source_converter.rb" standalone "$TMP/standalone.yaml" "$TMP/awg.yaml" awg
ruby -ryaml -e '
  config = YAML.load_file(ARGV[0])
  abort "standalone proxies were not embedded" unless config.fetch("proxies").length == 1
  abort "standalone still depends on a provider" if config.key?("proxy-providers")
  groups = config.fetch("proxy-groups")
  abort "AWG_Tunnel group missing" unless groups.any? { |item| item["name"] == "AWG_Tunnel" }
  abort "PROXY does not select AWG_Tunnel" unless groups.find { |item| item["name"] == "PROXY" }.fetch("proxies").include?("AWG_Tunnel")
  abort "unexpected AWG node rename" unless config.fetch("proxies").first["name"] == "OUM-AWG"
  abort "mass rule providers missing" unless config.fetch("rule-providers").key?("ru-blocked-domains")
  abort "mass routing missing" unless config.fetch("rules").include?("RULE-SET,google-play,DIRECT")
  abort "Samsung must be direct" unless config.fetch("rules").include?("RULE-SET,samsung,DIRECT")
  abort "Meta must use its selector" unless config.fetch("rules").include?("RULE-SET,meta-domains,META")
  abort "unexpected torrent block" if config.fetch("rules").any? { |rule| rule.downcase.include?("torrent") }
' "$TMP/standalone.yaml"

ruby "$ROOT/helpers/source_converter.rb" awg "$ROOT/tests/fixtures/awg-v2.conf" "$TMP/awg-collision.yaml" AWG_Tunnel
ruby "$ROOT/helpers/source_converter.rb" standalone "$TMP/collision-profile.yaml" "$TMP/awg-collision.yaml" awg
ruby -ryaml -e '
  config = YAML.load_file(ARGV[0])
  abort "group/node collision remains" if config.fetch("proxies").first["name"] == "AWG_Tunnel"
' "$TMP/collision-profile.yaml"

printf 'source converter tests: OK\n'
