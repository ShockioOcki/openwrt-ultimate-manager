# Troubleshooting

## `Load GeoSite rule: cn`

Mihomo may print `Load GeoSite rule: cn` during its internal geodata and DNS
matcher initialization when `geodata-mode` is enabled. This log entry does not
mean that OUM maps Russian traffic to China or adds a `GEOSITE,CN` routing rule.

Check the actual source YAML before changing routing. In the tested
`routing.yaml`, no `geosite:cn`, `GEOIP,CN`, or China routing rule was present;
the explicit fake-IP exception was `geosite:private`. OUM's Russian routing
profile must use named rule providers and never reuse the `cn` category as a
substitute for `ru`.

## Config File selection

OUM test builds can create these standalone files without switching the active
configuration automatically:

- `/etc/openclash/config/oum-subscription.yaml`
- `/etc/openclash/config/oum-amnezia.yaml`
- `/etc/openclash/config/oum-reality.yaml`

Select the desired file in OpenClash's **Config File** dropdown. Each file is
validated by Mihomo before it is saved.
