#!/bin/sh
# scripts/iphone-heel-credentials.sh
set -eu
[ "$(uname -s)" = Darwin ] || { echo 'iPhone heel credentials require macOS Keychain.' >&2; exit 2; }
save() { name=$1; label=$2; printf '%s: ' "$label" >&2; stty -echo; IFS= read -r value; stty echo; printf '\n' >&2; test -n "$value" || { echo 'credential was empty; no change made' >&2; exit 2; }; printf '%s' "$value" | node scripts/iphone-heel-local.mjs save-secret "$name"; unset value; }
renew() {
  name=$1
  printf 'Signal K %s username: ' "$name" >&2
  IFS= read -r username
  printf 'Signal K %s password: ' "$name" >&2
  stty -echo
  IFS= read -r password
  stty echo
  printf '\n' >&2
  test -n "$username" && test -n "$password" || { echo 'username or password was empty; no credential changed' >&2; exit 2; }
  # Credentials travel only over this pipe; neither is an argument, environment value, or file.
  printf '%s\n%s' "$username" "$password" | node scripts/iphone-heel-local.mjs renew-token "$name"
  unset username password
}

case "${1:-}" in
  producer) renew producer ;;
  viewer) renew viewer ;;
  ingress) save ingress 'Telltales plugin ingress token' ;;
  all)
    renew producer
    save ingress 'Telltales plugin ingress token'
    renew viewer
    ;;
  '')
    printf '%s\n' \
      'Choose only the credential that needs recovery:' \
      '  make iphone-heel-credentials-producer  # Signal K readwrite login' \
      '  make iphone-heel-credentials-viewer    # Signal K readonly login' \
      '  make iphone-heel-credentials-ingress   # configured plugin secret' \
      '  make iphone-heel-credentials-all       # first-time provisioning' >&2
    exit 2
    ;;
  *) echo 'usage: make iphone-heel-credentials-{producer|viewer|ingress|all}' >&2; exit 2 ;;
esac
echo 'Stored only the requested credential in macOS Keychain; no other local credential was changed.'
