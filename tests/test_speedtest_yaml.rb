#!/usr/bin/env ruby

require 'yaml'

root = File.expand_path('..', __dir__)
updater = File.join(root, 'luci-app-oum/root/usr/libexec/oum-speedtest-yaml.rb')
directory = "/tmp/oum-speedtest-yaml-#{Process.pid}"
Dir.mkdir(directory)

begin
  profile = File.join(directory, 'profile.yaml')
  ordinary = [ 'DOMAIN-SUFFIX,example.com,DIRECT', 'MATCH,PROXY' ]
  File.write(profile, YAML.dump({
    'proxy-groups' => [{ 'name' => 'PROXY', 'type' => 'select', 'proxies' => ['DIRECT'] }],
    'rules' => ['DOMAIN,speed.cloudflare.com,PROXY', *ordinary]
  }))

  abort 'DIRECT update failed' unless system('ruby', updater, profile, 'DIRECT')
  rules = YAML.load_file(profile).fetch('rules')
  abort 'DIRECT rule is not first' unless rules.first == 'DOMAIN,speed.cloudflare.com,DIRECT'
  abort 'duplicate speed rule' unless rules.grep(/speed\.cloudflare\.com/).length == 1
  abort 'ordinary rules changed' unless rules.drop(1) == ordinary

  abort 'PROXY update failed' unless system('ruby', updater, profile, 'PROXY')
  rules = YAML.load_file(profile).fetch('rules')
  abort 'PROXY rule is not first' unless rules.first == 'DOMAIN,speed.cloudflare.com,PROXY'
  abort 'ordinary rules changed after replacement' unless rules.drop(1) == ordinary
ensure
  Dir.glob(File.join(directory, '*')).each { |path| File.delete(path) }
  Dir.rmdir(directory)
end

puts 'speed-test YAML tests: OK'
