#!/usr/bin/env ruby

require 'yaml'

profile, old_ips_path, new_rules_path = ARGV
abort 'usage: oum-policy-yaml.rb PROFILE OLD_IPS NEW_RULES' unless new_rules_path
abort 'profile not found' unless File.file?(profile)

old_ips = File.readlines(old_ips_path, chomp: true).grep(/\A(?:\d{1,3}\.){3}\d{1,3}\z/)
new_rules = File.readlines(new_rules_path, chomp: true).grep(/\ASRC-IP-CIDR,(?:\d{1,3}\.){3}\d{1,3}\/32,(?:DIRECT|PROXY)\z/)
managed_ips = (old_ips + new_rules.filter_map { |rule| rule.split(',')[1]&.delete_suffix('/32') }).uniq

config = YAML.load_file(profile)
abort 'invalid profile' unless config.is_a?(Hash) && config['rules'].is_a?(Array)

managed = /\ASRC-IP-CIDR,(#{managed_ips.map { |ip| Regexp.escape(ip) }.join('|')})\/32,(?:DIRECT|PROXY)\z/
config['rules'].reject! { |rule| !managed_ips.empty? && rule.to_s.match?(managed) }
config['rules'].unshift(*new_rules)

temporary = "#{profile}.oum.tmp"
File.open(temporary, 'w', 0o600) { |file| file.write(YAML.dump(config)) }
File.rename(temporary, profile)
