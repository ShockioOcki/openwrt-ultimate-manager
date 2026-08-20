#!/usr/bin/env ruby

require 'yaml'

profile, target = ARGV
abort 'usage: oum-speedtest-yaml.rb PROFILE DIRECT|PROXY' unless profile && %w[DIRECT PROXY].include?(target)
abort 'profile not found' unless File.file?(profile)

config = YAML.load_file(profile)
abort 'invalid profile' unless config.is_a?(Hash) && config['rules'].is_a?(Array)

config['rules'].reject! { |rule| rule.to_s.match?(/\ADOMAIN,speed\.cloudflare\.com,(?:DIRECT|PROXY)\z/) }
config['rules'].unshift("DOMAIN,speed.cloudflare.com,#{target}")

temporary = "#{profile}.oum-speed.tmp"
File.open(temporary, 'w', 0o600) { |file| file.write(YAML.dump(config)) }
File.rename(temporary, profile)
