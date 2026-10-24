# Makefile

.PHONY: help test tests end-to-end-tests tests-e2e local-server-cert iphone-heel-setup iphone-heel \
	iphone-heel-hud iphone-heel-credentials iphone-heel-pairing-code iphone-heel-test iphone-heel-e2e \
	iphone-heel-status iphone-heel-stop iphone-heel-start iphone-heel-credentials-producer \
	iphone-heel-credentials-viewer iphone-heel-credentials-ingress iphone-heel-credentials-all

TELLTALES_SERVER_CERT_DIR ?= .local/certs
IPHONE_HEEL_PAIRING_FILE ?= .local/iphone-heel-pairing.env

help:
	@printf '%s\n' \
	  'make tests                 Configuration and Node tests' \
	  'make end-to-end-tests      Disposable Signal K + Chromium integration' \
	  'make local-server-cert TELLTALES_SERVER_HOST=host-or-ip' \
	  '                           Prepare/reuse a trusted local Telltales server identity' \
	  'make iphone-heel-setup TELLTALES_SERVER_HOST=host-or-ip' \
	  '                           Save/reuse non-secret local settings and TLS identity' \
	  'make iphone-heel-credentials-producer Renew only the Signal K producer credential in Keychain' \
	  'make iphone-heel           Run paired iPhone producer from any Terminal' \
	  'make iphone-heel-start     Start/reuse phone producer and authenticated HUD' \
	  'make iphone-heel-pairing-code Privately reveal the current short pairing code' \
	  'make iphone-heel-hud       Run the separate authenticated local HUD server' \
	  'make iphone-heel-status    Report local setup and experiment-owned processes' \
	  'make iphone-heel-stop      Stop only recorded experiment-owned processes' \
	  'make iphone-heel-test      Focused iPhone heel unit/lifecycle tests' \
	  'make iphone-heel-e2e       Disposable Docker Signal K E2E (not a phone test)'

# Fast unit/configuration suite.
test tests:
	npm run validate:config
	npm test

# Real Signal K + Chromium integration (requires Docker and installed npm deps).
end-to-end-tests tests-e2e:
	npm run test:signalk:e2e

# The reusable server identity is checked rather than overwritten. Credentials stay in
# macOS Keychain; each producer launch creates a separate short pairing code.
local-server-cert:
	@test -n "$(TELLTALES_SERVER_HOST)" || { echo 'set TELLTALES_SERVER_HOST to the Mac LAN hostname or IP' >&2; exit 2; }
	@sh scripts/prepare-local-server-certificate.sh "$(TELLTALES_SERVER_HOST)" "$(TELLTALES_SERVER_CERT_DIR)"

iphone-heel-setup:
	@node scripts/iphone-heel-local.mjs setup "$(TELLTALES_SERVER_HOST)"
	@sh scripts/prepare-local-server-certificate.sh "$$(node scripts/iphone-heel-local.mjs host)" "$(TELLTALES_SERVER_CERT_DIR)"
	@sh scripts/check-signalk-iphone-heel-setup.sh
	@printf '%s\n' 'TLS identity is ready. First provisioning: make iphone-heel-credentials-all; later recovery uses the targeted credential command printed by start.'

iphone-heel-credentials:
	@sh scripts/iphone-heel-credentials.sh "$(IPHONE_HEEL_CREDENTIAL)"

iphone-heel-credentials-producer iphone-heel-credentials-viewer iphone-heel-credentials-ingress iphone-heel-credentials-all:
	@sh scripts/iphone-heel-credentials.sh "$(subst iphone-heel-credentials-,,$@)"

iphone-heel:
	@test -r "$(TELLTALES_SERVER_CERT_DIR)/telltales-server.key" || { echo 'run make iphone-heel-setup TELLTALES_SERVER_HOST=… first' >&2; exit 2; }
	@TELLTALES_SERVER_CERT_DIR="$(TELLTALES_SERVER_CERT_DIR)" node scripts/iphone-heel-local.mjs producer

iphone-heel-start:
	@test -r "$(TELLTALES_SERVER_CERT_DIR)/telltales-server.key" || { echo 'run make iphone-heel-setup first' >&2; exit 2; }
	@TELLTALES_SERVER_CERT_DIR="$(TELLTALES_SERVER_CERT_DIR)" node scripts/iphone-heel-local.mjs start

iphone-heel-pairing-code:
	@node scripts/iphone-heel-local.mjs pairing-code

iphone-heel-status:
	@node scripts/iphone-heel-local.mjs status

iphone-heel-stop:
	@node scripts/iphone-heel-local.mjs stop

iphone-heel-hud:
	@printf '%s\n' 'HUD: http://127.0.0.1:4173/?view=hud&template=sailing-hud&mode=signalk' \
	  'A local same-origin stream proxy uses the Keychain credential; no token is in this URL.'
	@node scripts/iphone-heel-local.mjs hud

iphone-heel-test:
	node --test test/iphone-heel-orientation.test.mjs test/iphone-heel-auth.test.mjs test/iphone-heel-producer.test.mjs test/iphone-heel-local.test.mjs test/local-server-certificate.test.mjs

iphone-heel-e2e:
	npm run test:signalk:e2e
