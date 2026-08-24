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
without rewriting the downloaded source profile. In PassWall mode the same
selectors preserve the imported shunt and manage only client addresses in its
`full_exception` and `full_redirection` rules, with a rollback-protected
PassWall restart. The expandable PassWall diagnostics report DNS interception,
the DNS worker and modes, IPv6 TProxy and both Geo datasets without exposing
proxy credentials.

The Settings page owns protected-source replacement as well as Smart/separate
Wi-Fi credentials and switching WAN between DHCP and PPPoE. Each network
change keeps a one-step local rollback. A model-bound, engine-tagged OUM backup
contains network, Wi-Fi, firewall, routing state and the current OpenClash,
PassWall or Podkop configuration; it is validated before a
restore and deliberately downloaded as an unencrypted secret-bearing file.
Maintenance actions can clear only the VPN layer or return to the FirstRun
wizard without changing the LAN address.

The VPN engine manager can replace OpenClash with PassWall or Podkop + Zapret,
or restore a previously used engine. It downloads and verifies the target package set and a
rollback set before changing packages, stores only the small secret-bearing
configuration archive locally, removes the old runtime only after rollback
assets are ready, and restores the previous engine automatically if installation
or readiness checks fail. PassWall 26.5.11-r1 packages are kept without
configuration or credentials in the private `openwrt-ultimate-manager-assets`
repository. Development routers use a checksum-verified local cache under
`/etc/oum/packages`; no GitHub token is stored on the router. The native
PassWall adapter accepts Subscription URLs and direct Reality/proxy links through
PassWall's own parser, keeps them in an isolated OUM group and rolls the full
UCI configuration back when parsing or startup fails. AWG remains an
independent tunnel configured with Podkop + Zapret rather than an Xray node.

Podkop can use either a dedicated WireGuard/AmneziaWG interface or a VLESS
Reality URL as its single outbound. Switching transport is transactional: the
new outbound must start and pass Podkop validation before the previous one is
released, and secrets are never returned by RPC. A complete AmneziaWG profile
can be imported directly in Settings. On the tested
OpenWrt 25.12.3 MT7622 target, OUM installs a pinned, SHA-256-verified AWG
runtime, preserves every v1/v2 obfuscation field, deliberately ignores profile
DNS, and creates an OUM-owned `oum_awg` interface transactionally. A failed
package check, handshake or Podkop startup restores the previous network and
Podkop configuration.
The routing catalog presents exactly two destinations for every service:
protected connection or direct. YouTube additionally offers two transactional
modes: direct with Zapret, or protected connection with Zapret disabled and its
runtime nftables rules removed. When direct mode is requested, OUM checks the
current DPI strategy, automatically tests the pinned catalog if necessary, and
restores the VPN mode if no direct strategy works. OUM never copies AWG tunnel
secrets into Podkop and does not enable `route_allowed_ips`.

The restricted Settings page keeps Podkop connection setup in one place: AWG
import and Zapret strategy management are shown under Protected connection only
while Podkop + Zapret is the active engine. OUM carries a checksum-pinned copy
of the 27 `Yv01`–`Yv27` YouTube strategies from StressOzz/Zapret-Manager commit
`189abafd50aed17f8c7414695d0d47d129a6b0dd`. The normal OUM workflow does not
execute the upstream manager. A dedicated adapter changes only the leading YouTube block of
`NFQWS_OPT`, preserves all remaining Zapret rules, tests candidates through the
direct WAN interface and restores the complete previous Zapret UCI file on any
failure. Automatic selection ranks successful candidates by availability and
aggregate connection time; at least three of four direct probes must pass.

The Podkop diagnostics page combines the installed Podkop project's own DNS,
sing-box, nftables and system checks with OUM's AWG handshake, FakeIP route and
Zapret/YouTube probes. Its optional QUIC compatibility switch blocks LAN-to-WAN
UDP ports 80 and 443 so clients fall back to TCP/TLS. It is off by default and
restores the exact previous firewall configuration if applying the rules fails.

Expert tools can optionally download the full Zapret Manager at the same pinned
revision and verify its SHA-256. It is available only as `oum-zapret-manager`
in an interactive root SSH session and creates a configuration backup before
execution. The restricted `admin` web account is never given a root terminal.

Subscriptions may be base64/plain URI lists or Clash YAML documents containing
an embedded `proxies` array. Provider YAML is loaded in safe mode before nodes
are filtered and embedded into the single OUM profile.

Development installation on a test router is handled by
`tools/install-luci-dev.sh`. The installer deliberately does not activate the
temporary `FirstRun` access point; run `/usr/libexec/oum-firstboot` separately
after taking a backup and confirming that changing Wi-Fi is safe.
For private PassWall development, stage the verified release APKs with
`tools/stage-engine-assets.sh` before testing engine replacement.
