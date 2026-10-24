# Makefile

.PHONY: help test tests end-to-end-tests tests-e2e local-server-cert iphone-heel-setup iphone-heel \
	iphone-heel-hud iphone-heel-test iphone-heel-e2e

TELLTALES_SERVER_CERT_DIR ?= .local/certs
IPHONE_HEEL_PAIRING_FILE ?= .local/iphone-heel-pairing.env

help:
	@printf '%s\n' \
	  'make tests                 Configuration and Node tests' \
	  'make end-to-end-tests      Disposable Signal K + Chromium integration' \
	  'make local-server-cert TELLTALES_SERVER_HOST=host-or-ip' \
	  '                           Prepare/reuse a trusted local Telltales server identity' \
	  'make iphone-heel-setup TELLTALES_SERVER_HOST=host-or-ip' \
	  '                           Prepare/reuse TLS identity for the iPhone experiment' \
	  'make iphone-heel           Run paired iPhone HTTPS/WSS producer (tokens required)' \
	  'make iphone-heel-hud       Run the separate local Telltales HUD server' \
	  'make iphone-heel-test      Focused iPhone heel unit/lifecycle tests' \
	  'make iphone-heel-e2e       Disposable Docker Signal K E2E (not a phone test)'

# Fast unit/configuration suite.
test tests:
	npm run validate:config
	npm test

# Real Signal K + Chromium integration (requires Docker and installed npm deps).
end-to-end-tests tests-e2e:
	npm run test:signalk:e2e

# The reusable server identity is checked rather than overwritten. Each producer
# launch creates a separate ignored, mode-600 pairing secret; Signal K tokens
# remain caller-supplied environment variables.
local-server-cert:
	@test -n "$(TELLTALES_SERVER_HOST)" || { echo 'set TELLTALES_SERVER_HOST to the Mac LAN hostname or IP' >&2; exit 2; }
	@sh scripts/prepare-local-server-certificate.sh "$(TELLTALES_SERVER_HOST)" "$(TELLTALES_SERVER_CERT_DIR)"

iphone-heel-setup: local-server-cert
	@printf '%s\n' 'TLS identity is ready. iphone-heel creates a new private pairing secret for each launch.'

iphone-heel:
	@test -r "$(TELLTALES_SERVER_CERT_DIR)/telltales-server.key" || { echo 'run make iphone-heel-setup TELLTALES_SERVER_HOST=… first' >&2; exit 2; }
	@mkdir -p .local
	@umask 077; printf 'IPHONE_HEEL_PAIRING_CODE=%s\n' "$$(openssl rand -hex 32)" > "$(IPHONE_HEEL_PAIRING_FILE)"; \
	  trap 'rm -f "$(IPHONE_HEEL_PAIRING_FILE)"' EXIT HUP INT TERM; \
	  set -a; . "$(IPHONE_HEEL_PAIRING_FILE)"; set +a; \
	  : "$${SIGNALK_TOKEN:?set a readwrite Signal K token in this terminal}"; \
	  : "$${SIGNALK_INGRESS_TOKEN:?set the separate plugin ingress token in this terminal}"; \
	  TELLTALES_SERVER_CERT_DIR="$(TELLTALES_SERVER_CERT_DIR)" npm run iphone-heel

iphone-heel-hud:
	@printf '%s\n' 'HUD server starts at http://127.0.0.1:4173.' \
	  'Open a separate screen with ?view=hud&template=sailing-hud&mode=signalk.' \
	  'If your Signal K server requires stream authentication, append a short-lived readonly signalkToken locally; do not save or share that URL.'
	npm start

iphone-heel-test:
	node --test test/iphone-heel-orientation.test.mjs test/iphone-heel-auth.test.mjs test/iphone-heel-producer.test.mjs test/local-server-certificate.test.mjs

iphone-heel-e2e:
	npm run test:signalk:e2e
