#!/bin/sh
# Generated from modular sources. Do not edit dist/oum-test.sh directly.
OUM_VERSION="9.0.0-test.2"
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
oum_write_source_converter() {
    destination="$1"
    cat > "$destination" <<'OUM_RUBY_EOF'
#!/usr/bin/env ruby
require 'yaml'

# OpenWrt's compact Ruby package normally ships without uri/cgi/base64/json.
# Keep the converter self-contained and depend only on ruby-yaml (Psych).
ShareURI = Struct.new(:scheme, :user, :host, :port, :query, :fragment)
SOURCE_GROUPS = {
  'subscription' => 'SUBSCRIPTION',
  'awg' => 'AMNEZIA',
  'reality' => 'REALITY'
}.freeze

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
  YAML.respond_to?(:unsafe_load) ? YAML.unsafe_load(text) : YAML.load(text)
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
  node['flow'] = query['flow'] unless query['flow'].to_s.empty?
  node['packet-encoding'] = query['packetEncoding'] if query['packetEncoding']
  node['tls'] = true if %w[tls reality].include?(security)
  node['servername'] = query['sni'] unless query['sni'].to_s.empty?
  node['client-fingerprint'] = query['fp'] unless query['fp'].to_s.empty?
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
    begin
      options['extra'] = load_yaml_text(query['extra']) if query['extra']
    rescue StandardError
      options['extra'] = query['extra']
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
  node['skip-cert-verify'] = %w[1 true].include?(query['insecure'].to_s.downcase) if query.key?('insecure')
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

def groups(config)
  config['proxy-groups'] = [] unless config['proxy-groups'].is_a?(Array)
  config['proxy-groups']
end

def ensure_group(config, name, type = 'select')
  group = groups(config).find { |item| item.is_a?(Hash) && item['name'] == name }
  return group if group
  group = {'name' => name, 'type' => type}
  groups(config) << group
  group
end

def append_unique(hash, key, value)
  hash[key] = [] unless hash[key].is_a?(Array)
  hash[key] << value unless hash[key].include?(value)
end

def source_group_name(kind)
  SOURCE_GROUPS.fetch(kind, 'OUM-SOURCES')
end

def attach_provider(config, id, path, kind)
  abort 'invalid provider id' unless id.match?(/\A[a-z0-9][a-z0-9_-]*\z/)
  config['proxy-providers'] = {} unless config['proxy-providers'].is_a?(Hash)
  config['proxy-providers'][id] = {
    'type' => 'file',
    'path' => path,
    'health-check' => {'enable' => true, 'url' => 'https://www.gstatic.com/generate_204', 'interval' => 600, 'lazy' => true}
  }
  source_group = ensure_group(config, source_group_name(kind))
  source_group['type'] = 'select'
  append_unique(source_group, 'use', id)
  proxy_group = ensure_group(config, 'PROXY')
  append_unique(proxy_group, 'proxies', source_group_name(kind))
  config
end


def standalone_config(config, id, path, kind)
  group_name = source_group_name(kind)
  config['proxies'] = []
  config['proxy-providers'] = {
    id => {
      'type' => 'file',
      'path' => path,
      'health-check' => {'enable' => true, 'url' => 'https://www.gstatic.com/generate_204', 'interval' => 600, 'lazy' => true}
    }
  }
  config['proxy-groups'] = [
    {'name' => 'PROXY', 'type' => 'select', 'proxies' => [group_name, 'AUTO', 'DIRECT']},
    {'name' => group_name, 'type' => 'select', 'use' => [id]},
    {'name' => 'AUTO', 'type' => 'url-test', 'use' => [id], 'url' => 'https://www.gstatic.com/generate_204', 'interval' => 300},
    {'name' => 'META', 'type' => 'select', 'proxies' => ['PROXY', 'DIRECT']}
  ]
  config
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
  write_yaml(convert_uri_list(input, filter_subscription: true), output)
when 'attach'
  input, output, id, path, kind = ARGV
  abort 'usage: attach CONFIG OUTPUT ID PATH KIND' unless input && output && id && path && kind
  write_yaml(attach_provider(load_yaml(input), id, path, kind), output)
when 'standalone'
  input, output, id, path, kind = ARGV
  abort 'usage: standalone CONFIG OUTPUT ID PATH KIND' unless input && output && id && path && kind
  write_yaml(standalone_config(load_yaml(input), id, path, kind), output)
else
  abort 'modes: awg, uris, subscription, attach, standalone'
end
OUM_RUBY_EOF
}
oum_provider_id() {
    prefix="$1"
    printf 'oum-%s-%s\n' "$prefix" "$(date +%Y%m%d%H%M%S)"
}

oum_deploy_converter() {
    converter="$OUM_TMP_DIR/source_converter.rb"
    oum_write_source_converter "$converter"
    chmod 700 "$converter"
    printf '%s\n' "$converter"
}

oum_apply_openclash_candidate() {
    candidate="$1"
    active="$2"
    core="$(oum_mihomo_core)" || { oum_err "Ядро Mihomo не найдено"; return 1; }
    oum_prepare_dirs
    backup="$OUM_BACKUP_DIR/openclash-$(date +%Y%m%d-%H%M%S).yaml"
    cp "$active" "$backup" || return 1
    chmod 600 "$backup"

    oum_info "Останавливаем OpenClash для проверки без второго ядра в памяти"
    /etc/init.d/openclash stop >/dev/null 2>&1 || true
    if ! "$core" -t -d "$OPENCLASH_DIR" -f "$candidate"; then
        /etc/init.d/openclash start >/dev/null 2>&1 || true
        oum_err "Mihomo отклонил новый конфиг; активный YAML не изменён"
        return 1
    fi
    cp "$candidate" "$active" || {
        cp "$backup" "$active"
        /etc/init.d/openclash start >/dev/null 2>&1 || true
        return 1
    }
    chmod 600 "$active"
    /etc/init.d/podkop stop >/dev/null 2>&1 || true
    /etc/init.d/podkop disable >/dev/null 2>&1 || true
    printf '%s\n' openclash > "$OUM_STATE_DIR/proxy_backend"
    /etc/init.d/openclash enable >/dev/null 2>&1 || true
    /etc/init.d/openclash start >/dev/null 2>&1 || true

    elapsed=0
    while [ "$elapsed" -lt 30 ]; do
        pgrep -f 'clash_meta|mihomo|/clash ' >/dev/null 2>&1 && {
            oum_ok "OpenClash запущен; бэкап: $backup"
            return 0
        }
        sleep 2
        elapsed=$((elapsed + 2))
    done
    oum_err "OpenClash не запустился; восстанавливаем предыдущий YAML"
    cp "$backup" "$active"
    /etc/init.d/openclash restart >/dev/null 2>&1 || true
    return 1
}

oum_save_standalone_config() {
    candidate="$1"
    source_kind="$2"
    core="$(oum_mihomo_core)" || { oum_err "Ядро Mihomo не найдено"; return 1; }
    case "$source_kind" in
        subscription) config_name="oum-subscription.yaml" ;;
        awg) config_name="oum-amnezia.yaml" ;;
        reality) config_name="oum-reality.yaml" ;;
        *) config_name="oum-source.yaml" ;;
    esac
    target="$OPENCLASH_DIR/config/$config_name"
    mkdir -p "$OPENCLASH_DIR/config"
    backup=""
    if [ -f "$target" ]; then
        backup="$OUM_BACKUP_DIR/${config_name%.yaml}-$(date +%Y%m%d-%H%M%S).yaml"
        cp "$target" "$backup"
    fi
    oum_info "Проверяем отдельный конфиг; OpenClash будет кратко остановлен"
    /etc/init.d/openclash stop >/dev/null 2>&1 || true
    if ! "$core" -t -d "$OPENCLASH_DIR" -f "$candidate"; then
        /etc/init.d/openclash start >/dev/null 2>&1 || true
        oum_err "Mihomo отклонил отдельный конфиг"
        return 1
    fi
    cp "$candidate" "$target" || {
        /etc/init.d/openclash start >/dev/null 2>&1 || true
        return 1
    }
    chmod 600 "$target"
    /etc/init.d/openclash start >/dev/null 2>&1 || true
    oum_ok "Создан $target"
    oum_info "Он появится в OpenClash → Config File. Активный конфиг не переключался."
    [ -n "$backup" ] && oum_info "Предыдущая версия: $backup"
}

oum_install_provider() {
    mode="$1"
    input="$2"
    provider_id="$3"
    display_name="$4"
    source_kind="$5"
    oum_require_runtime || return 1
    active="$(oum_openclash_config)" || { oum_err "Активный OpenClash YAML не найден"; return 1; }
    converter="$(oum_deploy_converter)" || return 1
    mkdir -p "$OPENCLASH_DIR/proxy_provider"
    provider_tmp="$OUM_TMP_DIR/${provider_id}.yaml"
    provider_final="$OPENCLASH_DIR/proxy_provider/${provider_id}.yaml"
    candidate="$OUM_TMP_DIR/openclash-candidate.yaml"

    case "$mode" in
        awg) ruby "$converter" awg "$input" "$provider_tmp" "$display_name" || return 1 ;;
        uris) ruby "$converter" uris "$input" "$provider_tmp" || return 1 ;;
        subscription) ruby "$converter" subscription "$input" "$provider_tmp" || return 1 ;;
        *) oum_err "Неизвестный тип источника"; return 1 ;;
    esac
    chmod 600 "$provider_tmp"
    provider_backup=""
    if [ -f "$provider_final" ]; then
        provider_backup="$OUM_BACKUP_DIR/${provider_id}-$(date +%Y%m%d-%H%M%S).yaml"
        cp "$provider_final" "$provider_backup"
    fi
    cp "$provider_tmp" "$provider_final" || return 1
    chmod 600 "$provider_final"
    relative_path="./proxy_provider/${provider_id}.yaml"
    printf '%s\n' \
        "Как подключить источник?" \
        "1) Отдельный Config File (рекомендуется)" \
        "2) Добавить в активный объединённый конфиг"
    printf 'Выбор [1]: '
    IFS= read -r config_mode
    [ -n "$config_mode" ] || config_mode=1
    case "$config_mode" in
        1)
            if ! ruby "$converter" standalone "$active" "$candidate" "$provider_id" "$relative_path" "$source_kind" || ! oum_save_standalone_config "$candidate" "$source_kind"; then
                if [ -n "$provider_backup" ]; then cp "$provider_backup" "$provider_final"; else rm -f "$provider_final"; fi
                return 1
            fi
            ;;
        2)
            if ! ruby "$converter" attach "$active" "$candidate" "$provider_id" "$relative_path" "$source_kind" || ! oum_apply_openclash_candidate "$candidate" "$active"; then
                if [ -n "$provider_backup" ]; then cp "$provider_backup" "$provider_final"; else rm -f "$provider_final"; fi
                return 1
            fi
            case "$source_kind" in
                subscription) group_name="SUBSCRIPTION" ;;
                awg) group_name="AMNEZIA" ;;
                reality) group_name="REALITY" ;;
                *) group_name="OUM-SOURCES" ;;
            esac
            oum_ok "Источник добавлен в группу $group_name"
            ;;
        *)
            if [ -n "$provider_backup" ]; then cp "$provider_backup" "$provider_final"; else rm -f "$provider_final"; fi
            oum_err "Неверный режим"
            return 1
            ;;
    esac
    oum_log "provider installed id=$provider_id type=$source_kind mode=$config_mode"
}

oum_import_subscription() {
    oum_header
    oum_prepare_dirs
    url="$(oum_read_secret 'URL подписки (ввод скрыт): ')"
    [ -n "$url" ] || { oum_warn "Отменено"; return; }
    case "$url" in http://*|https://*) ;; *) unset url; oum_err "Нужен URL http(s)"; return 1 ;; esac
    input="$OUM_TMP_DIR/subscription.input"
    if ! oum_download "$url" "$input"; then
        unset url
        oum_err "Не удалось загрузить подписку"
        return 1
    fi
    unset url
    chmod 600 "$input"
    provider_id="$(oum_provider_id subscription)"
    oum_install_provider subscription "$input" "$provider_id" "" subscription
}

oum_import_uri_text() {
    oum_header
    oum_prepare_dirs
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
    provider_id="$(oum_provider_id manual)"
    oum_install_provider uris "$input" "$provider_id" "" reality
}

oum_import_awg_file() {
    oum_header
    printf 'Путь к AWG .conf: '
    IFS= read -r input
    [ -f "$input" ] || { oum_err "Файл не найден"; return 1; }
    printf 'Название ноды [OUM-AWG]: '
    IFS= read -r display_name
    [ -n "$display_name" ] || display_name="OUM-AWG"
    provider_id="$(oum_provider_id awg)"
    oum_install_provider awg "$input" "$provider_id" "$display_name" awg
}

oum_import_awg_text() {
    oum_header
    oum_prepare_dirs
    oum_info "Вставьте AWG-конфиг целиком; после него введите одну точку: ."
    input="$OUM_TMP_DIR/awg.input"
    : > "$input"
    chmod 600 "$input"
    while IFS= read -r line; do
        [ "$line" = "." ] && break
        printf '%s\n' "$line" >> "$input"
    done
    [ -s "$input" ] || { oum_warn "Ничего не введено"; return; }
    printf 'Название ноды [OUM-AWG]: '
    IFS= read -r display_name
    [ -n "$display_name" ] || display_name="OUM-AWG"
    provider_id="$(oum_provider_id awg)"
    oum_install_provider awg "$input" "$provider_id" "$display_name" awg
}

oum_list_sources() {
    oum_header
    oum_info "Локальные OUM providers (содержимое и ключи скрыты):"
    found=0
    for provider in "$OPENCLASH_DIR"/proxy_provider/oum-*.yaml; do
        [ -f "$provider" ] || continue
        found=1
        printf ' • %s\n' "$(basename "$provider")"
    done
    [ "$found" -eq 1 ] || printf 'Пока нет источников.\n'
    printf '\nОтдельные Config Files:\n'
    found=0
    for config_file in "$OPENCLASH_DIR"/config/oum-*.yaml; do
        [ -f "$config_file" ] || continue
        found=1
        printf ' • %s\n' "$(basename "$config_file")"
    done
    [ "$found" -eq 1 ] || printf 'Пока нет отдельных конфигов.\n'
}

oum_sources_menu() {
    while true; do
        oum_header
        printf '%s\n' \
            "=== Подключения и ноды ===" \
            "1) Добавить подписку URL" \
            "2) Вставить VLESS/Hysteria2 ссылку" \
            "3) Вставить AWG-конфиг" \
            "4) Импортировать AWG из файла (расширенный вариант)" \
            "5) Показать источники и Config Files" \
            "" \
            "Enter — Назад"
        printf 'Выбор: '
        IFS= read -r choice
        case "$choice" in
            "") break ;;
            1) oum_import_subscription; oum_pause ;;
            2) oum_import_uri_text; oum_pause ;;
            3) oum_import_awg_text; oum_pause ;;
            4) oum_import_awg_file; oum_pause ;;
            5) oum_list_sources; oum_pause ;;
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
    printf '\nOUM providers:\n'
    for provider in "$OPENCLASH_DIR"/proxy_provider/oum-*.yaml; do
        [ -f "$provider" ] && printf ' • %s\n' "$(basename "$provider")"
    done
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
            "1) Настроить Wi-Fi" \
            "2) Добавить подключение или подписку" \
            "3) Проверить OpenClash" \
            "" \
            "Ключи вводятся только в момент добавления источника." \
            "Enter — Назад"
        printf 'Выбор: '
        IFS= read -r choice
        case "$choice" in
            "") break ;;
            1) oum_wifi_setup; oum_pause ;;
            2) oum_sources_menu ;;
            3) oum_validate_active_config; oum_pause ;;
            *) oum_err "Неверный выбор"; oum_pause ;;
        esac
    done
}

oum_routing_menu() {
    oum_header
    oum_info "Профиль массовой маршрутизации будет подключён следующим тестовым изменением."
    oum_info "Текущая версия отвечает только за безопасный импорт источников и нод."
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

oum_check_root
oum_prepare_dirs
oum_main_menu
