#!/usr/bin/env bash
# Verify the native tsc binary that `npm run typecheck` and `npm run build` execute.
#
# TypeScript 7 ships its compiler as a stripped Go executable in a per-platform
# optional package (@typescript/typescript-<os>-<arch>). The lockfile pins that
# tarball by sha512 and `npm audit signatures` checks the npm registry's own
# signature, but neither proves who built the binary: @typescript/* publishes no
# npm provenance attestation. Microsoft does ship a detached PGP signature next
# to the ELF binary, and that is the one link back to Microsoft's release key.
# See the threat model, "Зависимости с нативными исполняемыми файлами".
#
# Fail-closed by design: a missing binary, a missing signature, a missing or
# swapped key, or a signature from any other key is an error. In particular
# `npm ci` only warns and exits 0 when an *optional* package fails its integrity
# check, so "the binary is not there" must fail here rather than silently pass.
set -euo pipefail

PKG_DIR="node_modules/@typescript/typescript-linux-x64/lib"
BIN="$PKG_DIR/tsc"
SIG="$PKG_DIR/tsc.sig"
KEY=".github/keys/microsoft-release-signing.asc"
# Microsoft (Release signing) <gpgsecurity@microsoft.com>, also published at
# https://packages.microsoft.com/keys/microsoft.asc
FPR="BC528686B50D79E339D3721CEB3E94ADBE1229CF"

for f in "$BIN" "$SIG" "$KEY"; do
  if [ ! -f "$f" ]; then
    echo "::error::missing $f — cannot verify the native tsc binary that typecheck and build execute"
    exit 1
  fi
done

GNUPGHOME="$(mktemp -d)"
export GNUPGHOME
trap 'rm -rf "$GNUPGHOME"' EXIT
chmod 700 "$GNUPGHOME"

gpg --quiet --import "$KEY"

# Pin the key. Without this, replacing the committed key file with an attacker's
# key would make the signature check below pass.
if ! gpg --list-keys --with-colons | awk -F: '/^fpr:/ { print $10 }' | grep -qx "$FPR"; then
  echo "::error::$KEY does not contain $FPR"
  exit 1
fi

# Pin the signer. gpg exits 0 for a good signature from *any* key in the
# keyring, so assert VALIDSIG against the expected fingerprint instead of
# trusting the exit status.
if ! gpg --status-fd 1 --verify "$SIG" "$BIN" 2>/dev/null |
  grep -q "^\[GNUPG:\] VALIDSIG $FPR "; then
  echo "::error::$BIN is not signed by Microsoft release signing key $FPR"
  exit 1
fi

echo "OK: $BIN verified against $FPR"
