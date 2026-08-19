#!/usr/bin/env ruby
require 'yaml'

# OpenWrt's compact Ruby package normally ships without uri/cgi/base64/json.
# Keep the converter self-contained and depend only on ruby-yaml (Psych).
ShareURI = Struct.new(:scheme, :user, :host, :port, :query, :fragment)

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

def convert_uri_list(input)
  nodes = []
  decode_uri_lines(File.read(input)).each_with_index do |line, index|
    uri = parse_share_uri(line)
    node = case uri.scheme
           when 'vless' then parse_vless(uri, index + 1)
           when 'hysteria2', 'hy2' then parse_hysteria2(uri, index + 1)
           else
             warn "WARNING: unsupported URI scheme #{uri.scheme.inspect}; node skipped"
             nil
           end
    nodes << node if node
  rescue ArgumentError => error
    warn "WARNING: malformed node #{index + 1} skipped: #{error.message}"
  end
  abort 'no supported nodes found' if nodes.empty?
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

def attach_provider(config, id, path)
  abort 'invalid provider id' unless id.match?(/\A[a-z0-9][a-z0-9_-]*\z/)
  config['proxy-providers'] = {} unless config['proxy-providers'].is_a?(Hash)
  config['proxy-providers'][id] = {
    'type' => 'file',
    'path' => path,
    'health-check' => {'enable' => true, 'url' => 'https://www.gstatic.com/generate_204', 'interval' => 600, 'lazy' => true}
  }
  source_group = ensure_group(config, 'OUM-SOURCES')
  source_group['type'] = 'select'
  append_unique(source_group, 'use', id)
  proxy_group = ensure_group(config, 'PROXY')
  append_unique(proxy_group, 'proxies', 'OUM-SOURCES')
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
when 'attach'
  input, output, id, path = ARGV
  abort 'usage: attach CONFIG OUTPUT ID PATH' unless input && output && id && path
  write_yaml(attach_provider(load_yaml(input), id, path), output)
else
  abort 'modes: awg, uris, attach'
end
