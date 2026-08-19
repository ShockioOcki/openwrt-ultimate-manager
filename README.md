# OpenWrt Ultimate Manager

OUM is an experimental OpenWrt setup and management project. The current test
architecture makes OpenClash/Mihomo the primary routing backend and keeps the
stable `oum.sh` unchanged until the new flow has been tested on a router.

## Test build

Build the single-file router script:

```sh
./tools/build.sh
```

The result is `dist/oum-test.sh`. Copy it to an OpenWrt router and run it as
`root`:

```sh
chmod 700 /root/oum-test.sh
/root/oum-test.sh
```

The test build currently supports:

- subscription import from base64 URI lists;
- direct VLESS Reality and Hysteria2 links;
- AmneziaWG v1/v2/v3 `.conf` import;
- AWG upload by path or direct terminal paste;
- deliberate omission of DNS supplied by an AWG profile;
- local Mihomo providers and the `OUM-SOURCES` proxy group;
- Mihomo validation, backup and automatic rollback;
- basic Wi-Fi SSID/password configuration;
- redacted diagnostics.

## Safety

Do not commit real subscription URLs, UUIDs, private keys or AWG profiles.
The files under `tests/fixtures/` contain synthetic data only. This is a test
build and should be exercised with disposable credentials before production.

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for the module map and roadmap.
