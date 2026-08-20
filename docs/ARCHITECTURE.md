# OUM test architecture

The stable `oum.sh` on `main` is intentionally left untouched while the new
OpenClash-first architecture is tested.

## Source tree

```text
src/
├── header.sh
├── core/
│   ├── common.sh
│   └── platform.sh
├── modules/
│   ├── install.sh
│   ├── sources.sh
│   ├── network.sh
│   └── diagnostics.sh
└── ui/
    └── main.sh
helpers/
└── source_converter.rb
tools/
├── build.sh
└── install-luci-dev.sh
dist/
└── oum-test.sh
luci-app-oum/
├── htdocs/luci-static/resources/view/oum/
└── root/
    ├── etc/config/oum
    ├── usr/libexec/oum-firstboot
    ├── usr/libexec/oum-reset-first-run
    └── usr/share/{luci,rpcd}/
```

`tools/build.sh` concatenates the shell modules and embeds the Ruby source
converter into a single router-ready script. Edit files under `src/` and
`helpers/`; never edit `dist/oum-test.sh` by hand.

On a clean OpenWrt installation, OUM installs pinned OpenClash and Mihomo
builds after verifying their SHA-256 hashes. OpenClash remains stopped until
the first profile passes validation.

## Source pipeline

```text
subscription URL ─┐
VLESS/Hysteria URI ┼─> source_converter.rb ─> validated candidate profile
AWG .conf ─────────┘                              │
                                                  v
                             one active OpenClash Config File
```

The AWG converter deliberately ignores the `DNS` field. Router and OpenClash
DNS policy remains independent from tunnel credentials.

Subscription node names containing `⬇`, `LTE`, `🇪🇺`, `Мобильный`, the
standalone token `SS`, or `Авто` are filtered locally. Directly pasted links
are not filtered.

OUM manages exactly one active source and one Config File:

- `Subscription.yaml` for a URL subscription;
- `AWG_Tunnel.yaml` for an AmneziaWG tunnel;
- `Proxy.yaml` for directly pasted VLESS/Hysteria2/Reality links.

Only one of these files may exist at a time. A replacement is generated in a
temporary location, validated by Mihomo, activated, and checked against the
running core command line before the previous OUM profile is removed. Failure
restores the previous YAML and OpenClash UCI state.

The subscription URL is registered as OpenClash `subscribe_info` metadata so
the Config File page can display traffic use and expiry without letting
OpenClash overwrite OUM's routing policy.

## Secret handling

- Real credentials and subscription URLs must never be committed.
- Test fixtures use documentation-only IP ranges and synthetic keys.
- Temporary inputs and generated providers use mode `0600`.
- OUM logs source identifiers and types, never source contents.
- The OpenClash configuration is validated before it replaces the active YAML.

## Roadmap

1. Complete repeated clean-router first-run and source replacement tests.
2. Connect the optional USB/NAS flow and existing service modules.
3. Package the runtime assets and promote the test build only after router testing.

## LuCI first-run architecture

The first prototype uses a top-level `/cgi-bin/luci/oum` tree, separate from
the full root administration tree. The temporary `admin` account receives
only the `luci-app-oum` rpcd access group. That group can read OUM status and
invoke the narrowly scoped setup transaction; it cannot call the generic file
executor or edit `network`, `wireless`, `rpcd`, or OpenClash UCI directly.

The `oum` ucode rpcd object validates the complete request before writing,
backs up all affected UCI files, applies WAN and Wi-Fi changes, updates the
restricted login hash and commits the transaction. A runtime failure restores
the backup. Network, Wi-Fi and rpcd reload only after all commits succeed.

Until setup is complete, `oum-firstboot` provides the temporary dual-band
`FirstRun` network with WPA2/WPA3 mixed encryption, password `admin123` and
country code `US`. The temporary panel login is `admin/admin`; the wizard
requires replacing it with an eight-character-or-longer password before it can
finish. The final Wi-Fi password is also at least eight characters because
shorter keys are invalid for WPA2/WPA3 Personal.

An empty OpenWrt root password is locked during bootstrap so it cannot bypass
the restricted OUM account through LuCI or SSH. Completing the wizard sets the
same user-selected management password for both the restricted `admin` login
and the emergency `root` account. SSH public-key authentication remains usable
while the password is locked.

The wizard records the selected VPN source and applies WAN and Wi-Fi first.
After the network reload and login, the dashboard displays the matching input
form. `startVpnImport` writes the secret to a mode-0600 temporary file and
starts `oum-source-job`; the job sources the same generated OUM runtime used by
the terminal interface and calls the existing atomic single-profile pipeline.
LuCI polls a small status file and never receives the submitted secret again.
The input file is removed on success, validation failure, download failure or
termination. A new Subscription, AWG Tunnel or Proxy still replaces the old
OUM profile only after Mihomo validation and successful OpenClash startup.

`dashboardStatus` is a read-only rpcd method. It combines netifd WAN state,
enabled wireless SSIDs, DHCP leases, current wireless associations and thermal
zone readings. The browser refreshes these values every ten seconds. Client
names come from DHCP leases; unknown names are displayed explicitly rather
than guessed from MAC vendors.

`oum-reset-first-run` is a test and recovery helper. It removes only
OUM-managed OpenClash profiles and state, disables OpenClash, locks root
password authentication and restores the temporary FirstRun network and
restricted admin login. It does not factory-reset OpenWrt or change the LAN
address.

Node selection uses Mihomo's loopback-only external-controller API. The
read-only RPC exposes node names, types, current selection and delay history;
it never returns proxy credentials. Delay measurements use the active OUM
group, and switching validates the requested name against that group's own
node list before issuing the API request. The OpenClash dashboard secret is
kept in a mode-0600 curl config and removed after every request.

Subscription traffic and expiry are fetched on the router from the provider's
`Subscription-Userinfo` response header. OUM stores only the parsed numeric
values in `/tmp` for 30 minutes; the restricted browser session never receives
the subscription URL. Manual refresh uses the same lock-protected helper.

Device routing policies are stored in anonymous `oum` UCI sections and paired
with stable DHCP reservations. OUM maintains a marked block in OpenClash's
custom rules for persistence, while a validated runtime copy is hot-reloaded
through Mihomo so policy changes do not require a full OpenClash restart.

Speed tests are manual background jobs. OUM inserts a temporary top-priority
rule for `speed.cloudflare.com`, validates and hot-reloads the runtime profile,
measures latency plus fixed-size download/upload transfers, then restores the
exact backup. DIRECT and VPN result files contain only rates, latency, time and
a one-way hash used to confirm that the egress paths differ; the public IP is
never returned to LuCI or written to disk.

## Settings and recovery

The restricted `/oum/settings` page uses dedicated RPC methods rather than
generic UCI access. Wi-Fi, WAN, restore and reset requests share one atomic
system-job lock and are mutually exclusive with VPN import, device-policy
updates and speed tests. Password fields are write-only: status responses show
only whether a secret exists, and an empty field preserves the current value.

Wi-Fi and WAN changes save the immediately preceding UCI file under
`/etc/oum/rollback/` before committing and reloading the service. The user can
restore that one-step snapshot from the same page. Wi-Fi is always normalized
to country `US`, WPA2/WPA3 mixed mode and enabled AP interfaces.

OUM backups use an allowlisted archive containing the required UCI configs,
the one active OUM profile, custom routing rules and non-secret state markers.
Restore rejects a different board, links, unexpected paths, oversized expanded
content, invalid UCI and malformed YAML before writing `/etc`. Apply failures
restore a private runtime snapshot. The downloaded `.oum` file is base64
transport around a gzip archive, not encryption, so the UI warns that it must
be stored as a credential-bearing file.

`resetVpn` removes only OUM-managed profiles, subscription metadata and device
policies. `resetFirstRun` delegates to the existing recovery helper, which also
locks password login and brings back the temporary FirstRun access point while
leaving the LAN address untouched.
