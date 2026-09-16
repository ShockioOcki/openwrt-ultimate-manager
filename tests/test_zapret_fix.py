"""Exercise the real manager FIX with isolated firewall and UCI commands."""
import os
from pathlib import Path
import subprocess
import tempfile

source = Path(__file__).resolve().parents[1] / 'luci-app-oum/root/usr/libexec/oum-zapret-manager'
old = 'meta l4proto { tcp, udp } flow offload @ft;'
new = 'meta l4proto { tcp, udp } ct original packets ge 30 flow offload @ft;'
with tempfile.TemporaryDirectory() as d:
    root = Path(d)
    template = root / 'ruleset.uc'
    backup = root / 'backup'
    script = root / 'manager'
    script.write_text(source.read_text().replace('/usr/share/firewall4/templates/ruleset.uc', str(template)).replace('/etc/oum/rollback/zapret-flow-offloading', str(backup)))
    for name, body in {
        'uci': 'echo "${TEST_OFFLOAD:-1}"',
        'fw4': 'echo "$1" >> "$TEST_CALLS"; [ "$1" != check ] || [ "${TEST_FAIL:-0}" = 0 ]',
    }.items():
        f = root / name
        f.write_text('#!/bin/sh\n' + body + '\n')
        f.chmod(0o755)
    env = dict(os.environ, PATH=d + ':' + os.environ['PATH'], TEST_CALLS=str(root / 'calls'))
    def run(**extra):
        return subprocess.run(['sh', str(script), 'fix'], env=dict(env, **extra), capture_output=True).returncode
    template.write_text(old + '\n')
    assert run() == 0 and template.read_text() == new + '\n'
    assert (backup / 'ruleset.before.uc').read_text() == old + '\n'
    calls = (root / 'calls').read_text()
    assert run() == 0 and (root / 'calls').read_text() == calls
    template.write_text(old + '\n')
    assert run(TEST_FAIL='1') != 0 and template.read_text() == old + '\n'
    template.write_text('unsupported\n')
    assert run() != 0 and template.read_text() == 'unsupported\n'
    assert run(TEST_OFFLOAD='0') == 0 and template.read_text() == 'unsupported\n'
print('Zapret FIX: apply, idempotency, rollback, unknown template, offloading disabled: OK')
