#!/bin/sh
# scripts/check-signalk-iphone-heel-setup.sh
# Setup must reuse the one local Signal K instance rather than competing for its state or port.
set -eu

port=${SIGNALK_PORT:-3000}
base="http://127.0.0.1:${port}"
status=000

if command -v curl >/dev/null 2>&1; then
  status=$(curl --silent --output /dev/null --write-out '%{http_code}' --max-time 2 \
    "${base}/signalk/v1/api/vessels/self" || true)
fi

case "$status" in
  200 | 401 | 403)
    printf '%s\n' \
      "Signal K is already responding at ${base}; reusing it without starting, stopping, or changing Docker." \
      "Log in at ${base}/admin/, open Server → Plugins, and confirm Telltales observations is enabled." \
      'Set a new long random plugin ingress token and create separate readwrite/readonly Signal K identities if needed.' \
      'Do not run another Signal K container or change the loopback-only port binding.'
    ;;
  *)
    printf '%s\n' \
      "No Signal K server responded at ${base}; setup has not started one." \
      'Before starting the repository Compose service, confirm no other local Signal K instance is in use.' \
      'Then run: docker compose -f docker-compose.signalk.yml up -d' \
      'It preserves existing named-volume data and binds Signal K to loopback only.'
    ;;
esac
