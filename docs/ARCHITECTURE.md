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
└── build.sh
dist/
└── oum-test.sh
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
3. Add `luci-app-oum` with restricted rpcd ACL permissions.
4. Promote the test build to the stable `oum.sh` only after router testing.
