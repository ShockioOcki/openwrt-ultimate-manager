# Security policy

Do not open an issue or commit a file containing a subscription URL, UUID,
private key, pre-shared key, Reality public-key pairing, router backup, or an
exported AWG/WireGuard profile.

Use synthetic fixtures when reporting importer bugs. If a real credential was
used for a test, revoke it after the test even when the local file was deleted.

OUM-generated providers contain credentials and must retain mode `0600`.
Diagnostic output must identify a provider by its generated ID and must never
print the provider body or source URL.

The LuCI `admin` account is intentionally separate from root and is limited to
the `luci-app-oum` rpcd ACL. Do not grant it generic `file.exec`, wildcard ubus
or direct write access to system UCI configurations. `admin/admin` and the
`FirstRun/admin123` wireless network are temporary bootstrap credentials only;
the first-run wizard must replace the panel password and the wireless network.

LuCI VPN input is written only to `/tmp/oum-vpn-job/input` with mode `0600`.
The background importer must remove this file on every exit path. Status files
may contain a phase and a user-facing error code but never a URL, URI, private
key or configuration body.

Mihomo node operations are restricted to the active OUM group. The dashboard
API secret must not be returned to the browser or passed in process arguments;
the local helper reads it from UCI, writes a mode-0600 curl configuration and
removes that configuration on exit.
