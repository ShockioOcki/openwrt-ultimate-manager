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
  write_yaml(convert_uri_list(input, filter_subscription: true), output)
when 'standalone'
  output, provider_file, kind = ARGV
  abort 'usage: standalone OUTPUT PROVIDER_FILE KIND' unless output && provider_file && kind
  write_yaml(single_profile(provider_file, kind), output)
else
  abort 'modes: awg, uris, subscription, standalone'
end
