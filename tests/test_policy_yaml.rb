#!/usr/bin/env ruby

require 'yaml'

root = File.expand_path('..', __dir__)
updater = File.join(root, 'luci-app-oum/root/usr/libexec/oum-policy-yaml.rb')

directory = "/tmp/oum-policy-test-#{Process.pid}"
Dir.mkdir(directory)

begin
  profile = File.join(directory, 'profile.yaml')
  old_ips = File.join(directory, 'old.ips')
  new_rules = File.join(directory, 'new.rules')
  original_rules = [
    'SRC-IP-CIDR,192.168.1.2/32,PROXY',
    'DOMAIN-SUFFIX,example.com,DIRECT',
    'MATCH,DIRECT'
  ]
  File.write(profile, YAML.dump({ 'proxy-groups' => [], 'rules' => original_rules }))
  File.write(old_ips, "192.168.1.2\n")
  File.write(new_rules, "SRC-IP-CIDR,192.168.1.225/32,DIRECT\n")

  abort 'policy updater failed' unless system('ruby', updater, profile, old_ips, new_rules)
  rules = YAML.load_file(profile).fetch('rules')
  abort 'new policy is not first' unless rules.first == 'SRC-IP-CIDR,192.168.1.225/32,DIRECT'
  abort 'old policy survived' if rules.include?('SRC-IP-CIDR,192.168.1.2/32,PROXY')
  abort 'ordinary rules changed' unless rules.drop(1) == original_rules.drop(1)

  File.write(old_ips, "192.168.1.225\n")
  File.write(new_rules, '')
  abort 'policy cleanup failed' unless system('ruby', updater, profile, old_ips, new_rules)
  abort 'policy cleanup left a rule' unless YAML.load_file(profile).fetch('rules') == original_rules.drop(1)
ensure
  Dir.glob(File.join(directory, '*')).each { |path| File.delete(path) }
  Dir.rmdir(directory)
end

puts 'device policy YAML tests: OK'
