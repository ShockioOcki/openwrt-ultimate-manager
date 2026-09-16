require 'yaml'
require 'tmpdir'
require 'open3'
root = File.expand_path('..', __dir__)
Dir.mktmpdir do |tmp|
  converter = File.join(root, 'helpers/source_converter.rb')
  abort unless system('ruby', converter, 'uris', File.join(root,'tests/fixtures/nodes.txt'), "#{tmp}/nodes.yaml")
  abort unless system('ruby', converter, 'standalone', "#{tmp}/profile.yaml", "#{tmp}/nodes.yaml", 'subscription')
  config = YAML.load_file("#{tmp}/profile.yaml")
  rules = config.fetch('rules')
  game_index = rules.index('RULE-SET,category-games-not-cn,DIRECT')
  abort 'missing game direct rule' unless game_index
  %w[openai.com claude.ai youtube.com gemini.google.com gemini.gstatic.com alkalicore-pa.clients6.google.com].each do |domain|
    index = rules.index("DOMAIN-SUFFIX,#{domain},PROXY")
    abort "missing/unsafe restricted rule #{domain}" unless index && index > game_index
  end
  %w[battle.net epicgames.com xbox.com supercell.com].each do |domain|
    abort "gaming routed through bulk VPN: #{domain}" if rules.include?("DOMAIN-SUFFIX,#{domain},PROXY")
  end
  abort 'unknown IP not direct' unless rules.last == 'MATCH,DIRECT'
  abort 'broad blocked IP rules' if rules.any? { |r| r.match?(/ru-blocked-ips|rknasn|meta-ips/) }
  abort 'ads silently blocked' if rules.any? { |r| r.end_with?(',REJECT') }
  abort 'Telegram domains missing' unless rules.include?('RULE-SET,telegram,PROXY')
  abort 'Telegram IPs missing' unless rules.include?('RULE-SET,telegram-ips,PROXY,no-resolve')
  dns = config.fetch('dns')
  abort 'Telegram DNS not tunneled' unless dns['nameserver-policy']['rule-set:telegram'].all? { |r| r.end_with?('#PROXY') }
  abort 'proxy DNS bootstrap loop' unless dns['proxy-server-nameserver'] == dns['default-nameserver']
  abort 'restricted DNS not tunneled' unless dns['nameserver-policy']['+.openai.com'].all? { |r| r.end_with?('#PROXY') }
end
helper = File.read(File.join(root,'luci-app-oum/root/usr/libexec/oum-passwall-bypass-russia'))
abort 'games after blocked list' unless helper.index('passwall.oum_games=shunt_rules') < helper.index('for section in regional restricted')
abort 'unknown traffic intercepted' unless %w[tcp udp].all? { |p| helper.include?("#{p}_proxy_mode='disable'") }
abort 'UDP/443 block remains' unless helper.include?("udp_proxy_drop_ports='disable'")
abort 'PassWall Telegram IP routing missing' unless helper.include?('passwall.oum_telegram.ip_list=geoip:telegram') && helper.include?('passwall.$shunt.oum_telegram=_default')
puts 'Russia/game routing regressions: OK'
