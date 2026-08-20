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
- single-dot (`.`) terminator for pasted AWG and URI input;
- deliberate omission of DNS supplied by an AWG profile;
- local Mihomo providers without an external conversion service;
- separate `SUBSCRIPTION`, `AMNEZIA`, and `REALITY` source groups;
- optional standalone Config Files selectable from the OpenClash dashboard;
- local filtering of service/LTE/mobile/auto subscription entries;
- Mihomo validation, backup and automatic rollback;
- basic Wi-Fi SSID/password configuration;
- redacted diagnostics.

## Safety

Do not commit real subscription URLs, UUIDs, private keys or AWG profiles.
The files under `tests/fixtures/` contain synthetic data only. This is a test
build and should be exercised with disposable credentials before production.

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for the module map and roadmap.
See [docs/TROUBLESHOOTING.md](docs/TROUBLESHOOTING.md) for OpenClash/Mihomo log notes.

## LuCI first-run prototype

The `luci-app-oum/` directory contains the first installable prototype of the
simplified OUM interface for OpenWrt 25.12. It provides a restricted `admin`
login and a four-step first-run wizard for WAN, Wi-Fi, VPN mode selection and
replacement of the temporary panel password.

Development installation on a test router is handled by
`tools/install-luci-dev.sh`. The installer deliberately does not activate the
temporary `FirstRun` access point; run `/usr/libexec/oum-firstboot` separately
after taking a backup and confirming that changing Wi-Fi is safe.
