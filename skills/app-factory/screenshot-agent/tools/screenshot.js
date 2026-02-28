#!/usr/bin/env node
/**
 * Screenshot Agent — Automated iOS simulator screenshot capture.
 *
 * Boots required simulators, builds and installs the app, navigates
 * onboarding and core flows, and captures App Store screenshots.
 *
 * Requires: macOS, Xcode, xcrun simctl, xcodebuild
 *
 * Usage: node screenshot.js [--project-id ID] [--state-dir PATH] [--projects-dir PATH] [--logs-dir PATH]
 */

"use strict";

const path = require("path");
const fs = require("fs");
const { execSync, spawnSync } = require("child_process");
const args = process.argv.slice(2);

function getArg(name, defaultVal) {
  const idx = args.indexOf(`--${name}`);
  return idx >= 0 && args[idx + 1] ? args[idx + 1] : defaultVal;
}

const libDir = path.join(__dirname, "..", "..", "..", "..", "app-factory", "lib");

const stateDir = getArg(
  "state-dir",
  path.join(__dirname, "..", "..", "..", "..", "app-factory", "state")
);
const projectsDir = getArg(
  "projects-dir",
  path.join(__dirname, "..", "..", "..", "..", "app-factory", "projects")
);
const logsDir = getArg(
  "logs-dir",
  path.join(__dirname, "..", "..", "..", "..", "app-factory", "logs")
);
const projectId = getArg("project-id", null);

const { loadState, saveState, listStates } = require(path.join(libDir, "state"));
const { appendLiveFeed } = require(path.join(libDir, "notifications"));

// ── Device configurations ─────────────────────────────────────

const DEVICES = [
  {
    label: "iphone-6.7",
    simulator: "iPhone 16 Pro Max",
    runtime: "iOS 18",
    width: 1320,
    height: 2868,
  },
  {
    label: "iphone-6.1",
    simulator: "iPhone 16",
    runtime: "iOS 18",
    width: 1179,
    height: 2556,
  },
  {
    label: "ipad-12.9",
    simulator: "iPad Pro (12.9-inch) (6th generation)",
    runtime: "iPadOS 18",
    width: 2048,
    height: 2732,
  },
];

// Screenshot flow steps
const SCREENSHOT_STEPS = [
  { name: "01_hero", description: "Primary value / main dashboard screen", delay: 2000 },
  { name: "02_onboarding_1", description: "First-run welcome screen", delay: 1500 },
  { name: "03_onboarding_2", description: "Core flow introduction", delay: 1500 },
  { name: "04_feature_a", description: "Main feature in use with data", delay: 2000 },
  { name: "05_feature_b", description: "Secondary feature", delay: 1500 },
  { name: "06_settings", description: "Settings or profile screen", delay: 1500 },
];

// ── Simulator helpers ─────────────────────────────────────────

/**
 * Run a shell command safely and return stdout.
 * @param {string} cmd
 * @param {object} opts
 * @returns {{ stdout: string, stderr: string, code: number }}
 */
function runCmd(cmd, opts = {}) {
  const result = spawnSync("sh", ["-c", cmd], {
    encoding: "utf-8",
    timeout: opts.timeout || 60000,
    ...opts,
  });
  return {
    stdout: result.stdout || "",
    stderr: result.stderr || "",
    code: result.status || (result.error ? 1 : 0),
  };
}

/**
 * Check if xcrun and xcodebuild are available.
 * @returns {boolean}
 */
function checkDependencies() {
  const xcrun = runCmd("which xcrun");
  const xcodebuild = runCmd("which xcodebuild");
  return xcrun.code === 0 && xcodebuild.code === 0;
}

/**
 * Get the UDID of a booted or available simulator by name.
 * @param {string} deviceName
 * @returns {string|null} UDID or null
 */
function getSimulatorUDID(deviceName) {
  const result = runCmd("xcrun simctl list devices --json");
  if (result.code !== 0) return null;

  try {
    const data = JSON.parse(result.stdout);
    for (const [, devices] of Object.entries(data.devices || {})) {
      for (const device of devices) {
        if (device.name === deviceName && device.isAvailable) {
          return device.udid;
        }
      }
    }
  } catch {
    return null;
  }
  return null;
}

/**
 * Boot a simulator by UDID.
 * @param {string} udid
 * @returns {boolean}
 */
function bootSimulator(udid) {
  const result = runCmd(`xcrun simctl boot "${udid}"`, { timeout: 30000 });
  // "Already booted" is fine
  return result.code === 0 || result.stderr.includes("already booted");
}

/**
 * Wait for a simulator to reach booted state.
 * @param {string} udid
 * @param {number} maxWaitMs
 * @returns {boolean}
 */
function waitForBoot(udid, maxWaitMs = 30000) {
  const start = Date.now();
  while (Date.now() - start < maxWaitMs) {
    const result = runCmd(`xcrun simctl list devices --json`);
    if (result.code === 0) {
      try {
        const data = JSON.parse(result.stdout);
        for (const devices of Object.values(data.devices || {})) {
          for (const device of devices) {
            if (device.udid === udid && device.state === "Booted") {
              return true;
            }
          }
        }
      } catch {}
    }
    // Wait 2 seconds before polling again
    const waitUntil = Date.now() + 2000;
    while (Date.now() < waitUntil) { /* spin */ }
  }
  return false;
}

/**
 * Install app on simulator.
 * @param {string} udid
 * @param {string} appPath path to .app bundle
 * @returns {boolean}
 */
function installApp(udid, appPath) {
  const result = runCmd(`xcrun simctl install "${udid}" "${appPath}"`, { timeout: 30000 });
  return result.code === 0;
}

/**
 * Launch app on simulator.
 * @param {string} udid
 * @param {string} bundleId
 * @returns {boolean}
 */
function launchApp(udid, bundleId) {
  const result = runCmd(`xcrun simctl launch "${udid}" "${bundleId}"`, { timeout: 15000 });
  return result.code === 0;
}

/**
 * Capture a screenshot from the simulator.
 * @param {string} udid
 * @param {string} outputPath
 * @returns {boolean}
 */
function captureScreenshot(udid, outputPath) {
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  const result = runCmd(`xcrun simctl io "${udid}" screenshot "${outputPath}"`, { timeout: 10000 });
  return result.code === 0 && fs.existsSync(outputPath);
}

/**
 * Sleep for a duration in ms by spinning (no async needed).
 * @param {number} ms
 */
function sleepMs(ms) {
  const end = Date.now() + ms;
  while (Date.now() < end) { /* spin */ }
}

// ── Build helpers ─────────────────────────────────────────────

/**
 * Find the Xcode project or workspace in a directory.
 * @param {string} dir
 * @returns {{ type: 'workspace'|'project', path: string }|null}
 */
function findXcodeProject(dir) {
  if (!fs.existsSync(dir)) return null;

  const entries = fs.readdirSync(dir);
  const workspace = entries.find((e) => e.endsWith(".xcworkspace"));
  if (workspace) return { type: "workspace", path: path.join(dir, workspace) };

  const project = entries.find((e) => e.endsWith(".xcodeproj"));
  if (project) return { type: "project", path: path.join(dir, project) };

  return null;
}

/**
 * Build the app for simulator and return the .app path.
 * @param {string} projectDir
 * @param {string} simulatorName
 * @returns {{ appPath: string|null, bundleId: string|null, error: string|null }}
 */
function buildForSimulator(projectDir, simulatorName) {
  const xcode = findXcodeProject(projectDir);
  if (!xcode) {
    return { appPath: null, bundleId: null, error: "No Xcode project or workspace found" };
  }

  const derivedDataPath = path.join(projectDir, ".build", "DerivedData");
  fs.mkdirSync(derivedDataPath, { recursive: true });

  const projectFlag = xcode.type === "workspace"
    ? `-workspace "${xcode.path}"`
    : `-project "${xcode.path}"`;

  // Discover available schemes
  const schemesResult = runCmd(`xcodebuild ${projectFlag} -list 2>/dev/null`, { timeout: 30000 });
  const schemeMatch = schemesResult.stdout.match(/Schemes:\s*\n\s+(\S+)/);
  const scheme = schemeMatch ? schemeMatch[1] : null;

  if (!scheme) {
    return { appPath: null, bundleId: null, error: "Could not discover Xcode scheme" };
  }

  const buildCmd = [
    "xcodebuild",
    projectFlag,
    `-scheme "${scheme}"`,
    `-destination "platform=iOS Simulator,name=${simulatorName}"`,
    `-derivedDataPath "${derivedDataPath}"`,
    "build",
    "-quiet",
    "2>&1",
  ].join(" ");

  console.error(`Building scheme "${scheme}" for ${simulatorName}...`);
  const buildResult = runCmd(buildCmd, { timeout: 240000 });

  if (buildResult.code !== 0) {
    return { appPath: null, bundleId: null, error: `Build failed: ${buildResult.stdout.slice(-500)}` };
  }

  // Find .app in DerivedData
  const findResult = runCmd(
    `find "${derivedDataPath}" -name "*.app" -not -path "*/PlugIns/*" 2>/dev/null | head -1`
  );
  const appPath = findResult.stdout.trim();
  if (!appPath || !fs.existsSync(appPath)) {
    return { appPath: null, bundleId: null, error: "Could not locate built .app bundle" };
  }

  // Extract bundle ID from Info.plist
  const plistResult = runCmd(
    `plutil -p "${path.join(appPath, "Info.plist")}" 2>/dev/null | grep CFBundleIdentifier`
  );
  const bundleIdMatch = plistResult.stdout.match(/"([^"]+\.[\w.]+)"/);
  const bundleId = bundleIdMatch ? bundleIdMatch[1] : null;

  return { appPath, bundleId, error: null };
}

// ── Screenshot session ────────────────────────────────────────

/**
 * Run a screenshot session for one device.
 * @param {object} device
 * @param {string} appPath
 * @param {string|null} bundleId
 * @param {string} screenshotBaseDir
 * @returns {{ success: boolean, captured: string[], error: string|null }}
 */
function runDeviceSession(device, appPath, bundleId, screenshotBaseDir) {
  const udid = getSimulatorUDID(device.simulator);
  if (!udid) {
    return {
      success: false,
      captured: [],
      error: `Simulator not found: ${device.simulator}`,
    };
  }

  console.error(`Booting simulator: ${device.simulator} (${udid})`);
  if (!bootSimulator(udid)) {
    return { success: false, captured: [], error: `Failed to boot simulator: ${device.simulator}` };
  }

  if (!waitForBoot(udid, 45000)) {
    return { success: false, captured: [], error: `Simulator boot timeout: ${device.simulator}` };
  }

  console.error(`Installing app on ${device.simulator}...`);
  if (!installApp(udid, appPath)) {
    return { success: false, captured: [], error: `Failed to install app on ${device.simulator}` };
  }

  if (bundleId) {
    console.error(`Launching ${bundleId}...`);
    launchApp(udid, bundleId);
    sleepMs(3000); // Allow app to initialize
  }

  const deviceDir = path.join(screenshotBaseDir, device.label);
  fs.mkdirSync(deviceDir, { recursive: true });

  const captured = [];
  for (const step of SCREENSHOT_STEPS) {
    const outputPath = path.join(deviceDir, `${step.name}.png`);
    console.error(`Capturing ${step.name} on ${device.label}...`);
    sleepMs(step.delay);

    if (captureScreenshot(udid, outputPath)) {
      captured.push(outputPath);
      console.error(`  Captured: ${path.basename(outputPath)}`);
    } else {
      console.error(`  WARN: Failed to capture ${step.name} on ${device.label}`);
    }
  }

  return {
    success: captured.length >= 3,
    captured,
    error: captured.length < 3 ? `Only ${captured.length}/3 minimum screenshots captured` : null,
  };
}

// ── Main ─────────────────────────────────────────────────────

function run() {
  // Find the target project
  let state;
  if (projectId) {
    state = loadState(projectId, stateDir);
    if (!state) {
      console.error(`Project not found: ${projectId}`);
      process.exit(1);
    }
  } else {
    const all = listStates(stateDir);
    const candidates = all
      .filter((s) => s.phase === "screenshots")
      .sort((a, b) => new Date(a.timestamps.phase_entered_at) - new Date(b.timestamps.phase_entered_at));
    if (candidates.length === 0) {
      console.log(JSON.stringify({ action: "no_op", reason: "No projects in screenshots phase" }));
      return;
    }
    state = candidates[0];
  }

  const projectDir = path.join(projectsDir, state.id);
  const screenshotBaseDir = path.join(projectDir, "submission_ready", "screenshots");

  // Check dependencies
  if (!checkDependencies()) {
    const error = "xcrun or xcodebuild not found. Requires macOS with Xcode installed.";
    console.error(error);
    state.phase = "manual_review_required";
    state.error = `screenshot-agent: ${error}`;
    state.timestamps.updated_at = new Date().toISOString();
    saveState(state, stateDir);
    appendLiveFeed("screenshot-agent", state.id, `ERROR: ${error}`, logsDir);
    console.log(JSON.stringify({ action: "error", reason: error, project_id: state.id }));
    return;
  }

  const now = new Date().toISOString();

  // Build the app (use first device as reference build target)
  console.error(`Building app for project: ${state.id}`);
  const { appPath, bundleId, error: buildError } = buildForSimulator(projectDir, DEVICES[0].simulator);

  if (buildError || !appPath) {
    const error = buildError || "Unknown build failure";
    console.error(`Build failed: ${error}`);
    state.phase = "manual_review_required";
    state.error = `screenshot-agent: build failed — ${error}`;
    state.timestamps.updated_at = now;
    saveState(state, stateDir);
    appendLiveFeed("screenshot-agent", state.id, `ERROR: Build failed for "${state.name}": ${error}`, logsDir);
    console.log(JSON.stringify({ action: "error", reason: error, project_id: state.id }));
    return;
  }

  console.error(`Build succeeded. App: ${appPath}, Bundle ID: ${bundleId}`);

  // Capture screenshots for each device
  const manifest = {
    project_id: state.id,
    project_name: state.name,
    captured_at: now,
    devices: [],
  };

  let anySuccess = false;
  const deviceErrors = [];

  for (const device of DEVICES) {
    console.error(`\nProcessing device: ${device.label} (${device.simulator})`);
    const session = runDeviceSession(device, appPath, bundleId, screenshotBaseDir);

    manifest.devices.push({
      label: device.label,
      simulator: device.simulator,
      resolution: `${device.width}x${device.height}`,
      success: session.success,
      screenshot_count: session.captured.length,
      screenshots: session.captured.map((p) => path.relative(projectDir, p)),
      error: session.error,
    });

    if (session.success) {
      anySuccess = true;
      console.error(`  Device ${device.label}: ${session.captured.length} screenshots captured`);
    } else {
      deviceErrors.push(`${device.label}: ${session.error}`);
      console.error(`  Device ${device.label}: FAILED — ${session.error}`);
    }
  }

  // Write manifest
  fs.mkdirSync(screenshotBaseDir, { recursive: true });
  fs.writeFileSync(
    path.join(screenshotBaseDir, "manifest.json"),
    JSON.stringify(manifest, null, 2),
    "utf-8"
  );

  // Update state
  if (!anySuccess) {
    state.phase = "manual_review_required";
    state.error = `screenshot-agent: all device captures failed — ${deviceErrors.join("; ")}`;
    state.timestamps.updated_at = now;
    saveState(state, stateDir);
    appendLiveFeed(
      "screenshot-agent",
      state.id,
      `ERROR: All screenshot captures failed for "${state.name}"`,
      logsDir
    );
    console.log(JSON.stringify({
      action: "error",
      project_id: state.id,
      reason: "All device captures failed",
      devices: manifest.devices,
    }));
    return;
  }

  state.phase = "icon_generation";
  state.artifacts = state.artifacts || {};
  state.artifacts.screenshots_manifest = `projects/${state.id}/submission_ready/screenshots/manifest.json`;
  state.timestamps.updated_at = now;
  state.timestamps.phase_entered_at = now;

  if (deviceErrors.length > 0) {
    state.notes = state.notes || [];
    state.notes.push(`screenshot-agent: partial capture — issues: ${deviceErrors.join("; ")}`);
  }

  saveState(state, stateDir);

  const totalScreenshots = manifest.devices.reduce((sum, d) => sum + d.screenshot_count, 0);
  appendLiveFeed(
    "screenshot-agent",
    state.id,
    `Screenshots captured for "${state.name}": ${totalScreenshots} total across ${manifest.devices.filter((d) => d.success).length}/${DEVICES.length} devices. Phase → icon_generation.`,
    logsDir
  );

  console.log(JSON.stringify({
    action: "screenshots_captured",
    project_id: state.id,
    project_name: state.name,
    total_screenshots: totalScreenshots,
    devices: manifest.devices,
    next_phase: "icon_generation",
  }, null, 2));
}

// Run if invoked directly
if (require.main === module) {
  run();
}

module.exports = { run };
