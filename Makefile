.PHONY: test tests end-to-end-tests tests-e2e

# Fast unit/configuration suite.
test tests:
	npm run validate:config
	npm test

# Real Signal K + Chromium integration (requires Docker and installed npm deps).
end-to-end-tests tests-e2e:
	npm run test:signalk:e2e
