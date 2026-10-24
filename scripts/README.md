<!-- scripts/README.md -->
# Development scripts — rationale

The scripts directory contains local development and verification utilities so an unfamiliar contributor or AI model can run a reproducible Telltales experiment without relying on private instructions or a heavyweight application framework.

## Design choices

- **A small Node static server** avoids introducing Python or a production web framework solely to serve local files. The default loopback binding is intentional: a development server should not silently become public network infrastructure.
- **Explicit validators** reject invalid public configuration and boat-profile assumptions before they reach a sailing display. Local boat-profile validation must not imply that private profiles are safe to publish or that a physical sensor has been calibrated.
- **Ordinary command entry points** (`npm start`, `npm run validate:config`, `make tests`) are easier for new models and human developers to rediscover than undocumented orchestration.

## Constraints

Keep tooling dependency-light and deterministic. Scripts must not assume access to real customer data, networked boat instruments, internal company repositories or credentials. Avoid changing the behaviour of the simulator or HUD merely to make tests easier.

For the exact CLI interface, inspect the scripts and [package.json](../package.json) / [Makefile](../Makefile). For feature rationale, see the [root README](../README.md) and [configuration contract](../CONFIGURATION.md).
