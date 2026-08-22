#!/bin/sh

set -eu

SOURCE_DIR="${1:-}"
ROUTER="${2:-root@192.168.1.1}"
KEY="${3:-}"

[ -d "$SOURCE_DIR" ] || {
	echo "Usage: $0 PASSWALL_APK_DIR [root@router] [ssh_private_key]" >&2
	exit 2
}
case "$ROUTER" in *[!A-Za-z0-9_.@:-]*) echo 'Unsafe router address' >&2; exit 2 ;; esac
[ -z "$KEY" ] || [ -f "$KEY" ] || { echo "SSH key not found: $KEY" >&2; exit 2; }

ASSETS='chinadns-ng-2025.08.09-r1.apk|2ce83854e76692456a520be41d5fed017aa6a6294f9479f799592f2fb83c3f19
dns2socks-2.1-r2.apk|49714c6ad39f0b0be862e460620ad33652e835dcf99e0de2e26e415fbf898b6b
geoview-0.2.6-r1.apk|6beac4ccdcac40cfc377bdc564f0d74be338a63afb4273d522a16f4b1534b60d
haproxy-3.2.15-r1.apk|7dbb2d40385d597e76c1857dca7941cb270e9a865827cb1e3e34a141f7563fff
ipt2socks-1.1.4-r3.apk|c18b1b20c6803eb405684fe0c2310f27478e3272dec45ef106a8ab9b1cd53a54
luci-app-passwall-26.5.11-r1.apk|9b2c7808b4709a0bcdf945537a2c347ff0b04cc83f54047e3b709e3483a7b18f
microsocks-1.0.5-r2.apk|e1681f48ab5a5cafdf942a35d2b1f5cfaa95c7b5dbf65cec27ab5ab46001149f
tcping-0.3-r1.apk|04429d4e95e7f64805fe087ead5ca1240516a5cc8ebd99203f274d0bda9e7779
xray-core-26.5.9-r1.apk|db938702aeb73468853f0517fa63b8a67a2b88e9ba2aa7322f1cc1e936a1570c'

SSH_ARGS='-o BatchMode=yes -o StrictHostKeyChecking=accept-new'
if [ -n "$KEY" ]; then
	SSH_ARGS="$SSH_ARGS -i $KEY"
fi

old_ifs="$IFS"
IFS='
'
for entry in $ASSETS; do
	file="${entry%%|*}"
	expected="${entry#*|}"
	path="$SOURCE_DIR/$file"
	[ -s "$path" ] || { echo "Missing asset: $path" >&2; exit 1; }
	actual="$(sha256sum "$path" | awk '{print $1}')"
	[ "$actual" = "$expected" ] || { echo "Checksum mismatch: $file" >&2; exit 1; }
done
IFS="$old_ifs"

# shellcheck disable=SC2086
ssh $SSH_ARGS "$ROUTER" 'mkdir -p /etc/oum/packages/passwall && chmod 700 /etc/oum /etc/oum/packages /etc/oum/packages/passwall'

IFS='
'
for entry in $ASSETS; do
	file="${entry%%|*}"
	# Legacy SCP mode works with OpenWrt Dropbear without sftp-server.
	# shellcheck disable=SC2086
	scp -O $SSH_ARGS "$SOURCE_DIR/$file" "$ROUTER:/etc/oum/packages/passwall/$file"
done
IFS="$old_ifs"

# shellcheck disable=SC2086
ssh $SSH_ARGS "$ROUTER" 'chmod 600 /etc/oum/packages/passwall/*.apk; /usr/libexec/oum-engine-manager preflight passwall'
echo 'PassWall assets staged and verified.'
