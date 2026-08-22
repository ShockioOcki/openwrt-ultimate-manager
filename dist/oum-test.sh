#!/bin/sh
# Generated from modular sources. Do not edit dist/oum-test.sh directly.
OUM_VERSION="9.0.0-test.5"
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

MASS_RULES = [
  'RULE-SET,private-domains,DIRECT', 'RULE-SET,private-ips,DIRECT,no-resolve',
  'RULE-SET,win-spy,REJECT', 'RULE-SET,category-ads,REJECT',
  'RULE-SET,samsung,DIRECT', 'RULE-SET,google-play,DIRECT',
  'RULE-SET,meta-domains,META', 'RULE-SET,meta-ips,META,no-resolve',
  'RULE-SET,github,PROXY', 'RULE-SET,twitch-ads,PROXY', 'RULE-SET,youtube,PROXY',
  'RULE-SET,telegram,PROXY', 'RULE-SET,telegram-ips,PROXY,no-resolve',
  'RULE-SET,discord-domains,PROXY', 'RULE-SET,discord-voice-ips,PROXY,no-resolve',
  'RULE-SET,ru-blocked-domains,PROXY', 'RULE-SET,ru-blocked-ips,PROXY,no-resolve',
  'RULE-SET,category-ru,DIRECT', 'RULE-SET,whitelist,DIRECT',
  'RULE-SET,microsoft,DIRECT', 'RULE-SET,apple,DIRECT',
  'RULE-SET,epicgames,DIRECT', 'RULE-SET,riot,DIRECT',
  'RULE-SET,escapefromtarkov,DIRECT', 'RULE-SET,steam,DIRECT',
  'RULE-SET,origin,DIRECT', 'RULE-SET,twitch,DIRECT',
  'RULE-SET,pinterest,DIRECT', 'RULE-SET,faceit,DIRECT',
  'RULE-SET,direct-ips,DIRECT,no-resolve', 'MATCH,DIRECT'
].freeze

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
    providers[name] = {
      'type' => 'http', 'behavior' => behavior, 'format' => 'mrs', 'url' => url,
      'path' => "./rule_provider/#{name}.mrs", 'interval' => interval || 86_400, 'proxy' => 'DIRECT'
    }
  end
  config['rules'] = MASS_RULES.dup
  config
end

def base_config
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
      'default-nameserver' => ['1.1.1.1', '8.8.8.8'],
      'nameserver' => ['https://1.1.1.1/dns-query', 'https://8.8.8.8/dns-query']
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
