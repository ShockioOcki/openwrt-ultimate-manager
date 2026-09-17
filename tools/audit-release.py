#!/usr/bin/env python3
"""Fail a release on literal credentials or non-runtime configuration. Never print secrets."""
from pathlib import Path
import re
import sys

RULES = {
    'private key': re.compile(rb'-----BEGIN (?:OPENSSH |RSA |EC |DSA |ENCRYPTED )?PRIVATE KEY-----'),
    'WireGuard/AWG secret': re.compile(rb'(?im)^\s*(?:PrivateKey|PresharedKey)\s*=\s*[A-Za-z0-9+/]{42,}=?'),
    'UCI literal credential': re.compile(rb'''(?im)^\s*option\s+(?:private_key|preshared_key|password|passwd|token|subscription_url|proxy_string)\s+['"][^'"\r\n]+['"]'''),
    'literal proxy credential': re.compile(rb'(?:vless|trojan|ss)://[A-Za-z0-9+/=_-]{16,}@|vmess://[A-Za-z0-9+/=_-]{40,}'),
    'subscription URL': re.compile(rb'https?://(?:sub\.[A-Za-z0-9.-]+/|[A-Za-z0-9.-]+/sub/)[A-Za-z0-9_-]{8,}'),
}
PUBLIC_KEY = 'luci-app-oum/root/etc/oum/support/support_key.pub'
CONFIGS = {'luci-app-oum/root/etc/config/oum'}


def audit(root):
    problems = []
    public_keys = []
    for file in sorted(root.rglob('*')):
        if not file.is_file():
            continue
        name = file.relative_to(root).as_posix()
        if file.is_symlink():
            problems.append((name, 'symlink not allowed in release'))
            continue
        if '/root/etc/config/' in name and name not in CONFIGS:
            problems.append((name, 'unexpected device configuration'))
        if re.search(r'(?i)(?:^|/)(?:id_rsa|id_ed25519|authorized_keys|shadow|\.env)(?:$|\.)|\.(?:conf|bak|old|orig|pem|key)$', name):
            problems.append((name, 'unexpected credential/backup file'))
        data = file.read_bytes()
        for label, pattern in RULES.items():
            if pattern.search(data):
                problems.append((name, label))
        if re.search(rb'(?m)^(?:ssh-(?:ed25519|rsa)|ecdsa-sha2-\S+) [A-Za-z0-9+/=]{30,}', data):
            public_keys.append(name)
            if name != PUBLIC_KEY:
                problems.append((name, 'unexpected public SSH key'))
    if problems:
        for name, label in problems:
            print(f'Release audit FAILED: {name}: {label}', file=sys.stderr)
        raise SystemExit(1)
    print('Release credential scan: OK; approved support public key files: ' + str(len(public_keys)))


if __name__ == '__main__':
    audit(Path(sys.argv[1]).resolve())
