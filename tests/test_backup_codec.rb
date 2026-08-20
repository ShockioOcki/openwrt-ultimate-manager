#!/usr/bin/env ruby

root = File.expand_path('..', __dir__)
codec = ENV.fetch('OUM_BACKUP_CODEC', File.join(root, 'luci-app-oum/root/usr/libexec/oum-backup-codec.rb'))
directory = "/tmp/oum-backup-codec-#{Process.pid}"
Dir.mkdir(directory)

begin
  source = File.join(directory, 'source.bin')
  encoded = File.join(directory, 'encoded.txt')
  decoded = File.join(directory, 'decoded.bin')
  payload = "OUM\x00backup\n\xFF".b
  File.binwrite(source, payload)
  abort 'backup encoding failed' unless system('ruby', codec, 'encode', source, encoded)
  abort 'encoded backup contains invalid characters' unless File.read(encoded).match?(/\A[A-Za-z0-9+\/=]+\z/)
  abort 'backup decoding failed' unless system('ruby', codec, 'decode', encoded, decoded)
  abort 'backup round trip changed bytes' unless File.binread(decoded) == payload
ensure
  Dir.glob(File.join(directory, '*')).each { |path| File.delete(path) }
  Dir.rmdir(directory)
end

puts 'backup codec tests: OK'
