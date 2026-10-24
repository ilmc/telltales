#!/bin/sh
# scripts/iphone-heel-credentials.sh
set -eu
[ "$(uname -s)" = Darwin ] || { echo 'iPhone heel credentials require macOS Keychain.' >&2; exit 2; }
save() { name=$1; label=$2; printf '%s: ' "$label" >&2; stty -echo; IFS= read -r value; stty echo; printf '\n' >&2; test -n "$value" || { echo 'credential was empty; no change made' >&2; exit 2; }; printf '%s' "$value" | node scripts/iphone-heel-local.mjs save-secret "$name"; unset value; }
save producer 'Signal K readwrite token'
save ingress 'Telltales plugin ingress token'
save viewer 'Signal K readonly stream token'
echo 'Stored credentials in macOS Keychain. They are not in .local or shell environment.'
