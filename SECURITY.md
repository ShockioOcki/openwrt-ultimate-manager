# Security policy

Do not open an issue or commit a file containing a subscription URL, UUID,
private key, pre-shared key, Reality public-key pairing, router backup, or an
exported AWG/WireGuard profile.

Use synthetic fixtures when reporting importer bugs. If a real credential was
used for a test, revoke it after the test even when the local file was deleted.

OUM-generated providers contain credentials and must retain mode `0600`.
Diagnostic output must identify a provider by its generated ID and must never
print the provider body or source URL.
