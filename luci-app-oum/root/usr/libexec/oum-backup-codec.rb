#!/usr/bin/env ruby

mode, source, destination = ARGV
abort 'usage: oum-backup-codec.rb encode|decode SOURCE DESTINATION' unless destination

case mode
when 'encode'
  data = [File.binread(source)].pack('m0')
  File.open(destination, 'w', 0o600) { |file| file.write(data) }
when 'decode'
  data = File.read(source).unpack1('m0')
  abort 'invalid base64 backup' unless data
  File.open(destination, 'wb', 0o600) { |file| file.write(data) }
else
  abort 'unknown codec mode'
end
