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

## Source pipeline

```text
subscription URL ─┐
VLESS/Hysteria URI ┼─> source_converter.rb ─> local Mihomo provider
AWG .conf ─────────┘                              │
                                                  v
                   OpenClash source groups or standalone Config Files
```

The AWG converter deliberately ignores the `DNS` field. Router and OpenClash
DNS policy remains independent from tunnel credentials.

Subscription node names containing `⬇`, `LTE`, `🇪🇺`, `Мобильный`, the
standalone token `SS`, or `Авто` are filtered locally. Directly pasted links
are not filtered.

Each imported source can either be attached to the active combined config or
written as a standalone OpenClash Config File:

- `oum-subscription.yaml` with group `SUBSCRIPTION`;
- `oum-amnezia.yaml` with group `AMNEZIA`;
- `oum-reality.yaml` with group `REALITY`.

Standalone files appear in OpenClash's Config File selector and do not switch
the active configuration automatically.

## Secret handling

- Real credentials and subscription URLs must never be committed.
- Test fixtures use documentation-only IP ranges and synthetic keys.
- Temporary inputs and generated providers use mode `0600`.
- OUM logs source identifiers and types, never source contents.
- The OpenClash configuration is validated before it replaces the active YAML.

## Roadmap

1. Stabilize AWG, VLESS Reality and subscription import.
2. Add the mass-routing profile as data rather than embedded Ruby code.
3. Connect existing NAS/SQM/GearUP modules to the new menu.
4. Add `luci-app-oum` with restricted rpcd ACL permissions.
5. Promote the test build to the stable `oum.sh` only after router testing.
