#!/bin/sh
# Generated from modular sources. Do not edit dist/oum-test.sh directly.
OUM_VERSION="0.0.4"
OUM_STATE_DIR="/etc/oum"
OUM_BACKUP_DIR="/root/oum-backups"
OUM_TMP_DIR="/tmp/oum.$$"
OPENCLASH_DIR="/etc/openclash"
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[1;36m'
NC='\033[0m'

oum_err() { printf "${RED}✗ %s${NC}\n" "$*" >&2; }
oum_ok() { printf "${GREEN}✓ %s${NC}\n" "$*"; }
oum_info() { printf "${CYAN}ℹ %s${NC}\n" "$*"; }
oum_warn() { printf "${YELLOW}⚠ %s${NC}\n" "$*" >&2; }

oum_header() {
    clear 2>/dev/null || true
    printf "${CYAN}==================================================${NC}\n"
    printf "${GREEN} OUM v%s — тестовая OpenClash Edition${NC}\n" "$OUM_VERSION"
    printf "${CYAN}==================================================${NC}\n"
}

oum_pause() {
    printf "\n${YELLOW}Нажмите Enter для продолжения...${NC}"
    IFS= read -r _
}

oum_check_root() {
    [ "$(id -u)" -eq 0 ] || { oum_err "Запускайте OUM от root"; exit 1; }
}

oum_prepare_dirs() {
    umask 077
    mkdir -p "$OUM_STATE_DIR" "$OUM_BACKUP_DIR" "$OUM_TMP_DIR"
    chmod 700 "$OUM_STATE_DIR" "$OUM_BACKUP_DIR" "$OUM_TMP_DIR" 2>/dev/null || true
}

oum_cleanup() {
    [ -n "${OUM_TMP_DIR:-}" ] && [ -d "$OUM_TMP_DIR" ] && find "$OUM_TMP_DIR" -mindepth 1 -maxdepth 1 -exec rm -f {} \; 2>/dev/null
    rmdir "$OUM_TMP_DIR" 2>/dev/null || true
}
trap oum_cleanup EXIT INT TERM

oum_log() {
    # Передавать сюда только сообщения без URL, UUID и ключей.
    mkdir -p /var/log/oum
    printf '%s %s\n' "$(date '+%Y-%m-%d %H:%M:%S')" "$*" >> /var/log/oum/oum.log
}

oum_read_secret() {
    prompt="$1"
    printf '%s' "$prompt" >&2
    if [ -t 0 ] && command -v stty >/dev/null 2>&1; then
        stty -echo
        IFS= read -r value
        stty echo
        printf '\n' >&2
    else
        IFS= read -r value
    fi
    printf '%s' "$value"
}

oum_download() {
    url="$1"
    destination="$2"
    if command -v curl >/dev/null 2>&1; then
        curl -fL --connect-timeout 15 --retry 3 --retry-delay 2 -o "$destination" "$url"
    else
        wget -qO "$destination" "$url"
    fi
    [ -s "$destination" ]
}

oum_backup_system() {
    oum_prepare_dirs
    backup="$OUM_BACKUP_DIR/system-$(date +%Y%m%d-%H%M%S).tar.gz"
    if sysupgrade -b "$backup" 2>/dev/null; then
        chmod 600 "$backup"
        oum_ok "Резервная копия: $backup"
        return 0
    fi
    oum_err "Не удалось создать резервную копию"
    return 1
}
oum_pkg_manager() {
    if command -v apk >/dev/null 2>&1; then
        printf '%s\n' apk
    elif command -v opkg >/dev/null 2>&1; then
        printf '%s\n' opkg
    else
        return 1
    fi
}

oum_pkg_installed() {
    pkg="$1"
    case "$(oum_pkg_manager 2>/dev/null)" in
        apk) apk info -e "$pkg" >/dev/null 2>&1 ;;
        opkg) opkg list-installed 2>/dev/null | grep -q "^${pkg} " ;;
        *) return 1 ;;
    esac
}

oum_require_runtime() {
    missing=""
    for command_name in ruby uci; do
        command -v "$command_name" >/dev/null 2>&1 || missing="$missing $command_name"
    done
    if [ -n "$missing" ]; then
        oum_err "Не найдены зависимости:$missing"
        oum_info "Для импортёров необходимы ruby и ruby-yaml"
        return 1
    fi
}

oum_openclash_config() {
    config_path="$(uci -q get openclash.config.config_path 2>/dev/null)"
    if [ -n "$config_path" ] && [ -f "$config_path" ]; then
        printf '%s\n' "$config_path"
        return 0
    fi
    for config_path in "$OPENCLASH_DIR"/config/*.yaml "$OPENCLASH_DIR"/config/*.yml; do
        [ -f "$config_path" ] && { printf '%s\n' "$config_path"; return 0; }
    done
    return 1
}

oum_mihomo_core() {
    for core in "$OPENCLASH_DIR/core/clash_meta" "$OPENCLASH_DIR/core/mihomo" "$OPENCLASH_DIR/core/clash"; do
        [ -x "$core" ] && { printf '%s\n' "$core"; return 0; }
    done
    return 1
}
OPENCLASH_VERSION="0.47.156"
OPENCLASH_APK_URL="https://github.com/vernesong/OpenClash/releases/download/v0.47.156/luci-app-openclash-0.47.156.apk"
OPENCLASH_APK_SHA256="1e4f330fc654e0270ac9cfa762af221335567d9b89388219890e8a7745b914ab"
OPENCLASH_IPK_URL="https://github.com/vernesong/OpenClash/releases/download/v0.47.156/luci-app-openclash_0.47.156_all.ipk"
OPENCLASH_IPK_SHA256="b5d48ef26cb6de2942c3573e27b74490d354c0cfadaf24afe748daf806434eed"
MIHOMO_VERSION="1.19.30"
MIHOMO_ARM64_URL="https://github.com/MetaCubeX/mihomo/releases/download/v1.19.30/mihomo-linux-arm64-v1.19.30.gz"
MIHOMO_ARM64_SHA256="58896873736d28628f66de3677c8654fa0f180662523148e136cff4f6e890069"

oum_verify_sha256() {
    file="$1"
    expected="$2"
    actual="$(sha256sum "$file" 2>/dev/null | awk '{print $1}')"
    [ "$actual" = "$expected" ] || {
        oum_err "Контрольная сумма загруженного файла не совпала"
        return 1
    }
}

oum_install_mihomo() {
    case "$(uname -m)" in
        aarch64|arm64) core_url="$MIHOMO_ARM64_URL"; core_sha="$MIHOMO_ARM64_SHA256" ;;
        *) oum_err "Для архитектуры $(uname -m) в тестовой версии нет закреплённого ядра"; return 1 ;;
    esac
    archive="$OUM_TMP_DIR/mihomo.gz"
    core_tmp="$OUM_TMP_DIR/clash_meta"
    oum_info "Загружаем Mihomo $MIHOMO_VERSION"
    oum_download "$core_url" "$archive" || { oum_err "Не удалось загрузить Mihomo"; return 1; }
    oum_verify_sha256 "$archive" "$core_sha" || return 1
    gzip -dc "$archive" > "$core_tmp" || return 1
    chmod 755 "$core_tmp"
    mkdir -p "$OPENCLASH_DIR/core"
    mv "$core_tmp" "$OPENCLASH_DIR/core/clash_meta"
    chmod 755 "$OPENCLASH_DIR/core/clash_meta"
    "$OPENCLASH_DIR/core/clash_meta" -v >/dev/null 2>&1 || {
        oum_err "Загруженное ядро Mihomo не запускается"
        return 1
    }
}

oum_install_openclash() {
    oum_header
    oum_prepare_dirs
    if oum_pkg_installed luci-app-openclash && oum_require_runtime && oum_mihomo_core >/dev/null 2>&1; then
        oum_ok "OpenClash, Ruby и Mihomo уже установлены"
        return 0
    fi

    oum_info "Первичная установка OpenClash $OPENCLASH_VERSION"
    case "$(oum_pkg_manager 2>/dev/null)" in
        apk)
            package_file="$OUM_TMP_DIR/openclash.apk"
            apk update || { oum_err "Не удалось обновить индекс пакетов"; return 1; }
            oum_download "$OPENCLASH_APK_URL" "$package_file" || return 1
            oum_verify_sha256 "$package_file" "$OPENCLASH_APK_SHA256" || return 1
            apk add --allow-untrusted "$package_file" || { oum_err "Не удалось установить OpenClash"; return 1; }
            ;;
        opkg)
            package_file="$OUM_TMP_DIR/openclash.ipk"
            opkg update || { oum_err "Не удалось обновить индекс пакетов"; return 1; }
            oum_download "$OPENCLASH_IPK_URL" "$package_file" || return 1
            oum_verify_sha256 "$package_file" "$OPENCLASH_IPK_SHA256" || return 1
            opkg install "$package_file" || { oum_err "Не удалось установить OpenClash"; return 1; }
            ;;
        *) oum_err "Пакетный менеджер OpenWrt не найден"; return 1 ;;
    esac

    oum_require_runtime || return 1
    oum_install_mihomo || return 1
    mkdir -p "$OPENCLASH_DIR/config" "$OPENCLASH_DIR/rule_provider"
    /etc/init.d/openclash stop >/dev/null 2>&1 || true
    /etc/init.d/openclash disable >/dev/null 2>&1 || true
    /etc/init.d/rpcd restart >/dev/null 2>&1 || true
    /etc/init.d/uhttpd restart >/dev/null 2>&1 || true
    oum_ok "OpenClash $OPENCLASH_VERSION и Mihomo $MIHOMO_VERSION установлены"
    oum_info "Сервис запустится после добавления первого подключения"
}

oum_ensure_openclash() {
    if oum_pkg_installed luci-app-openclash && oum_require_runtime && oum_mihomo_core >/dev/null 2>&1; then
        return 0
    fi
    oum_warn "OpenClash ещё не установлен"
    printf 'Установить сейчас? [Y/n]: '
    IFS= read -r answer
    case "$answer" in n|N|no|NO) return 1 ;; esac
    oum_install_openclash
}
oum_write_source_converter() {
    destination="$1"
    cat > "$destination" <<'OUM_RUBY_EOF'
#!/usr/bin/env ruby
require 'yaml'

# OpenWrt's compact Ruby package normally ships without uri/cgi/base64/json.
# Keep the converter self-contained and depend only on ruby-yaml (Psych).
ShareURI = Struct.new(:scheme, :user, :host, :port, :query, :fragment)
SOURCE_GROUPS = {
  'subscription' => 'Subscription',
  'awg' => 'AWG_Tunnel',
  'reality' => 'Proxy_Nodes'
}.freeze

MASS_RULE_PROVIDER_SOURCES = [
  ['private-domains', 'domain', 'https://cdn.jsdelivr.net/gh/hydraponique/roscomvpn-geosite@release/mihomo/private.mrs', 2_592_000],
  ['cn-domains', 'domain', 'https://cdn.jsdelivr.net/gh/MetaCubeX/meta-rules-dat@meta/geo/geosite/cn.mrs'],
  ['category-games-not-cn', 'domain', 'https://cdn.jsdelivr.net/gh/MetaCubeX/meta-rules-dat@meta/geo/geosite/category-games-!cn.mrs'],
  ['category-ru', 'domain', 'https://cdn.jsdelivr.net/gh/hydraponique/roscomvpn-geosite@release/mihomo/category-ru.mrs'],
  ['whitelist', 'domain', 'https://cdn.jsdelivr.net/gh/hydraponique/roscomvpn-geosite@release/mihomo/whitelist.mrs'],
  ['microsoft', 'domain', 'https://cdn.jsdelivr.net/gh/hydraponique/roscomvpn-geosite@release/mihomo/microsoft.mrs'],
  ['apple', 'domain', 'https://cdn.jsdelivr.net/gh/hydraponique/roscomvpn-geosite@release/mihomo/apple.mrs'],
  ['google-play', 'domain', 'https://cdn.jsdelivr.net/gh/hydraponique/roscomvpn-geosite@release/mihomo/google-play.mrs'],
  ['samsung', 'domain', 'https://cdn.jsdelivr.net/gh/MetaCubeX/meta-rules-dat@meta/geo/geosite/samsung.mrs'],
  ['epicgames', 'domain', 'https://cdn.jsdelivr.net/gh/hydraponique/roscomvpn-geosite@release/mihomo/epicgames.mrs'],
  ['origin', 'domain', 'https://cdn.jsdelivr.net/gh/hydraponique/roscomvpn-geosite@release/mihomo/origin.mrs'],
  ['riot', 'domain', 'https://cdn.jsdelivr.net/gh/hydraponique/roscomvpn-geosite@release/mihomo/riot.mrs'],
  ['escapefromtarkov', 'domain', 'https://cdn.jsdelivr.net/gh/hydraponique/roscomvpn-geosite@release/mihomo/escapefromtarkov.mrs'],
  ['steam', 'domain', 'https://cdn.jsdelivr.net/gh/hydraponique/roscomvpn-geosite@release/mihomo/steam.mrs'],
  ['twitch', 'domain', 'https://cdn.jsdelivr.net/gh/hydraponique/roscomvpn-geosite@release/mihomo/twitch.mrs'],
  ['pinterest', 'domain', 'https://cdn.jsdelivr.net/gh/hydraponique/roscomvpn-geosite@release/mihomo/pinterest.mrs'],
  ['faceit', 'domain', 'https://cdn.jsdelivr.net/gh/hydraponique/roscomvpn-geosite@release/mihomo/faceit.mrs'],
  ['private-ips', 'ipcidr', 'https://cdn.jsdelivr.net/gh/hydraponique/roscomvpn-geoip@release/mihomo/private.mrs', 2_592_000],
  ['cn-ips', 'ipcidr', 'https://cdn.jsdelivr.net/gh/MetaCubeX/meta-rules-dat@meta/geo/geoip/cn.mrs'],
  ['direct-ips', 'ipcidr', 'https://cdn.jsdelivr.net/gh/hydraponique/roscomvpn-geoip@release/mihomo/direct.mrs'],
  ['github', 'domain', 'https://cdn.jsdelivr.net/gh/hydraponique/roscomvpn-geosite@release/mihomo/github.mrs'],
  ['twitch-ads', 'domain', 'https://cdn.jsdelivr.net/gh/hydraponique/roscomvpn-geosite@release/mihomo/twitch-ads.mrs'],
  ['youtube', 'domain', 'https://cdn.jsdelivr.net/gh/hydraponique/roscomvpn-geosite@release/mihomo/youtube.mrs'],
  ['telegram', 'domain', 'https://cdn.jsdelivr.net/gh/hydraponique/roscomvpn-geosite@release/mihomo/telegram.mrs'],
  ['telegram-ips', 'ipcidr', 'https://cdn.jsdelivr.net/gh/MetaCubeX/meta-rules-dat@meta/geo/geoip/telegram.mrs'],
  ['discord-domains', 'domain', 'https://cdn.jsdelivr.net/gh/MetaCubeX/meta-rules-dat@meta/geo/geosite/discord.mrs'],
  ['discord-voice-ips', 'ipcidr', 'https://cdn.jsdelivr.net/gh/legiz-ru/mihomo-rule-sets@main/other/discord-voice-ip-list.mrs'],
  ['meta-domains', 'domain', 'https://cdn.jsdelivr.net/gh/MetaCubeX/meta-rules-dat@meta/geo/geosite/meta.mrs'],
  ['meta-ips', 'ipcidr', 'https://cdn.jsdelivr.net/gh/MetaCubeX/meta-rules-dat@meta/geo/geoip/facebook.mrs'],
  ['ru-blocked-domains', 'domain', 'https://cdn.jsdelivr.net/gh/legiz-ru/mihomo-rule-sets@main/ru-bundle/rule.mrs'],
  ['ru-blocked-ips', 'ipcidr', 'https://cdn.jsdelivr.net/gh/legiz-ru/mihomo-rule-sets@main/ru-bundle/rknasnblock.mrs'],
  ['win-spy', 'domain', 'https://cdn.jsdelivr.net/gh/hydraponique/roscomvpn-geosite@release/mihomo/win-spy.mrs'],
  ['category-ads', 'domain', 'https://cdn.jsdelivr.net/gh/hydraponique/roscomvpn-geosite@release/mihomo/category-ads.mrs']
].freeze

# Same domain snapshot as PassWall. Never use broad blocked ASN/IP lists:
# a shared cloud network can host unrelated game servers.
ROUTING_DIR = [ENV['OUM_ROUTING_DIR'], '/usr/share/oum/routing',
  File.expand_path('../luci-app-oum/root/usr/share/oum/routing', __dir__)].compact.find { |path| File.file?(File.join(path, 'restricted-domains.txt')) }
abort 'OUM routing lists missing' unless ROUTING_DIR
RESTRICTED_DOMAINS = %w[regional restricted].flat_map do |kind|
  File.readlines(File.join(ROUTING_DIR, "#{kind}-domains.txt"), chomp: true).map do |domain|
    abort 'invalid routing domain' unless domain.match?(/\A[a-z0-9_.-]+\z/)
    domain
  end
end.uniq.freeze
MASS_RULES = (
  %w[gearupbooster.com gearupportal.com guinfra.com sdp.gg].map { |domain| "DOMAIN-SUFFIX,#{domain},DIRECT" } + [
  'RULE-SET,private-domains,DIRECT', 'RULE-SET,private-ips,DIRECT,no-resolve',
  'RULE-SET,discord-domains,PROXY',
  'RULE-SET,telegram,PROXY', 'RULE-SET,telegram-ips,PROXY,no-resolve',
  'RULE-SET,category-games-not-cn,DIRECT',
  'RULE-SET,category-ru,DIRECT', 'DOMAIN-SUFFIX,ru,DIRECT',
  'DOMAIN-SUFFIX,xn--p1ai,DIRECT', 'DOMAIN-SUFFIX,su,DIRECT',
  'RULE-SET,google-play,DIRECT', 'RULE-SET,microsoft,DIRECT',
  'RULE-SET,samsung,DIRECT', 'RULE-SET,cn-domains,DIRECT',
  'RULE-SET,cn-ips,DIRECT,no-resolve'
  ] + RESTRICTED_DOMAINS.map { |domain| "DOMAIN-SUFFIX,#{domain},PROXY" } + ['MATCH,DIRECT']
).freeze

def percent_decode(value)
  value.to_s.tr('+', ' ').gsub(/%([0-9a-fA-F]{2})/) { Regexp.last_match(1).to_i(16).chr }.force_encoding('UTF-8')
end

def parse_share_uri(line)
  scheme, rest = line.split('://', 2)
  raise ArgumentError, 'missing URI scheme' if rest.nil? || scheme.to_s.empty?
  body, fragment = rest.split('#', 2)
  authority, query = body.split('?', 2)
  # Hysteria2 share links commonly use host:port/?query.
  authority = authority.split('/', 2).first
  user, endpoint = authority.rpartition('@').values_at(0, 2)
  raise ArgumentError, 'missing URI credentials or endpoint' if user.empty? || endpoint.empty?
  match = endpoint.match(/^\[([^\]]+)\]:(\d+)$/) || endpoint.match(/^(.*):(\d+)$/)
  raise ArgumentError, 'endpoint must be host:port' unless match
  port = Integer(match[2])
  raise ArgumentError, 'invalid endpoint port' unless port.between?(1, 65_535)
  ShareURI.new(scheme.downcase, percent_decode(user), match[1], port, query.to_s, fragment.to_s)
end

def decode_base64(value)
  alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'
  buffer = 0
  bits = 0
  output = String.new(encoding: Encoding::BINARY)
  value.tr('-_', '+/').each_byte do |character|
    next if [9, 10, 13, 32].include?(character)
    break if character == 61
    index = alphabet.index(character.chr)
    raise ArgumentError, 'invalid base64 input' unless index
    buffer = (buffer << 6) | index
    bits += 6
    next if bits < 8
    bits -= 8
    output << ((buffer >> bits) & 0xff)
  end
  output.force_encoding('UTF-8')
end

def load_yaml(path)
  value = load_yaml_text(File.read(path))
  value.is_a?(Hash) ? value : {}
end

def load_yaml_text(text)
  YAML.safe_load(text, permitted_classes: [], permitted_symbols: [], aliases: true)
end

def write_yaml(value, path)
  File.open(path, 'w', 0o600) { |file| file.write(YAML.dump(value)) }
end

def query_hash(uri)
  uri.query.to_s.split('&').each_with_object({}) do |pair, out|
    key, value = pair.split('=', 2)
    out[percent_decode(key)] = percent_decode(value.to_s)
  end
end

def node_name(uri, fallback)
  name = percent_decode(uri.fragment.to_s).strip
  name.empty? ? fallback : name
end

def parse_vless(uri, index)
  query = query_hash(uri)
  security = query.fetch('security', 'none')
  network = query.fetch('type', 'tcp')
  node = {
    'name' => node_name(uri, "VLESS-#{index}"),
    'type' => 'vless',
    'server' => uri.host,
    'port' => uri.port,
    'uuid' => uri.user.to_s,
    'network' => network,
    'udp' => true
  }
  node['encryption'] = query['encryption'] unless query['encryption'].to_s.empty?
  node['flow'] = query['flow'] unless query['flow'].to_s.empty?
  node['packet-encoding'] = query['packetEncoding'] if query['packetEncoding']
  node['tls'] = true if %w[tls reality].include?(security)
  node['servername'] = query['sni'] unless query['sni'].to_s.empty?
  node['client-fingerprint'] = query['fp'] unless query['fp'].to_s.empty?
  node['alpn'] = query['alpn'].split(',').map(&:strip).reject(&:empty?) unless query['alpn'].to_s.empty?
  insecure = query['allowInsecure'] || query['allow_insecure'] || query['insecure']
  node['skip-cert-verify'] = %w[1 true yes].include?(insecure.to_s.downcase) unless insecure.nil?
  if security == 'reality'
    abort 'VLESS Reality URI is missing pbk' if query['pbk'].to_s.empty?
    reality = {'public-key' => query['pbk']}
    reality['short-id'] = query['sid'] unless query['sid'].to_s.empty?
    node['reality-opts'] = reality
  end
  case network
  when 'ws'
    options = {'path' => query.fetch('path', '/')}
    options['headers'] = {'Host' => query['host']} unless query['host'].to_s.empty?
    node['ws-opts'] = options
  when 'grpc'
    node['grpc-opts'] = {'grpc-service-name' => query.fetch('serviceName', '')}
  when 'xhttp'
    options = {}
    options['path'] = query['path'] if query['path']
    options['mode'] = query['mode'] if query['mode']
    options['host'] = query['host'] if query['host']
    begin
      extra = load_yaml_text(query['extra']) if query['extra']
      if extra.is_a?(Hash)
        options['x-padding-bytes'] = extra['xPaddingBytes'] if extra['xPaddingBytes']
        options['no-grpc-header'] = extra['noGRPCHeader'] if extra.key?('noGRPCHeader')
        options['headers'] = extra['headers'] if extra['headers'].is_a?(Hash)
      end
    rescue StandardError
      warn 'WARNING: malformed XHTTP extra settings were ignored'
    end
    node['xhttp-opts'] = options
  when 'tcp'
    # No transport-specific options.
  else
    warn "WARNING: VLESS transport #{network.inspect} was preserved but not expanded"
  end
  node
end

def parse_hysteria2(uri, index)
  query = query_hash(uri)
  node = {
    'name' => node_name(uri, "HYSTERIA2-#{index}"),
    'type' => 'hysteria2',
    'server' => uri.host,
    'port' => uri.port,
    'password' => uri.user.to_s
  }
  node['sni'] = query['sni'] unless query['sni'].to_s.empty?
  insecure = query['allowInsecure'] || query['allow_insecure'] || query['insecure']
  node['skip-cert-verify'] = %w[1 true yes].include?(insecure.to_s.downcase) unless insecure.nil?
  node['alpn'] = query['alpn'].split(',').map(&:strip).reject(&:empty?) unless query['alpn'].to_s.empty?
  node
end

def decode_uri_lines(text)
  stripped = text.strip
  return stripped.lines.map(&:strip).reject(&:empty?) if stripped.match?(/(?:vless|hysteria2|hy2):\/\//)
  decoded = decode_base64(stripped)
  decoded.lines.map(&:strip).reject(&:empty?)
rescue ArgumentError
  abort 'input is neither a URI list nor a base64 URI subscription'
end

def excluded_subscription_name?(name)
  normalized = name.to_s.downcase
  return true if name.include?('⬇') || name.include?('🇪🇺')
  return true if %w[lte мобильный авто].any? { |token| normalized.include?(token) }
  normalized.match?(/(?:\A|[\s_|+\-])ss(?:\z|[\s_|+\-])/)
end

def convert_uri_list(input, filter_subscription: false)
  nodes = []
  filtered = 0
  decode_uri_lines(File.read(input)).each_with_index do |line, index|
    uri = parse_share_uri(line)
    node = case uri.scheme
           when 'vless' then parse_vless(uri, index + 1)
           when 'hysteria2', 'hy2' then parse_hysteria2(uri, index + 1)
           else
             warn "WARNING: unsupported URI scheme #{uri.scheme.inspect}; node skipped"
             nil
           end
    if node && filter_subscription && excluded_subscription_name?(node['name'])
      filtered += 1
    elsif node
      nodes << node
    end
  rescue ArgumentError => error
    warn "WARNING: malformed node #{index + 1} skipped: #{error.message}"
  end
  abort 'no supported nodes found' if nodes.empty?
  warn "INFO: filtered #{filtered} subscription nodes by name" if filtered.positive?
  {'proxies' => nodes}
end

def convert_subscription(input)
  text = File.read(input)
  begin
    document = load_yaml_text(text)
    if document.is_a?(Hash) && document['proxies'].is_a?(Array)
      nodes = document['proxies'].select { |node| node.is_a?(Hash) && !excluded_subscription_name?(node['name']) }
      abort 'Clash subscription contains no supported nodes after filtering' if nodes.empty?
      return {'proxies' => nodes}
    end
  rescue Psych::Exception
    # URI subscriptions are commonly plain text or base64 and are handled below.
  end
  convert_uri_list(input, filter_subscription: true)
end

def parse_ini(path)
  sections = {'interface' => {}, 'peer' => {}}
  section = nil
  peers = 0
  File.foreach(path) do |raw|
    line = raw.strip
    next if line.empty? || line.start_with?('#', ';')
    if (section_match = line.match(/^\[([^\]]+)\]$/))
      section = section_match[1].downcase
      if section == 'peer'
        peers += 1
        abort 'only one AWG [Peer] is supported per source' if peers > 1
      end
      section = nil unless sections.key?(section)
      next
    end
    next unless section && line.include?('=')
    key, value = line.split('=', 2).map(&:strip)
    sections[section][key.downcase] = value
  end
  sections
end

def integer_or_range(value)
  value.match?(/^\d+$/) ? value.to_i : value
end

def convert_awg(input, name)
  sections = parse_ini(input)
  interface = sections['interface']
  peer = sections['peer']
  %w[privatekey address].each { |key| abort "AWG Interface.#{key} is missing" if interface[key].to_s.empty? }
  %w[publickey endpoint].each { |key| abort "AWG Peer.#{key} is missing" if peer[key].to_s.empty? }
  endpoint = peer['endpoint']
  match = endpoint.match(/^\[([^\]]+)\]:(\d+)$/) || endpoint.match(/^(.*):(\d+)$/)
  abort 'AWG Endpoint must be host:port' unless match
  server = match[1]
  port = Integer(match[2])
  abort 'AWG Endpoint port is invalid' unless port.between?(1, 65_535)
  addresses = interface['address'].split(',').map(&:strip)
  node = {
    'name' => name,
    'type' => 'wireguard',
    'server' => server,
    'port' => port,
    'private-key' => interface['privatekey'],
    'public-key' => peer['publickey'],
    'udp' => true,
    'allowed-ips' => peer.fetch('allowedips', '0.0.0.0/0').split(',').map(&:strip)
  }
  node['ip'] = addresses.find { |address| !address.include?(':') }
  node['ipv6'] = addresses.find { |address| address.include?(':') }
  node.delete('ip') unless node['ip']
  node.delete('ipv6') unless node['ipv6']
  node['pre-shared-key'] = peer['presharedkey'] unless peer['presharedkey'].to_s.empty?
  node['persistent-keepalive'] = Integer(peer['persistentkeepalive']) if peer['persistentkeepalive']
  node['mtu'] = Integer(interface['mtu']) if interface['mtu']

  # DNS from AWG is deliberately ignored. OUM owns router/OpenClash DNS policy.
  options = {}
  %w[jc jmin jmax s1 s2 s3 s4 itime rekey-after-time rekey-timeout reject-after-time keepalive-timeout max-handshake-attempts].each do |key|
    options[key] = Integer(interface[key]) if interface[key]
  end
  %w[h1 h2 h3 h4].each do |key|
    options[key] = integer_or_range(interface[key]) if interface[key]
  end
  %w[i1 i2 i3 i4 i5 j1 j2 j3 header-protection-key content-padding-addition].each do |key|
    options[key] = interface[key] if interface.key?(key) && !interface[key].empty?
  end
  %w[random-trailers disable-cookies].each do |key|
    options[key] = %w[1 true yes].include?(interface[key].to_s.downcase) if interface.key?(key)
  end
  explicit = interface['awgversion'] || interface['version']
  options['version'] = if explicit
                         Integer(explicit)
                       elsif options.key?('header-protection-key')
                         3
                       elsif options.keys.any? { |key| key.match?(/^[ij][1-5]$/) } || options.values_at('h1', 'h2', 'h3', 'h4').compact.any? { |value| value.is_a?(String) && value.include?('-') }
                         2
                       else
                         1
                       end
  abort 'AWG Jmin must not exceed Jmax' if options['jmin'] && options['jmax'] && options['jmin'] > options['jmax']
  warn 'WARNING: AWG S4 > 64 requires an up-to-date Mihomo core' if options['s4'].to_i > 64
  node['amnezia-wg-option'] = options
  {'proxies' => [node]}
end

def source_group_name(kind)
  SOURCE_GROUPS.fetch(kind, 'OUM-SOURCES')
end

def apply_mass_routing(config)
  config['rule-providers'] = MASS_RULE_PROVIDER_SOURCES.each_with_object({}) do |(name, behavior, url, interval), providers|
    next unless MASS_RULES.any? { |rule| rule.start_with?("RULE-SET,#{name},") }
    providers[name] = {
      'type' => 'http', 'behavior' => behavior, 'format' => 'mrs', 'url' => url,
      'path' => "./rule_provider/#{name}.mrs", 'interval' => interval || 86_400, 'proxy' => 'DIRECT'
    }
  end
  config['rules'] = MASS_RULES.dup
  config
end

def base_config
  server = ENV.fetch('OUM_DNS_SERVER', '1.1.1.1')
  bootstrap = ENV.fetch('OUM_BOOTSTRAP_DNS', '1.0.0.1')
  allowed = %w[77.88.8.8 77.88.8.1 1.1.1.1 1.0.0.1 8.8.8.8 8.8.4.4 9.9.9.9 149.112.112.112]
  abort 'unsupported OUM DNS server' unless allowed.include?(server) && allowed.include?(bootstrap)
  {
    'mixed-port' => 7890,
    'allow-lan' => true,
    'bind-address' => '*',
    'mode' => 'rule',
    'log-level' => 'info',
    'ipv6' => false,
    'external-controller' => '127.0.0.1:9090',
    'profile' => {'store-selected' => true, 'store-fake-ip' => true},
    'dns' => {
      'enable' => true,
      'ipv6' => false,
      'enhanced-mode' => 'fake-ip',
      'fake-ip-range' => '198.18.0.1/16',
      'fake-ip-filter' => ['*.lan', '*.local'],
      'default-nameserver' => [bootstrap],
      'nameserver' => [bootstrap],
      'proxy-server-nameserver' => [bootstrap],
      'direct-nameserver' => [bootstrap],
      'respect-rules' => true,
      'nameserver-policy' => RESTRICTED_DOMAINS.each_with_object({}) { |domain, policy| policy["+.#{domain}"] = ["tcp://#{server}:53#PROXY"] }.merge(
        'rule-set:telegram' => ["tcp://#{server}:53#PROXY"],
        '+.ru' => [bootstrap], '+.su' => [bootstrap], '+.xn--p1ai' => [bootstrap],
        'rule-set:category-games-not-cn,category-ru,cn-domains' => [bootstrap])
    }
  }
end

def single_profile(provider_file, kind)
  config = base_config
  group_name = source_group_name(kind)
  nodes = load_yaml(provider_file).fetch('proxies', [])
  abort 'standalone source contains no proxies' unless nodes.is_a?(Array) && !nodes.empty?
  reserved = ['PROXY', group_name, 'AUTO', 'META', 'DIRECT', 'REJECT']
  used = reserved.each_with_object({}) { |name, out| out[name] = true }
  nodes.each do |node|
    original = node['name'].to_s.strip
    abort 'standalone source contains unnamed proxies' if original.empty?
    candidate = original
    suffix = 1
    while used[candidate]
      candidate = "#{original} Node #{suffix}"
      suffix += 1
    end
    node['name'] = candidate
    used[candidate] = true
  end
  names = nodes.map { |node| node['name'] }
  config['proxies'] = nodes
  config.delete('proxy-providers')
  config['proxy-groups'] = [
    {'name' => 'PROXY', 'type' => 'select', 'proxies' => [group_name, 'AUTO', 'DIRECT']},
    {'name' => group_name, 'type' => 'select', 'proxies' => names.dup},
    {'name' => 'AUTO', 'type' => 'url-test', 'proxies' => names.dup, 'url' => 'https://www.gstatic.com/generate_204', 'interval' => 300},
    {'name' => 'META', 'type' => 'select', 'proxies' => ['PROXY', 'DIRECT']}
  ]
  apply_mass_routing(config)
end

mode = ARGV.shift
case mode
when 'awg'
  input, output, name = ARGV
  abort 'usage: awg INPUT OUTPUT NAME' unless input && output && name
  write_yaml(convert_awg(input, name), output)
when 'uris'
  input, output = ARGV
  abort 'usage: uris INPUT OUTPUT' unless input && output
  write_yaml(convert_uri_list(input), output)
when 'subscription'
  input, output = ARGV
  abort 'usage: subscription INPUT OUTPUT' unless input && output
  write_yaml(convert_subscription(input), output)
when 'standalone'
  output, provider_file, kind = ARGV
  abort 'usage: standalone OUTPUT PROVIDER_FILE KIND' unless output && provider_file && kind
  write_yaml(single_profile(provider_file, kind), output)
else
  abort 'modes: awg, uris, subscription, standalone'
end
OUM_RUBY_EOF
    mkdir -p /usr/share/oum/routing
    cat > /usr/share/oum/routing/regional-domains.txt <<OUM_ROUTING_EOF
openai.com
chatgpt.com
oaistatic.com
oaiusercontent.com
anthropic.com
claude.ai
claude.com
gemini.google.com
generativelanguage.googleapis.com
aistudio.google.com
ai.google.dev
ai.studio
aicode.googleapis.com
aida.googleapis.com
aisandbox-pa.googleapis.com
alkalicore-pa.clients6.google.com
alkalimakersuite-pa.clients6.google.com
antigravity-pa.googleapis.com
antigravity-unleash.goog
antigravity.google
antigravity.googleapis.com
bard.google.com
cloudaicompanion.googleapis.com
cloudcode-pa.googleapis.com
daily-cloudcode-pa.googleapis.com
deepmind.com
deepmind.google
flow.google
geller-pa.googleapis.com
gemini.google
gemini.gstatic.com
generativeai.google
jules.google
jules.google.com
labs.google
labs.google.com
makersuite.google.com
notebook.google.com
notebooklm-pa.googleapis.com
notebooklm.google
notebooklm.google.com
notebooklm.googleapis.com
opal.google
opal.google.com
proactivebackend-pa.googleapis.com
robinfrontend-pa.googleapis.com
stitch.withgoogle.com
webchannel-alkalimakersuite-pa.clients6.google.com
OUM_ROUTING_EOF
    cat > /usr/share/oum/routing/restricted-domains.txt <<OUM_ROUTING_EOF
10minutemail.com
1337x.to
24.kg
2407.pl
3parug.com
4freerussia.org
4pda.to
4pda.ws
4pna.com
5sim.net
6pm.com
7dniv.rv.ua
7tv.app
7tv.io
8chan.moe
9tv.co.il
a-vrv.akamaized.net
ab.chatgpt.com
abercrombie.com
abook-club.ru
abs-0.twimg.com
abs-zero.twimg.com
abs.twimg.com
academy.terrasoft.ua
account-api.protonmail.com
account.jetbrains.com
account.protonmail.com
accounts.spotify.com
activatica.org
activestate.com
acurapartswarehouse.com
adafruit.com
adam-audio.com
adblockplus.org
adguard-vpn.com
adguard.com
adidas.com
adminforge.de
adobe.com
adobe.io
adobe.net
ads-twitter.com
adtran.com
adultmult.tv
afcs.dellcdn.com
affinity.studio
aftermarket.schaeffler.com
aftermarket.zf.com
agar.io
agents.media
agentura.ru
ahrefs.com
ai-chat.bsg.brave.com
ai.com
airbrake.io
aircanada.com
akc.org
alberta.ca
algolia.com
alienwarearena.com
all3dp.com
allegro.pl
alltrails.com
alphacoders.com
altaro.com
alza.hu
amazfitwatchfaces.com
amazon.com
amd.com
amdm.ru
amedia.site
amnezia.org
amplitude.com
amx.com
analog.com
andrevi.ch
angryemailtranslator.com
anidub.com
anilib.me
anilibria.org
anilibria.tv
anilibria.uno
anilibria.wtf
animaunt.org
anime-portal.su
animebest.org
animedia.tv
animego.org
animespirit.ru
animestars.org
anistar.org
anistars.ru
annas-archive.org
annimon.com
ansible.com
ansys.com
anthropic.com
anthropic.qualtrics.com
antizapret.prostovpn.org
any.do
anythingllm.com
aol.com
api.app.prod.grazie.aws.intellij.net
api.github.com
api.githubcopilot.com
api.home-connect.com
api.jetbrains.ai
api.openai.com
api.protonmail.ch
api.radarr.video
api.service-kp.com
api.theins.info
api.themoviedb.org
api.twitter.com
apiary.io
apkmirror.com
aplawrence.com
app.4pda.to
app.amplitude.com
app.m3u.in
app.paraswap.io
app.zerossl.com
appstorrent.ru
apt.releases.hashicorp.com
aqicn.org
arbat.media
arc.intel.com
arc.net
archive.ph
archiveofourown.org
arduino.cc
arm.com
artifacts.elastic.co
as6723.net
assets.heroku.com
atlassian.com
atn.ua
att.com
attachments.f95zone.to
atv4.dnskp.cc
atwiki.jp
audiobookbay.lu
augmentcode.com
auth.grazie.ai
auth.openai.com
auth0.openai.com
autodesk.com
autodesk.net
av-connection.com
avcdn.net
avid.com
avira.com
azathabar.com
azattyq.org
babepedia.com
babook.org
bacch.com
backend-v2.crixet.com
baginya.org
baikal-journal.ru
bard.google.com
bato.to
bbc.co.uk
bbc.com
bbci.co.uk
bcbits.com
beacon3d.com
bell-sw.com
bellingcat.com
bestbuy.ca
bestbuy.com
bestchange.ru
bihus.info
bing.com
bitbucket.org
bitcoin.org
bitdefender.com
bitnami.com
bitru.org
blackfriday.com
blackseanews.net
blinkshot.io
blizzardwatch.com
bluehost.com
bluesky-soft.com
blur.io
booktracker.org
boominfo.org
boosteroid.com
booth.pm
booth.pximg.net
bosch-diy.com
bosch-home.co.nz
bosch-home.com
bosch-home.com.sg
bosch-professional.com
bosch.com
bosch.de
boschaftermarket.com
boschautoparts.com
botnadzor.org
bradyid.com
brave.com
bricklink.com
brickset.com
broadcom.com
broccolionline.jp
broncosportforum.com
bsh-group.com
bt.t-ru.org
bt2.t-ru.org
bt3.t-ru.org
bt4.t-ru.org
bt4gprx.com
btdig.com
btod.com
buanzo.org
buf.build
bufferbloat.net
builds.parsec.app
buymeacoffee.com
byteoversea.com
cacti.net
cadence.com
cambiumnetworks.com
camunda.io
canva-apps.com
canva.com
canva.dev
capacitorjs.com
capcut.com
carnegieendowment.org
carrefouruae.com
cats.com
cbilling.eu
cbilling.vip
cdn.jsdelivr.net
cdn.oaistatic.com
cdn.web-platform.io
cdn2site.com
cdnbunny.org
cdninstagram.com
cdromance.org
cdw.com
censor.net
censortracker.org
census.gov
certifytheweb.com
cesium.com
chainreactioncycles.com
chaos.com
charhub.io
chat.com
chat.openai.com
chat.openai.com.cdn.cloudflare.net
chatfuel.com
chatgpt.com
chaturbate.com
checkout.buckaroo.nl
cherta.media
chess.com
chesscomfiles.com
chipestimate.com
chub.ai
cici.com
circlecrewpinkcrowd.com
cisco.com
cisecurity.org
citrix.com
clamav.net
clarabridge.net
claude.ai
claude.com
clevelandclinic.org
clickup.com
clip.opus.pro
cloud.mongodb.com
cloudflare-dns.com
cloudflare-ech.com
cloudtorrents.com
cmems-du.eu
cms-twdigitalassets.com
cnd2exp.online
cocalc.com
cock.li
code.gist.build
codebrowser.dev
codeium.com
codelinaro.org
cohere.com
coingate.com
coinpayments.net
coinsbee.com
coldfilm.city
coldfilm.ink
coldfilm.xyz
colta.ru
comazo.de
community.cisco.com
community.sophos.com
completeaccess.audio
connect.ngrok-agent.com
contabo.com
coomer.su
copernicus.eu
copilot-proxy.githubusercontent.com
copilot-telemetry.githubusercontent.com
copilot.microsoft.com
corsair.com
coursera.com
coursera.org
cpu-monkey.com
credly.com
crowdstrike.com
croxyproxy.com
crunchbase.com
crunchyroll.com
csagroup.org
csskor.ill.in.ua
cub.red
currenttime.tv
cursor-cdn.com
cursor.sh
cursorapi.com
cursorinfo.co.il
cvedetails.com
cyberghostvpn.com
cybersecurity-help.cz
cyxymu.info
czx.to
d.docs.live.net
daemon-tools.cc
dailylviv.com
danbooru.donmai.us
darkproject.eu
dashboard.algolia.com
dashboard.gitguardian.com
data-cdn.mbamupdates.com
data.cline.bot
database.clamav.net
databricks.com
dating.com
daz3d.com
debian.map.fastlydns.net
deckbrew.xyz
decrypt.day
deepl.com
deepsource.com
deepsource.io
deepstatemap.live
deezer.com
delfi.lt
delfi.lv
delivery.2d.net.co
dell.com
dellcdn.com
delltechnologies.com
depositphotos.com
designer.microsoft.com
designify.com
desipro.de
devart.com
developer.nvidia.com
devexpress.com
deviantart.com
devops.com
diabrowser.com
dice.com
dickssportinggoods.com
diffblue.com
digash.live
digikey.com
digikey.sg
digitalcontent.sky
digitalocean.com
dis.gd
discord-activities.com
discord-attachments-uploads-prd.storage.googleapis.com
discord.co
discord.com
discord.design
discord.dev
discord.gg
discord.gift
discord.gifts
discord.media
discord.new
discord.store
discord.tools
discordactivities.com
discordapp.com
discordapp.io
discordapp.net
discordapp.org
discordmerch.com
discordpartygames.com
discordsays.com
discordstatus.com
discours.io
disctech.com
disneyplus.com
dist.torproject.org
dl.discordapp.net
dnb.com
docker.elastic.co
docker.io
docs.liquibase.com
docs.redis.com
document360.com
document360.io
documentation.meraki.com
dogpile.com
dolby.com
dorama.live
doramalive.ru
doramy.club
dovod.online
download.jetbrains.com
download.lenovo.com
download.qt.io
download.screamingfrog.co.uk
download.wetransfer.com
download3.omnissa.com
downloads.intercomcdn.com
doxa.team
doxajournal.ru
dpidetector.org
dreamhost.com
dual-a-0001.a-msedge.net
dub.sh
ducati.com
dumka.media
dw.com
dyson.com
dyson.nl
dyson.se
e-hentai.org
e-katalog.com.ua
e-katalog.ua
e1v-h.phncdn.com
e621.net
easydmarc.com
easyjet.com
echofm.online
edge.microsoft.com
edgeservices.bing.com
editmysite.com
editorx.com
edu-cisco.org
ef.com
ef.edu
eggertspiele.de
ehorussia.com
ej.ru
ek.ua
ekhokavkaza.com
elastic.co
element14.com
elements.envato.com
elevenlabs.io
elgiganten.se
eneba.com
engagor.com
entrust.com
envato.com
epg.one
epidemz.net.co
eporner.com
espares.ie
espreso.tv
etahub.com
etsy.com
eu-iot-prod.aws.tcljd.com
euronews.com
europesays.com
euroradio.fm
eutrp.eu
event.on24.com
everand.com
exchanger.bits.media
exler.es
exler.ru
expandrive.com
expres.online
extremetech.com
f1.com
f95-zone.to
facebook.com
facebook.net
familysearch.org
fansly.com
fansub.com.br
fapello.com
fast-torrent.club
fast.com
fastflux.ai
fastpic.org
fastspring.com
fb.com
fbcdn.net
fbsbx.com
fedex.com
fex.net
ficbook.net
fiercepc.co.uk
filebin.net
filehippo.com
files.oaiusercontent.com
filmitorrent.net
filmix.ac
filmix.biz
filmix.day
filmix.fan
filmix.fm
filmix.la
findagrave.com
firefly-ps.adobe.io
fireworks.ai
fivetran.com
flashscore.com
flexpool.io
flibusta.is
flibusta.net
flipboard.com
flir.com
flir.eu
flisland.net
flourish.studio
fls.guru
fluke.com
flukenetworks.com
flyertalk.com
fn-volga.ru
fonge.org
footballapi.pulselive.com
force-user-content.com
force.com
fork.pet
forklog.com
formula1.com
fortanga.org
fortiguard.com
fortinet.com
forum.netgate.com
forum.ru-board.com
forum.voynaplemyon.com
fosshub.com
fotoforensics.com
foxnews.com
foxtrot.com.ua
framer.app
framer.com
framercanvas.com
framercdn.com
framerstatic.com
framerusercontent.com
freecodecamp.org
freediscussions.com
freedomletters.org
freeimages.com
freemedia.io
freemyip.com
freeones.com
freescale.com
fujitsu.com
futurelearn.com
fw-download.ubnt.com
fw-update.ubnt.com
fxnetworks.com
g2a.com
g711.org
gagadget.com
gallery.zetalliance.org
gambody.com
game.co.uk
gamedistribution.com
gamesrepack.com
gamestop.com
gaming.amazon.com
gateway.discord.gg
gateway.pinata.cloud
geekyfuroshiki.com
geforcenow.com
gelbooru.com
gemini.google.com
geni.us
genius.com
genspark.ai
geolocation.onetrust.com
geospy.ai
germania.one
getoutline.com
getoutline.org
getsafeonline.org
gfn.am
ggpht.com
ghidra-sre.org
ghostrc.game.idtech.services
gifyu.com
git.new
githubcopilot.com
gitlab.com
gitlab.io
glavred.info
glavred.net
gllto.glpals.com
global.fncstatic.com
glpals.com
gmplib.org
gmu.edu
gmv.com
gnome-look.org
godaddy.com
gofile.io
gofund.me
gofundme.com
golosameriki.com
gonift.com
gonitro.com
goodreads.com
google.com
google.dev
googleapis.com
googletagmanager.com
googlevideo.com
gordonua.com
gov.ua
gpsonextra.net
gpu-monkey.com
gql.twitch.tv
gr-assets.com
grafana.com
grammarly.com
grani.ru
graty.me
graylog.org
grazie.ai
grizzlysms.com
grok.com
grok.x.com
groq.com
groupon.com
grouponcdn.com
guilded.gg
gulagu.net
habr.com
hackernoon.com
hackmd.io
halooglasi.com
happycolorapp.com
hashflare.io
hashicorp.com
hashkey.com
hbomax.com
hc-ping.com
hchk.io
hd-rezka.tv
hd.zetfix.online
hdkinoteatr.com
hdrezka.ac
hdrezka.ag
hdrezka.app
hdrezka.fm
hdrezka.me
hdrezka.tech
hdrezka.tv
hdrzk.org
hdstudio.org
healthline.com
helioadditive.com
helm.releases.hashicorp.com
hentai-foundry.com
herokucdn.com
hetzner.com
hex-rays.com
hitomi.la
hollisterco.com
holod.global.ssl.fastly.net
holod.media
home-connect.cn
home-connect.com
home.by.me
honeywell.com
hostgator.com
hostinger.com
hotels.com
housebrand.com
hpe.com
hqporner.com
hromadske.ua
hs.fi
htmhell.dev
httptoolkit.com
hume.ai
hybrid-analysis.com
hyperhost.ua
hyundainews.com
i.4pda.ws
i.sakh.com
iaai.com
ibm.com
ibytedtos.com
icd10data.com
ichef.bbci.co.uk
id.cisco.com
idelreal.org
iditelesombase.org
idolcomplex.com
idtech.services
iedb.org
ig.me
ign.com
iherb.com
iichan.hk
ikea.com
ilook.tv
image.tmdb.org
imagecache365.com
images.discordapp.net
imgur.com
important-stories.com
incy.cc
indeed.com
indiehackers.com
infineon.com
informit.com
infosecinstitute.com
insanelymac.com
insearch.site
insideevs.com
instagram.com
instagram.fhrk1-1.fna.fbcdn.net
instagram.fkun2-1.fna.fbcdn.net
instagram.frix7-1.fna.fbcdn.net
instagram.fvno2-1.fna.fbcdn.net
install.launcher.omniverse.nvidia.com
intel.ac
intel.ae
intel.af
intel.ag
intel.ai
intel.ar
intel.at
intel.az
intel.ba
intel.bg
intel.bh
intel.bi
intel.bo
intel.bs
intel.by
intel.ca
intel.cc
intel.cg
intel.ch
intel.cl
intel.cm
intel.cn
intel.co
intel.co.ae
intel.co.cr
intel.co.id
intel.co.il
intel.co.jp
intel.co.kr
intel.co.uk
intel.co.za
intel.com
intel.com.ar
intel.com.au
intel.com.bo
intel.com.br
intel.com.cn
intel.com.co
intel.com.ec
intel.com.hk
intel.com.jm
intel.com.mx
intel.com.my
intel.com.pe
intel.com.ph
intel.com.pr
intel.com.py
intel.com.tr
intel.com.tw
intel.com.uy
intel.com.ve
intel.cr
intel.cu
intel.cz
intel.de
intel.dev
intel.dk
intel.dz
intel.ec
intel.ee
intel.eg
intel.es
intel.eu
intel.fi
intel.fr
intel.ga
intel.gd
intel.ge
intel.gg
intel.gl
intel.gm
intel.gr
intel.gs
intel.gt
intel.gy
intel.hk
intel.hn
intel.ht
intel.hu
intel.id
intel.ie
intel.in
intel.io
intel.it
intel.je
intel.jo
intel.jp
intel.ke
intel.la
intel.lc
intel.lk
intel.lt
intel.lu
intel.ly
intel.ma
intel.md
intel.me
intel.mg
intel.mk
intel.mn
intel.mp
intel.mt
intel.mu
intel.mw
intel.mx
intel.my
intel.ng
intel.nl
intel.nu
intel.nz
intel.pa
intel.pe
intel.ph
intel.pl
intel.pn
intel.re
intel.ro
intel.rw
intel.sa
intel.sc
intel.se
intel.sg
intel.si
intel.sk
intel.sn
intel.sr
intel.st
intel.sv
intel.sx
intel.sy
intel.tf
intel.tj
intel.tl
intel.tm
intel.tn
intel.tt
intel.tv
intel.tw
intel.ua
intel.uk
intel.us
intel.uy
intel.uz
intel.vg
intel.vn
intel.vu
intel.wf
intel.yt
intelix.sophos.com
intellij.net
intellipaat.com
interactivebrokers.co.uk
intercom.io
interfax.com.ua
internalfb.com
intuit.com
intuitibits.com
ionos.com
ios.chat.openai.com
iperf3serverlist.net
iptv.online
ipwho.is
is.fi
island-of-pleasure.site
istories.media
it-tools.tech
itninja.com
itsmycity.ru
jabra.com
jamf.com
jetbrains.ai
jetbrains.com
jetbrains.space
jetbrains.team
jnn-pa.googleapis.com
joesandbox.com
joyreactor.cc
jsfiddle.net
jskor.ill.in.ua
justanswer.co.uk
jut-su.net
jut.su
kaktus.media
kaleido.ai
kamatera.com
kara.su
kasparov.ru
kavkaz-uzel.eu
kavkazr.com
keepgrowing.in
keepsolid.com
kemono.party
kemono.su
keysight.com
kilo.ai
kilocode.ai
kino.pub
kinobase.org
kinogo.ec
kinogo.la
kinogo.uk
kinokopilka.pro
kinopub.me
kinovod.net
kinozal.guru
kinozal.me
kinozal.tv
kinozaltv.life
klarna.com
klaviyo.com
kmail-lists.com
knews.kg
knowyourmeme.com
kolsar.org
kor.ill.in.ua
korrespondent.net
kovcheg.live
kowalski7cc.xyz
kpapp.link
kroger.com
krymr.com
kupujemprodajem.com
kym-cdn.com
lambdalabs.com
lamcdn.net
langdock.com
lantern.io
last.fm
launchpad.io
ldoceonline.com
le-production.tv
leafletjs.com
legalshield.com
lego.com
leica-geosystems.com
lenovo.com
lenso.ai
letyshops.com
lgeapi.com
lgthinq.com
lib.rus.ec
libgen.li
libgen.rs
licdn.com
lidarr.audio
lifehacker.com
liga.net
lightburnsoftware.com
lightning.ai
linear.app
lingq.com
linkedin.com
linktr.ee
linuxiac.com
lipstickalley.com
liquidsky.com
livetv.sx
liveuamap.com
llamameta.net
localbitcoins.com
locals.md
login.amd.com
logo.com
lolz.guru
londonstockexchange.com
lookerstudio.google.com
lostfilm.download
lostfilm.run
lostfilm.today
lostfilm.tv
lostfilm.tw
lostfilm.uno
lostfilm.win
lostfilmtv2.site
lowes.com
lseg.com
lu4.org
lucid.app
lyst.com
m.strava.com
m3u.in
macpaw.com
macvendors.com
magaz.global
mail-api.proton.me
mail.protonmail.com
mailerlite.com
mailfence.com
mailinator.com
mailo.com
make.com
malw.link
malwarebytes.com
malwarebytes.org
manga-chan.me
mangadex.org
mangahub.ru
mangapark.net
manus.im
manybooks.net
manyvids.com
marketplace.atlassian.com
marvelsnap.com
mashable.com
master.qt.io
mattermost.com
max.com
maximintegrated.com
mbamupdates.com
mbed.com
mbk-news.appspot.com
mdza.io
mediazona.ca
mediazona.online
medicalnewstoday.com
medium.com
meduza.io
meest-shop.com
meetup.com
mega.nz
megapeer.ru
megapeer.vip
megogo.net
melord.net
memohrc.org
meraki.com
merezha.co
meshcapade.com
meta.ai
meta.com
metacrawler.com
metacritic.com
metademolab.com
metal-archives.com
meteo.paraplan.net
metla.press
metopera.org
mezha.net
michaelkors.global
microcenter.com
microchip.com
microsoft.com
middlewareinventory.com
mignews.com
mikrocontroller.net
militarnyi.com
mint.com
mintmobile.com
miracleptr.wordpress.com
mistral.ai
mixcloud.com
mmcdn.com
mobile.events.data.microsoft.com
moneypuck.com
mongodb.com
mongodb.net
monolisa.dev
monoprice.com
monotype.com
monotypefonts.com
monster.ie
more.fm
moscowtimes.ru
mouser.com
mouser.fi
mrakopedia.net
mssg.me
mullvad.net
multisim.com
multporn.net
muscdn.com
musical.ly
musicbrainz.org
musixmatch.com
mw2.wiki
my.atlassian.com
myanimelist.net
mydoramy.club
myfonts.com
myheritage.com
myjetbrains.com
myparallels.com
myprepaidcenter.com
myqrcode.com
myrotvorets.center
myworld-portal.leica-geosystems.com
nab.com.au
naps2.com
nasvsehtoshnit.ru
navalny.com
nba.com
ndi.tv
neformat.com.ua
neo4j.com
netacad.com
netapp.com
netflix.ca
netflix.com
netflix.net
netflixinvestor.com
netflixtechblog.com
netlify.com
netscaler.com
networksolutions.com
neuesbad.de
new.abb.com
newark.com
news.google.com
newsroom.porsche.com
newsru.co.il
newsru.com
newstudio.tv
newtimes.ru
nfl.com
nflxext.com
nflximg.com
nflximg.net
nflxsearch.net
nflxso.net
nflxvideo.net
ngrok.com
nhentai.com
nhentai.net
nhl.com
ni.com
nic.ua
nih.gov
nike.com
nippon.com
nitropdf.com
nnmclub.to
nnmstatic.win
nordaccount.com
nordcdn.com
nordvpn.com
norton.com
notepad-plus-plus.org
notion-emojis.s3-us-west-2.amazonaws.com
notion-static.com
notion.com
notion.new
notion.site
notion.so
novaline.fm
novaya.no
novayagazeta.eu
novayagazeta.ru
novyny.live
nsa.gov
nsf.gov
ntc.party
ntfsformac.tuxera.com
ntp.msn.com
nude-moon.org
nvidia.com
nxp.com
nyaa.si
nyaa.tracker.wf
oaistatic.com
oaiusercontent.com
oasis.app
obozrevatel.com
oclc.org
ocstore.com
octopart-clicks.com
octopart.com
octopus.do
octostatic.com
oculus.com
ohmyswift.ru
oi.legal
okx.com
olx.ua
omnissa.com
omv-extras.org
onfastspring.com
onlineradiobox.com
onlinesim.io
onlinesim.ru
onshape.com
open.spotify.com
openai.com
openculture.com
openh264.org
openmedia.io
openrouter.ai
opensanctions.org
opensea.io
opentext.com
opentrackr.org
openwrt.wk.cz
opposition-news.com
oracle.com
oraclecloud.com
orbit-games.com
os.mbed.com
otawa.fr
ottg.app
outflank.nl
ovd.info
ovd.legal
ovd.news
ovdinfo.org
ozodi.org
packages.gitlab.com
paddle.com
paddlestatus.com
padi.com
pages.dev
pandasecurity.com
pap.pl
paperpaper.io
paperpaper.ru
parallels.cn
parallels.com
parallels.net
parallelsaccess.com
paraswap.io
paritydeals.com
parsec.app
parts-express.com
path3.xtracloud.net
patreon.com
patreonusercontent.com
patriot.dp.ua
pay.buckaroo.nl
paypal.com
paywithmoon.com
pb.wtf
pbs.twimg.com
pcbway.com
pcbway.ru
pcgamesn.com
pcmag.com
pcspecialist.co.uk
pdfexpert.com
pencil.dev
penguin.com
penguinrandomhouse.com
pepephone.com
pepperl-fuchs.com
perforce.com
periscope.tv
peter-tanner.com
pexels.com
philiascans.org
philscomputerlab.com
phishtank.com
phncdn.com
phncdn.com.sds.rncdn7.com
phoenixcontact.com
photonengine.com
photopea.com
php.su
pi.ai
piccy.info
picoxr.com
pimeyes.com
pimpletv.ru
pingdom.com
piratbit.top
pixabay.com
pixiv.net
pkgs.tailscale.com
plab.site
platform.activestate.com
platform.twitter.com
playboy.com
plugin-alliance.com
plugins.jetbrains.com
plugshare.com
pluralsight.com
pny.com
polit.ru
politico.eu
politiken.dk
polymarket.com
pornhub.com
pornhub.org
pornolab.net
portal.bgpmon.net
portal.lviv.ua
posle.media
posthog.com
postimees.ee
pravda.com
pravda.com.ua
premierleague.com
prh.com
primark.com
primevideo.com
primevue.org
privatekeys.pw
prnt.sc
proactivebackend-pa.googleapis.com
production-openaicom-storage.azureedge.net
proekt.media
profitwell.com
promods.net
pronouns.page
prosleduetmedia.com
prostovpn.org
proton.me
protonmail.com
protonvpn.com
provereno.media
prowlarr.com
proxy.individual.githubcopilot.com
pscp.tv
psiphon.ca
ptc.com
public.parsec.app
pump.fun
pvpessence.com
pxl.to
qaweb.dev
qcad.org
qobuz.com
qodana.cloud
qoder.com
qt.io
qualcomm.com
quicknode.com
quora.com
quora.com.cdn.cloudflare.net
qwant.com
r4.err.ee
radarr.servarr.com
radarr.video
radiojar.com
radiosakharov.org
radiosvoboda.org
ratatype.com
raw-data.gitlab.io
raycast-releases.com
raycast.com
razer.com
rbc.ua
reactflow.dev
readdle.com
readybot.io
realbooru.com
realist.online
recraft.ai
reddxxx.com
redgifs.com
redis.com
redis.io
redislabs.com
redshieldvpn.com
redtube.com
refactoring.guru
refinitiv.com
registry.terraform.io
reka.ai
releases.hashicorp.com
remna.st
remove.bg
render-state.to
rentry.co
rentry.org
replicate.com
repo.mongodb.org
republic.ru
research.net
resp.app
restream.io
returnyoutubedislikeapi.com
reve.art
reverb.com
rezka-ua.in
rezka.ag
rezka.cc
rezka.fi
rezka.land
rezka.my
rezka.tv
rezkify.com
rezonans.media
rf.dobrochan.net
rferl.org
ribbonsoft.com
ridl.io
rima.media
riperam.org
riseup.net
roar-review.com
root-nation.com
roskomsvoboda.org
rpm.grafana.com
ru.bellingcat.com
ru.depositphotos.com
ru.euronews.com
ru.iherb.com
ru.krymr.com
rublacklist.net
ruckuswireless.com
rule34.art
rule34.us
rule34.xxx
rus-media.org
rus.delfi.ee
rus.delfi.lv
rus.jauns.lv
ruscryde.net
rustorka.com
rutor.info
rutor.is
rutor.org
rutracker.cc
rutracker.net
rutracker.org
rutracker.ru
rutracker.wiki
s3-1.amazonaws.com
sakhalin.info
sakharovfoundation.org
salesforce-experience.com
salesforce-hub.com
salesforce-scrt.com
salesforce-setup.com
salesforce-sites.com
salesforce.com
salesforceiq.com
salesforceliveagent.com
samsclub.com
sankakuapi.com
sankakucomplex.com
sankakustatic.com
sans.edu
sap.com
saveeditonline.com
saverudata.info
saverudata.net
sbom.sh
schaeffler.com
schenker-tech.de
schneider-electric.com
sci-hub.se
sci-hub.st
scontent.cdninstagram.com
screamingfrog.co.uk
scrollrevealjs.org
scryde.io
scryde.net
scryde.ru
scryde.world
scryde1.net
scryde10.net
scryde11.net
scryde12.net
scryde2.net
scryde3.net
scryde4.net
scryde5.net
scryde6.net
scryde7.net
scryde8.net
scryde9.net
sdxcentral.com
se.com
seagate.com
searchfloor.org
seasonvar.ru
sebeanus.online
seconddinnertech.com
secure-web.cisco.com
securitytrails.com
seedoff.zannn.top
seekvectorlogo.net
selezen.org
semnasem.org
semrush.com
sendy.jp
sentry.dev
sentry.io
sephora.com
serato.com
serialcart.com
serif.com
serpstat.com
servarr.com
serverkast.com
setapp.com
severreal.org
sfdcopens.com
sharefile.com
sharefile.io
shikimori.me
shikimori.one
shiksha.com
shinyhardware.co.uk
shiza-project.com
shop.gameloft.com
shopee.co.id
shopee.tw
shouldianswer.net
showip.net
showtime.com
sibreal.org
siemens-home.bsh-group.com
siemens.com
signal.org
sigsauer.com
simplex.chat
simplex.im
simplix.info
singlekey-id.com
site.com
siteground.com
skat.media
sketchup.com
skiff.com
skladchik.com
sklatchiki.ru
sky.com
skycdp.com
skyscanner.com
skyshowtime.com
slashlib.me
slavicsac.com
slideshare.net
slifki.biz
smartbear.co
smartbear.com
smartdeploy.com
sms-activate.io
snapgametech.com
snapgene.com
snapmagic.com
sndcdn.com
snort.org
snyk.io
soapui.org
sobesednik.com
sobesednik.ru
socradar.io
software.cisco.com
solarwinds.com
solidstatelogic.com
sonara.ai
sophos.com
sora.com
sotaproject.com
soundcloud.cloud
soundcloud.com
sovetromantica.com
spacelift.io
speedtest.net
spektr.press
spiceworks.com
spiegel.de
spitfireaudio.com
splunk.com
splunkcloud.com
spotify.com
spreadthesign.com
sputnikipogrom.com
squadbustersgame.com
square.com
squareup.com
squietpc.com
st.com
st.kinovod.net
stalker2.com
startmail.com
startpage.com
static-ss.xvideos-cdn.com
static.app
static.cdninstagram.com
static.files.bbci.co.uk
static.lostfilm.top
static.rutracker.cc
statology.org
status.discordapp.com
steamidfinder.com
steamstat.info
steganos.com
stereophile.com
stockx.com
strana.news
strana.today
strava.com
streamable.com
studychat.app
stuff.co.nz
stulchik.net
suggestqueries.google.com
summerana.com
supersliv.biz
support.anydesk.com
support.cambiumnetworks.com
support.huawei.com
support.ruckuswireless.com
support.xerox.com
surfshark.com
surveymonkey.com
suspilne.media
svidomi.in.ua
svoboda.org
svoi.kr.ua
svtv.org
swagger.io
swapd.co
swissinfo.ch
sydney.bing.com
syncfusion.com
synoforum.com
synopsys.com
sysdig.com
syslog-ng.com
systemtek.co.uk
t-invariant.org
t.co
tableau.com
tailscale.com
talosintelligence.com
target.com
tayga.info
tcr9i.chat.openai.com
te-st.org
te.com
teamviewer.com
techbargains.com
technobezz.com
telegraf.by
telegraf.news
telegraph.co.uk
telemetr.io
tellapart.com
templatemonster.com
tempmail.plus
temu.com
tenable.com
terraform.io
teslasoft.org
the-village.ru
theaudiodb.com
thebarentsobserver.com
thebell.io
theins.press
theins.ru
themoscowtimes.com
themoviedb.org
thenorthface.com
thenorthfacerenewed.com
thepiratebay.org
theporndude.com
thesassway.com
thetruestory.news
thetvdb.com
thinkpads.com
thomas-krenn.com
threads.com
threads.net
threema.ch
ti.com
tidal.com
tik-tokapi.com
tiktok.com
tiktokcdn-eu.com
tiktokcdn-us.com
tiktokcdn.com
tiktokd.net
tiktokd.org
tiktokv.com
tiktokv.eu
tiktokv.us
tiktokw.us
timberland.com
timberland.de
tiptop-vpn.com
tjournal.ru
tmdb-image-prod.b-cdn.net
tmdb.com
tmdb.org
together.ai
tokenized.play.google.com
tommy.com
toolbox.app
tools.cisco.com
torproject.org
torrent.by
torrenteditor.com
torrentgalaxy.to
tr.anidub.com
tracker.opentrackr.org
trae.ai
trailblazer.me
trailhead.com
transferwise.com
trellix.com
tria.ge
trionworlds.com
trueblackmetalradio.com
truthsocial.com
tsheets.com
tsmc.com
ttwstatic.com
turbobit.net
tuta.com
tuta.io
tutanota.com
tvdevinfo.com
tvfreedom.io
tvn24.pl
tvrain.ru
tvrain.tv
tweetdeck.com
twimg.com
twin.me
twinlife-systems.com
twinme.com
twirpx.com
twitpic.com
twitter.biz
twitter.com
twitter.jp
twittercommunity.com
twitterflightschool.com
twitterinc.com
twitteroauth.com
twitterstat.us
twtrdns.net
twttr.com
twttr.net
twvid.com
typing.com
uaudio.com
ubnt.com
ufile.io
ui.ill.in.ua
uizard.io
ukdevilz.com
ukr.net
ukr.radio
ukrainer.net
ukrinform.net
ukrtelcdn.net
ultimaker.com
ultraedit.com
underver.se
undress.cc
unfiltered.adguard-dns.com
unian.net
unian.ua
uniongang.tv
unscreen.com
unsplash.com
upv.es
upwork.com
urlr.me
usa.canon.com
usa.one
usatoday.com
usher.ttvnw.net
v.vrv.co
vagrantcloud.com
vaio.com
vans.com
vans.de
vans.fr
vans.it
vans.nl
vans.se
vectorworks.net
veeam.com
velocidrone.com
verificationacademy.com
veritas.com
verstka.media
vesma.one
vesma.today
vesty.co.il
vhd.zetflix.online
viber.com
vice.com
video.twimg.com
vine.co
vipdrive.net
viperatech.com
vipergirls.to
visualcapitalist.com
vmware.com
vndb.org
voanews.com
vod-fy.crunchyrollcdn.com
voidboost.cc
volet.com
volkswagen-classic-parts.com
vot-tak.tv
vpngate.net
vpngen.org
vpnlove.me
vpnpay.io
vpnunlimited.com
vrv.co
vyos.io
vyos.net
w.atwiki.jp
wa.me
wakanim.tv
wall.alphacoders.com
walletconnect.com
wallpapercave.com
walmart.com
watchguard.com
watermarkremover.io
wdfiles.com
we.tl
weather.com
web.archive.org
webex.com
weblance.com.ua
webmd.com
webnames.ca
webscraper.io
webtoons.com
weebly.com
wellfound.com
welt.de
wetransfer.com
whatsapp.biz
whatsapp.com
whatsapp.net
wheather.com
wide-youtube.l.google.com
widgetapp.stream
wiki.fextralife.com
wikidot.com
wilsoncenter.org
windguru.cz
windows10spotlight.com
windriver.com
windsurf.com
wise.com
wixmp.com
wk.cz
wonderclub.com
wonderzine.com
wpengine.com
wrs.com
wunderground.com
www.analog.com
www.bbc.com
www.cisco.com
www.citrix.com
www.currenttime.tv
www.dell.com
www.digitalocean.com
www.dw.com
www.grammarly.com
www.hetzner.com
www.hrw.org
www.intel.com
www.jabra.com
www.kavkazr.com
www.lenovo.com
www.lostfilm.tv
www.lostfilmtv5.site
www.microchip.com
www.moscowtimes.ru
www.mouser.com
www.postfix.org
www.qualcomm.com
www.smashwords.com
www.stalker2.com
www.support.xerox.com
www.the-village.ru
www.themoviedb.org
www.ti.com
www.torproject.org
www.wikiart.org
www.wunderground.com
www3.corsair.com
x-minus.pro
x.ai
x.com
xdaforums.com
xenserver.com
xerox.com
xfantazy.com
xhamster.com
xhamsterlive.com
xhcdn.com
xiaomi.eu
xmg.gg
xnxx-cdn.com
xnxx-ru.com
xnxx.com
xnxx.net
xnxx.tv
xnxx3.com
xrite.com
xtracloud.net
xv-ru.com
xvideos-cdn.com
xvideos.com
yande.re
yeggi.com
yithemes.com
yle.fi
yourdictionary.com
youtrack.cloud
youtu.be
youtube-nocookie.com
youtube-ui.l.google.com
youtube.com
youtubeembeddedplayer.googleapis.com
youtubei.googleapis.com
youtubekids.com
yt-video-upload.l.google.com
yt.be
yt3.googleusercontent.com
ytimg.com
ytimg.l.google.com
yting.com
yummyani.me
zahav.ru
zapier.com
zaxid.net
zbigz.com
zedge.net
zerkalo.io
zerossl.com
zetalliance.org
zetflix.online
zf.com
zimbra.com
zimbra.org
znanija.com
zohomail.com
zomato.com
zona.media
zoosk.com
OUM_ROUTING_EOF
}
oum_deploy_converter() {
    if [ -n "${OUM_CONVERTER_PATH:-}" ] && [ -f "$OUM_CONVERTER_PATH" ]; then
        printf '%s\n' "$OUM_CONVERTER_PATH"
        return 0
    fi
    converter="$OUM_TMP_DIR/source_converter.rb"
    oum_write_source_converter "$converter"
    chmod 700 "$converter"
    printf '%s\n' "$converter"
}

oum_profile_name() {
    case "$1" in
        subscription) printf '%s\n' 'Subscription.yaml' ;;
        awg) printf '%s\n' 'AWG_Tunnel.yaml' ;;
        reality) printf '%s\n' 'Proxy.yaml' ;;
        *) return 1 ;;
    esac
}

oum_managed_profiles() {
    printf '%s\n' \
        'Subscription.yaml' 'AWG_Tunnel.yaml' 'Proxy.yaml' \
        'oum-subscription.yaml' 'oum-amnezia.yaml' 'oum-reality.yaml' 'oum.yaml'
}

oum_clear_subscription_info() {
    uci -q delete openclash.oum_subscription_info >/dev/null 2>&1 || true
}

oum_set_subscription_info() {
    url="$1"
    oum_clear_subscription_info
    uci set openclash.oum_subscription_info='subscribe_info'
    uci set openclash.oum_subscription_info.name='Subscription'
    uci set "openclash.oum_subscription_info.url=$url"
}

oum_discard_source_transaction() {
    transaction="$1"
    [ -d "$transaction" ] || return 0
    find "$transaction" -type f -exec rm -f {} \; 2>/dev/null || true
    rmdir "$transaction/config" 2>/dev/null || true
    rmdir "$transaction" 2>/dev/null || true
}

oum_restore_source_transaction() {
    transaction="$1"
    was_running="$2"
    /etc/init.d/openclash stop >/dev/null 2>&1 || true
    for profile in $(oum_managed_profiles); do
        rm -f "$OPENCLASH_DIR/config/$profile" "$OPENCLASH_DIR/$profile"
    done
    if [ -d "$transaction/config" ]; then
        for saved in "$transaction"/config/*; do
            [ -f "$saved" ] && cp "$saved" "$OPENCLASH_DIR/config/$(basename "$saved")"
        done
    fi
    if [ -f "$transaction/openclash.uci" ]; then
        cp "$transaction/openclash.uci" /etc/config/openclash
    fi
    if [ "$was_running" = 1 ]; then
        /etc/init.d/openclash start >/dev/null 2>&1 || true
    fi
    oum_discard_source_transaction "$transaction"
}

oum_activate_single_profile() {
    candidate="$1"
    source_kind="$2"
    subscription_url="${3:-}"
    profile="$(oum_profile_name "$source_kind")" || return 1
    target="$OPENCLASH_DIR/config/$profile"
    core="$(oum_mihomo_core)" || { oum_err "Mihomo не найден"; return 1; }
    transaction="$OUM_BACKUP_DIR/source-switch-$(date +%Y%m%d-%H%M%S)"
    mkdir -p "$transaction/config" "$OPENCLASH_DIR/config"
    chmod 700 "$transaction" "$transaction/config"
    cp /etc/config/openclash "$transaction/openclash.uci" || return 1
    chmod 600 "$transaction/openclash.uci"
    for old_profile in $(oum_managed_profiles); do
        [ -f "$OPENCLASH_DIR/config/$old_profile" ] && cp "$OPENCLASH_DIR/config/$old_profile" "$transaction/config/$old_profile"
    done
    was_running=0
    pgrep -f 'clash_meta|mihomo|/clash ' >/dev/null 2>&1 && was_running=1

    oum_info "Останавливаем OpenClash и проверяем новый профиль"
    /etc/init.d/openclash stop >/dev/null 2>&1 || true
    if ! "$core" -t -d "$OPENCLASH_DIR" -f "$candidate"; then
        [ "$was_running" = 1 ] && /etc/init.d/openclash start >/dev/null 2>&1 || true
        oum_discard_source_transaction "$transaction"
        oum_err "Mihomo отклонил новый профиль; старый источник не изменён"
        return 1
    fi

    cp "$candidate" "$target" || {
        oum_restore_source_transaction "$transaction" "$was_running"
        return 1
    }
    chmod 600 "$target"
    uci set "openclash.config.config_path=$target"
    uci set openclash.config.enable='1'
    if [ "$source_kind" = subscription ]; then
        oum_set_subscription_info "$subscription_url"
    else
        oum_clear_subscription_info
    fi
    uci commit openclash
    chmod 600 /etc/config/openclash
    /etc/init.d/podkop stop >/dev/null 2>&1 || true
    /etc/init.d/podkop disable >/dev/null 2>&1 || true
    /etc/init.d/openclash enable >/dev/null 2>&1 || true
    /etc/init.d/openclash start >/dev/null 2>&1 || true

    elapsed=0
    started=0
    while [ "$elapsed" -lt 45 ]; do
        if pgrep -f "/etc/openclash/$profile" >/dev/null 2>&1; then
            started=1
            break
        fi
        sleep 2
        elapsed=$((elapsed + 2))
    done
    if [ "$started" -ne 1 ]; then
        oum_err "OpenClash не загрузил выбранный профиль; выполняем откат"
        oum_restore_source_transaction "$transaction" "$was_running"
        return 1
    fi

    for old_profile in $(oum_managed_profiles); do
        [ "$old_profile" = "$profile" ] && continue
        rm -f "$OPENCLASH_DIR/config/$old_profile" "$OPENCLASH_DIR/$old_profile"
    done
    for provider in "$OPENCLASH_DIR"/proxy_provider/oum-*.yaml; do
        [ -f "$provider" ] && rm -f "$provider"
    done
    printf '%s\n' "$source_kind" > "$OUM_STATE_DIR/active_source"
    printf '%s\n' "$target" > "$OUM_STATE_DIR/active_profile"
    chmod 600 "$OUM_STATE_DIR/active_source" "$OUM_STATE_DIR/active_profile"
    printf '%s\n' openclash > "$OUM_STATE_DIR/proxy_backend"
    chmod 600 "$OUM_STATE_DIR/proxy_backend"
    oum_discard_source_transaction "$transaction"
    oum_log "active source replaced type=$source_kind profile=$profile"
    oum_ok "$profile активирован; предыдущий OUM-источник удалён"
}

oum_install_source() {
    mode="$1"
    input="$2"
    display_name="$3"
    source_kind="$4"
    subscription_url="${5:-}"
    oum_ensure_openclash || return 1
    oum_require_runtime || return 1
    converter="$(oum_deploy_converter)" || return 1
    provider_tmp="$OUM_TMP_DIR/source.yaml"
    candidate="$OUM_TMP_DIR/profile.yaml"

    case "$mode" in
        awg) ruby "$converter" awg "$input" "$provider_tmp" "$display_name" || return 1 ;;
        uris) ruby "$converter" uris "$input" "$provider_tmp" || return 1 ;;
        subscription) ruby "$converter" subscription "$input" "$provider_tmp" || return 1 ;;
        *) oum_err "Неизвестный тип источника"; return 1 ;;
    esac
    chmod 600 "$provider_tmp"
    ruby "$converter" standalone "$candidate" "$provider_tmp" "$source_kind" || return 1
    chmod 600 "$candidate"
    oum_activate_single_profile "$candidate" "$source_kind" "$subscription_url"
}

oum_import_subscription() {
    oum_header
    oum_prepare_dirs
    oum_warn "Новый профиль Subscription полностью заменит текущий OUM-источник"
    url="$(oum_read_secret 'URL подписки (ввод скрыт): ')"
    [ -n "$url" ] || { oum_warn "Отменено"; return; }
    case "$url" in http://*|https://*) ;; *) unset url; oum_err "Нужен URL http(s)"; return 1 ;; esac
    input="$OUM_TMP_DIR/subscription.input"
    if ! oum_download "$url" "$input"; then
        unset url
        oum_err "Не удалось загрузить подписку"
        return 1
    fi
    chmod 600 "$input"
    oum_install_source subscription "$input" "" subscription "$url"
    result=$?
    unset url
    return "$result"
}

oum_import_uri_text() {
    oum_header
    oum_prepare_dirs
    oum_warn "Новый профиль Proxy полностью заменит текущий OUM-источник"
    oum_info "Вставьте одну или несколько ссылок VLESS/Hysteria2"
    oum_info "После последней строки введите одну точку: ."
    input="$OUM_TMP_DIR/uris.input"
    : > "$input"
    chmod 600 "$input"
    while IFS= read -r line; do
        [ "$line" = "." ] && break
        printf '%s\n' "$line" >> "$input"
    done
    [ -s "$input" ] || { oum_warn "Ничего не введено"; return; }
    oum_install_source uris "$input" "" reality
}

oum_import_awg_file() {
    oum_header
    oum_warn "Новый профиль AWG_Tunnel полностью заменит текущий OUM-источник"
    printf 'Путь к AWG .conf: '
    IFS= read -r input
    [ -f "$input" ] || { oum_err "Файл не найден"; return 1; }
    printf 'Название ноды [AWG_Node]: '
    IFS= read -r display_name
    [ -n "$display_name" ] || display_name="AWG_Node"
    oum_install_source awg "$input" "$display_name" awg
}

oum_import_awg_text() {
    oum_header
    oum_prepare_dirs
    oum_warn "Новый профиль AWG_Tunnel полностью заменит текущий OUM-источник"
    oum_info "Вставьте AWG-конфиг целиком; после него введите одну точку: ."
    input="$OUM_TMP_DIR/awg.input"
    : > "$input"
    chmod 600 "$input"
    while IFS= read -r line; do
        [ "$line" = "." ] && break
        printf '%s\n' "$line" >> "$input"
    done
    [ -s "$input" ] || { oum_warn "Ничего не введено"; return; }
    printf 'Название ноды [AWG_Node]: '
    IFS= read -r display_name
    [ -n "$display_name" ] || display_name="AWG_Node"
    oum_install_source awg "$input" "$display_name" awg
}

oum_show_active_source() {
    oum_header
    source_kind="$(sed -n '1p' "$OUM_STATE_DIR/active_source" 2>/dev/null)"
    profile="$(uci -q get openclash.config.config_path 2>/dev/null)"
    runtime=""
    for managed in Subscription.yaml AWG_Tunnel.yaml Proxy.yaml; do
        pgrep -f "/etc/openclash/$managed" >/dev/null 2>&1 && runtime="$managed"
    done
    printf 'Источник: %s\n' "${source_kind:-не настроен}"
    printf 'Выбранный профиль: %s\n' "${profile:-не настроен}"
    printf 'Загружен ядром: %s\n' "${runtime:-не запущен}"
    if [ -n "$profile" ] && [ "$(basename "$profile")" = "$runtime" ]; then
        oum_ok "Выбранный и запущенный профили совпадают"
    elif [ -n "$profile" ]; then
        oum_err "Выбранный профиль не совпадает с запущенным"
    fi
}

oum_sources_menu() {
    while true; do
        oum_header
        printf '%s\n' \
            "=== Единственное активное подключение ===" \
            "1) Subscription — добавить подписку URL" \
            "2) Proxy — вставить VLESS/Hysteria2/Reality" \
            "3) AWG_Tunnel — вставить конфиг" \
            "4) AWG_Tunnel — импортировать файл" \
            "5) Показать активный источник" \
            "" \
            "Добавление нового источника заменяет предыдущий." \
            "Enter — Назад"
        printf 'Выбор: '
        IFS= read -r choice
        case "$choice" in
            "") break ;;
            1) oum_import_subscription; oum_pause ;;
            2) oum_import_uri_text; oum_pause ;;
            3) oum_import_awg_text; oum_pause ;;
            4) oum_import_awg_file; oum_pause ;;
            5) oum_show_active_source; oum_pause ;;
            *) oum_err "Неверный выбор"; oum_pause ;;
        esac
    done
}
oum_wifi_interfaces() {
    uci -q show wireless 2>/dev/null | sed -n "s/^wireless\.\([^.=]*\)=wifi-iface$/\1/p"
}

oum_wifi_setup() {
    oum_header
    printf 'Новое имя Wi-Fi (SSID): '
    IFS= read -r ssid
    [ -n "$ssid" ] || { oum_warn "SSID не изменён"; return; }
    password="$(oum_read_secret 'Новый пароль Wi-Fi (минимум 8 символов): ')"
    if [ "${#password}" -lt 8 ]; then
        unset password
        oum_err "Пароль WPA должен содержать минимум 8 символов"
        return 1
    fi
    interfaces="$(oum_wifi_interfaces)"
    [ -n "$interfaces" ] || { unset password; oum_err "Wi-Fi интерфейсы не найдены"; return 1; }
    oum_backup_system || { unset password; return 1; }
    for interface in $interfaces; do
        mode="$(uci -q get "wireless.${interface}.mode")"
        [ "$mode" = "ap" ] || continue
        uci set "wireless.${interface}.ssid=$ssid"
        uci set "wireless.${interface}.encryption=sae-mixed"
        uci set "wireless.${interface}.key=$password"
    done
    unset password
    uci commit wireless
    wifi reload
    oum_ok "SSID и пароль применены ко всем точкам доступа"
}

oum_network_menu() {
    while true; do
        oum_header
        printf '%s\n' \
            "=== Wi-Fi и локальная сеть ===" \
            "1) Изменить SSID и пароль Wi-Fi" \
            "2) Показать LAN IP" \
            "" \
            "Enter — Назад"
        printf 'Выбор: '
        IFS= read -r choice
        case "$choice" in
            "") break ;;
            1) oum_wifi_setup; oum_pause ;;
            2) printf 'LAN IP: %s\n' "$(uci -q get network.lan.ipaddr || echo 'не задан')"; oum_pause ;;
            *) oum_err "Неверный выбор"; oum_pause ;;
        esac
    done
}
oum_diagnostics() {
    oum_header
    printf 'OUM: %s\n' "$OUM_VERSION"
    printf 'OpenWrt: %s\n' "$(. /etc/openwrt_release 2>/dev/null; printf '%s' "${DISTRIB_DESCRIPTION:-неизвестно}")"
    printf 'Пакетный менеджер: %s\n' "$(oum_pkg_manager 2>/dev/null || echo 'не найден')"
    config="$(oum_openclash_config 2>/dev/null || true)"
    core="$(oum_mihomo_core 2>/dev/null || true)"
    printf 'OpenClash YAML: %s\n' "${config:-не найден}"
    if [ -n "$core" ]; then
        "$core" -v 2>/dev/null | head -n 1
    else
        printf 'Mihomo: не найден\n'
    fi
    if pgrep -f 'clash_meta|mihomo|/clash ' >/dev/null 2>&1; then
        oum_ok "OpenClash работает"
    else
        oum_warn "OpenClash не запущен"
    fi
    printf '\nПамять:\n'
    free -m 2>/dev/null || true
    printf '\nХранилище:\n'
    df -h /overlay 2>/dev/null || true
    printf '\nOUM active source:\n'
    printf ' • %s\n' "$(sed -n '1p' "$OUM_STATE_DIR/active_source" 2>/dev/null || echo 'не настроен')"
    runtime=""
    for profile_name in Subscription.yaml AWG_Tunnel.yaml Proxy.yaml; do
        pgrep -f "/etc/openclash/$profile_name" >/dev/null 2>&1 && runtime="$profile_name"
    done
    printf ' • загружен ядром: %s\n' "${runtime:-не запущен}"
    printf '\nПоследние события OUM (без секретов):\n'
    tail -n 15 /var/log/oum/oum.log 2>/dev/null || printf 'Лог пока пуст.\n'
}

oum_validate_active_config() {
    config="$(oum_openclash_config)" || { oum_err "OpenClash YAML не найден"; return 1; }
    core="$(oum_mihomo_core)" || { oum_err "Mihomo не найден"; return 1; }
    /etc/init.d/openclash stop >/dev/null 2>&1 || true
    if "$core" -t -d "$OPENCLASH_DIR" -f "$config"; then
        oum_ok "Активная конфигурация корректна"
        result=0
    else
        oum_err "Активная конфигурация содержит ошибку"
        result=1
    fi
    /etc/init.d/openclash start >/dev/null 2>&1 || true
    return "$result"
}

oum_diagnostics_menu() {
    while true; do
        oum_header
        printf '%s\n' \
            "=== Диагностика и восстановление ===" \
            "1) Общий статус" \
            "2) Проверить активный YAML Mihomo" \
            "3) Создать системный бэкап" \
            "4) Перезапустить OpenClash" \
            "" \
            "Enter — Назад"
        printf 'Выбор: '
        IFS= read -r choice
        case "$choice" in
            "") break ;;
            1) oum_diagnostics; oum_pause ;;
            2) oum_validate_active_config; oum_pause ;;
            3) oum_backup_system; oum_pause ;;
            4) /etc/init.d/openclash restart; oum_pause ;;
            *) oum_err "Неверный выбор"; oum_pause ;;
        esac
    done
}
oum_quick_setup() {
    while true; do
        oum_header
        printf '%s\n' \
            "=== Быстрая настройка ===" \
            "1) Установить или проверить OpenClash" \
            "2) Выбрать единственное подключение" \
            "3) Настроить Wi-Fi" \
            "4) Проверить активный профиль" \
            "" \
            "Ключи вводятся только в момент добавления источника." \
            "Enter — Назад"
        printf 'Выбор: '
        IFS= read -r choice
        case "$choice" in
            "") break ;;
            1) oum_install_openclash; oum_pause ;;
            2) oum_sources_menu ;;
            3) oum_wifi_setup; oum_pause ;;
            4) oum_validate_active_config; oum_pause ;;
            *) oum_err "Неверный выбор"; oum_pause ;;
        esac
    done
}

oum_routing_menu() {
    oum_header
    oum_info "Массовая маршрутизация встроена в активный профиль."
    oum_info "Заблокированные списки идут через PROXY, остальное — напрямую."
    oum_info "Samsung и Google Play — DIRECT, Meta управляется группой META."
    oum_info "Правила блокировки торрентов не добавляются."
    oum_pause
}

oum_services_menu() {
    oum_header
    oum_info "NAS, SQM, GearUP и остальные модули сохранены в scripts/."
    oum_info "Они будут подключаться после стабилизации OpenClash-ядра OUM."
    oum_pause
}

oum_advanced_menu() {
    oum_header
    printf 'Версия: %s\n' "$OUM_VERSION"
    printf 'State: %s\n' "$OUM_STATE_DIR"
    printf 'Backups: %s\n' "$OUM_BACKUP_DIR"
    printf 'OpenClash: %s\n' "$OPENCLASH_DIR"
    oum_warn "Это тестовая ветка. Не используйте постоянные ключи."
    oum_pause
}

oum_main_menu() {
    while true; do
        oum_header
        printf '%s\n' \
            "1) Быстрая настройка роутера" \
            "2) Подключения и ноды" \
            "3) Маршрутизация" \
            "4) Wi-Fi и локальная сеть" \
            "5) Дополнительные сервисы" \
            "6) Диагностика и восстановление" \
            "7) Расширенные настройки" \
            "" \
            "Enter — Выход"
        printf 'Выбор: '
        IFS= read -r choice
        case "$choice" in
            "") return 0 ;;
            1) oum_quick_setup ;;
            2) oum_sources_menu ;;
            3) oum_routing_menu ;;
            4) oum_network_menu ;;
            5) oum_services_menu ;;
            6) oum_diagnostics_menu ;;
            7) oum_advanced_menu ;;
            *) oum_err "Неверный выбор"; oum_pause ;;
        esac
    done
}

if [ "${OUM_LIBRARY_MODE:-0}" != 1 ]; then
    oum_check_root
    oum_prepare_dirs
    oum_main_menu
fi
