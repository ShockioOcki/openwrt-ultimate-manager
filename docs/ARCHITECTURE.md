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

1. Complete clean-router installation and source replacement tests.
2. Connect existing NAS/SQM/GearUP modules to the new menu.
3. Connect the wizard's VPN step to the existing single-profile source pipeline.
4. Add dashboard widgets and the optional USB/NAS flow.
5. Promote the test build to the stable `oum.sh` only after router testing.

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

The current prototype records the selected VPN source type but deliberately
does not yet accept or persist credentials. Import will be connected to the
existing atomic single-profile pipeline rather than implemented a second time
inside LuCI.
