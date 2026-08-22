# Troubleshooting

## `Load GeoSite rule: cn`

Mihomo may print `Load GeoSite rule: cn` during its internal geodata and DNS
matcher initialization when `geodata-mode` is enabled. This log entry does not
mean that OUM maps Russian traffic to China or adds a `GEOSITE,CN` routing rule.

Check the active OUM YAML before changing routing. OUM does not generate a
`GEOSITE,CN` or `GEOIP,CN` routing rule. Its Russian routing profile uses named
rule providers and never reuses the `cn` category as a substitute for `ru`.

## Active OUM profile

OUM keeps only one managed Config File:

- `/etc/openclash/config/Subscription.yaml`
- `/etc/openclash/config/AWG_Tunnel.yaml`
- `/etc/openclash/config/Proxy.yaml`

Adding another source atomically replaces the previous OUM profile. The script
sets `openclash.config.config_path`, restarts OpenClash, and verifies that the
running core loaded the same filename. Use **Show active source** instead of
switching files manually in LuCI.
