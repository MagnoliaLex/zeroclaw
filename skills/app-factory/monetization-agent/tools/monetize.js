#!/usr/bin/env node
/**
 * Monetization Agent Tool
 *
 * Validates and configures StoreKit 2 integration.
 * Usage: node monetize.js --project-id <id>
 */

const fs = require("fs");
const path = require("path");

const args = process.argv.slice(2);
function getArg(name, defaultVal) {
  const idx = args.indexOf(`--${name}`);
  return idx >= 0 && args[idx + 1] ? args[idx + 1] : defaultVal;
}

const projectId = getArg("project-id", null);
const libDir = path.join(__dirname, "..", "..", "..", "..", "app-factory", "lib");
const stateDir = getArg("state-dir", path.join(__dirname, "..", "..", "..", "..", "app-factory", "state"));
const projectsDir = getArg("projects-dir", path.join(__dirname, "..", "..", "..", "..", "app-factory", "projects"));

const { loadState, saveState } = require(path.join(libDir, "state"));
const { transitionPhase } = require(path.join(libDir, "pipeline"));
const { appendLiveFeed } = require(path.join(libDir, "notifications"));
const logsDir = path.join(stateDir, "..", "logs");

const DEFAULT_PRICING = {
  premium_unlock: { id: "com.app.premium", price: 2.99, type: "non-consumable" },
  monthly_sub: { id: "com.app.monthly", price: 1.99, type: "auto-renewable", period: "monthly" },
  annual_sub: { id: "com.app.annual", price: 9.99, type: "auto-renewable", period: "annual" },
};

function run() {
  if (!projectId) {
    console.error("Usage: node monetize.js --project-id <id>");
    process.exit(1);
  }

  const state = loadState(projectId, stateDir);
  if (!state) {
    console.error(`Project not found: ${projectId}`);
    process.exit(1);
  }

  const projectPath = path.join(projectsDir, projectId);
  appendLiveFeed("monetization-agent", projectId, "Configuring monetization", logsDir);

  // Generate bundle ID from project name
  const bundleSlug = state.name.toLowerCase().replace(/[^a-z0-9]+/g, "");
  const pricing = JSON.parse(JSON.stringify(DEFAULT_PRICING));
  pricing.premium_unlock.id = `com.zeroclaw.${bundleSlug}.premium`;
  pricing.monthly_sub.id = `com.zeroclaw.${bundleSlug}.monthly`;
  pricing.annual_sub.id = `com.zeroclaw.${bundleSlug}.annual`;

  // Write monetization config
  const configPath = path.join(projectPath, "monetization_config.json");
  fs.mkdirSync(projectPath, { recursive: true });
  fs.writeFileSync(configPath, JSON.stringify({
    timestamp: new Date().toISOString(),
    project_id: projectId,
    bundle_id: `com.zeroclaw.${bundleSlug}`,
    products: pricing,
    paywall_type: "freemium",
    trial_days: 7,
  }, null, 2));

  // Write Products.storekit configuration
  const storekitConfig = {
    identifier: `com.zeroclaw.${bundleSlug}`,
    products: [
      { id: pricing.premium_unlock.id, type: "NonConsumable", displayName: "Premium Unlock", price: pricing.premium_unlock.price },
      { id: pricing.monthly_sub.id, type: "AutoRenewable", displayName: "Monthly Pro", price: pricing.monthly_sub.price, subscription: { group: "pro", period: "P1M" } },
      { id: pricing.annual_sub.id, type: "AutoRenewable", displayName: "Annual Pro", price: pricing.annual_sub.price, subscription: { group: "pro", period: "P1Y" } },
    ],
  };
  const resourcesDir = path.join(projectPath, "Resources");
  fs.mkdirSync(resourcesDir, { recursive: true });
  fs.writeFileSync(path.join(resourcesDir, "Products.storekit"), JSON.stringify(storekitConfig, null, 2));

  state.config.monetization_model = "freemium";
  transitionPhase(state, "store_packaging", "monetization-agent", stateDir);
  saveState(state, stateDir);

  appendLiveFeed("monetization-agent", projectId, `Monetization configured: freemium with 3 products`, logsDir);
  console.log(JSON.stringify({ status: "configured", products: Object.keys(pricing) }, null, 2));
}

if (require.main === module) {
  run();
}
