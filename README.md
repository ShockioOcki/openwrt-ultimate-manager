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
The OUM login form pre-fills `admin`, while full LuCI and SSH continue to use
the normal `root` default.

After the network reconnect, the Settings page can import Subscription URLs,
AmneziaWG configurations and VLESS/Hysteria2 links through a background job.
It reuses the terminal build's validated single-profile pipeline and reports
progress without retaining submitted credentials in LuCI.

The first dashboard widgets show live WAN addressing, enabled SSIDs, named
DHCP clients with Wi-Fi/Ethernet classification, router temperature and the
active OUM VPN source. They refresh without running external connectivity or
speed tests.

The VPN widget reads the active Mihomo group, shows the current node, measures
group latency and switches nodes without rewriting YAML or restarting
OpenClash. It presents six quick alternatives in a three-column desktop grid,
preferring different country flags when the provider includes them in names.
When PassWall is installed, the same widget reads the active shunt, filters
service/mobile entries, measures node endpoints in parallel and switches the
shunt default node through a rollback-protected background job. Finland and
the Netherlands are retained in the quick list when available; the complete
filtered list remains expandable.

For Subscription profiles, the dashboard also displays provider traffic and
expiry metadata from `Subscription-Userinfo`. The URL remains on the router;
the browser receives only numeric counters from a private 30-minute cache.
Per-device selectors can keep a DHCP client on the normal rule set, force it
through the VPN or bypass the VPN. Runtime rules are hot-reloaded into Mihomo
without rewriting the downloaded source profile.

The speed widget runs explicit, user-started DIRECT and VPN measurements
against the same Cloudflare edge. Each test uses about 35 MB, validates that
the two egress paths differ, and restores the byte-identical Mihomo runtime
profile without restarting OpenClash.

The Settings page owns protected-source replacement as well as Smart/separate
Wi-Fi credentials and switching WAN between DHCP and PPPoE. Each network
change keeps a one-step local rollback. A model-bound OUM backup contains
network, Wi-Fi, firewall,
OpenClash, routing state and the active OUM profile; it is validated before a
restore and deliberately downloaded as an unencrypted secret-bearing file.
Maintenance actions can clear only the VPN layer or return to the FirstRun
wizard without changing the LAN address.

Development installation on a test router is handled by
`tools/install-luci-dev.sh`. The installer deliberately does not activate the
temporary `FirstRun` access point; run `/usr/libexec/oum-firstboot` separately
after taking a backup and confirming that changing Wi-Fi is safe.
