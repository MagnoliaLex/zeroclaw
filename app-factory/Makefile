.PHONY: test route summary dashboard-api dashboard start setup

# Run tests
test:
	node tests/run.js

# Run Shelly router once
route:
	node ../skills/app-factory/shelly-router/tools/route.js

# Generate summary
summary:
	node -e "require('./lib/summary').writeSummary(); console.log('Summary written to state/summary.json')"

# Start dashboard API
dashboard-api:
	cd ../dashboard-api && node server.js

# Start dashboard UI (requires npm install first)
dashboard:
	cd ../dashboard && npm run dev

# Setup: install dashboard dependencies
setup:
	cd ../dashboard-api && npm install
	cd ../dashboard && npm install

# Start everything
start:
	@echo "=== ZeroClaw App Factory ==="
	@echo ""
	@echo "1. Add heartbeat task to HEARTBEAT.md:"
	@echo "   - Run App Factory router: node skills/app-factory/shelly-router/tools/route.js"
	@echo ""
	@echo "2. Start dashboard API:"
	@echo "   cd dashboard-api && node server.js"
	@echo ""
	@echo "3. Start dashboard UI:"
	@echo "   cd dashboard && npm run dev"
	@echo ""
	@echo "4. Start ZeroClaw daemon:"
	@echo "   zeroclaw daemon"
	@echo ""
