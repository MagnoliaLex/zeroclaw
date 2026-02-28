/**
 * Quality Gate Implementation
 *
 * 6 checks with weighted scoring for iOS app quality validation.
 */

const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

const CHECKS = {
  compilation: { weight: 2.0, name: "Compilation" },
  feature_completeness: { weight: 2.0, name: "Feature Completeness" },
  crash_surface: { weight: 2.0, name: "Crash Surface Analysis" },
  permission_correctness: { weight: 1.5, name: "Permission Correctness" },
  storekit_validation: { weight: 1.5, name: "StoreKit Validation" },
  ui_ux_baseline: { weight: 1.0, name: "UI/UX Baseline" },
};

const MAX_SCORE = Object.values(CHECKS).reduce((s, c) => s + c.weight, 0); // 10.0
const PASS_THRESHOLD = 8.0;
const MAX_QA_ATTEMPTS = 3;

/**
 * Run compilation check via xcodebuild.
 * @param {string} projectPath - Path to Xcode project
 * @returns {{ pass: boolean, evidence: string }}
 */
function checkCompilation(projectPath) {
  try {
    const xcodeProj = findXcodeProject(projectPath);
    if (!xcodeProj) {
      return { pass: false, evidence: "No .xcodeproj found" };
    }

    const result = execSync(
      `xcodebuild build -project "${xcodeProj}" -scheme App ` +
        `-destination 'platform=iOS Simulator,name=iPhone 16' ` +
        `-quiet 2>&1 || true`,
      {
        cwd: projectPath,
        timeout: 120000,
        encoding: "utf-8",
        maxBuffer: 10 * 1024 * 1024,
      }
    );

    const hasErrors = /error:/i.test(result);
    const hasWarnings = /warning:/i.test(result);
    const pass = !hasErrors && !hasWarnings;

    return {
      pass,
      evidence: pass
        ? "Build succeeded with no errors or warnings"
        : `Build issues: ${hasErrors ? "errors found" : ""}${hasWarnings ? " warnings found" : ""}`,
      details: result.slice(-2000),
    };
  } catch (err) {
    return {
      pass: false,
      evidence: `xcodebuild failed: ${err.message}`.slice(0, 500),
    };
  }
}

/**
 * Check feature completeness by cross-referencing one-pager.
 * @param {string} projectPath
 * @param {object} onePager - Parsed one-pager JSON
 * @returns {{ pass: boolean, evidence: string }}
 */
function checkFeatureCompleteness(projectPath, onePager) {
  if (!onePager || !onePager.features) {
    return { pass: false, evidence: "No one-pager features to cross-reference" };
  }

  const features = onePager.features || [];
  const srcDir = path.join(projectPath, "Sources");

  if (!fs.existsSync(srcDir)) {
    return { pass: false, evidence: "No Sources directory found" };
  }

  const sourceFiles = getAllFiles(srcDir, ".swift");
  const sourceContent = sourceFiles
    .map((f) => fs.readFileSync(f, "utf-8"))
    .join("\n");

  const found = [];
  const missing = [];

  for (const feature of features) {
    const keywords = feature.keywords || [feature.name];
    const isImplemented = keywords.some(
      (kw) =>
        sourceContent.toLowerCase().includes(kw.toLowerCase()) ||
        sourceFiles.some((f) =>
          path.basename(f).toLowerCase().includes(kw.toLowerCase())
        )
    );
    if (isImplemented) {
      found.push(feature.name);
    } else {
      missing.push(feature.name);
    }
  }

  const pass = missing.length === 0;
  return {
    pass,
    evidence: pass
      ? `All ${found.length} features found in source`
      : `Missing features: ${missing.join(", ")}`,
    found,
    missing,
  };
}

/**
 * Static analysis for crash surfaces.
 * @param {string} projectPath
 * @param {object} [reviewReport] - Code reviewer report if available
 * @returns {{ pass: boolean, evidence: string }}
 */
function checkCrashSurface(projectPath, reviewReport) {
  const srcDir = path.join(projectPath, "Sources");
  if (!fs.existsSync(srcDir)) {
    return { pass: false, evidence: "No Sources directory" };
  }

  const issues = [];
  const sourceFiles = getAllFiles(srcDir, ".swift");

  for (const file of sourceFiles) {
    const content = fs.readFileSync(file, "utf-8");
    const basename = path.basename(file);
    const lines = content.split("\n");

    lines.forEach((line, idx) => {
      // Force unwraps
      if (/[^?]!\s*\./.test(line) && !/IBOutlet|IBAction/.test(line)) {
        issues.push(`${basename}:${idx + 1} — force unwrap detected`);
      }
      // try! (force try)
      if (/\btry!/.test(line)) {
        issues.push(`${basename}:${idx + 1} — force try detected`);
      }
      // fatalError in non-test code
      if (/fatalError\(/.test(line) && !basename.includes("Test")) {
        issues.push(`${basename}:${idx + 1} — fatalError call`);
      }
    });
  }

  // Include review report findings if available
  if (reviewReport && reviewReport.crash_risks) {
    issues.push(
      ...reviewReport.crash_risks.map((r) => `[reviewer] ${r}`)
    );
  }

  const pass = issues.length === 0;
  return {
    pass,
    evidence: pass
      ? "No crash surface issues detected"
      : `${issues.length} potential crash issues found`,
    issues: issues.slice(0, 50),
  };
}

/**
 * Verify Info.plist permissions match declared needs.
 * @param {string} projectPath
 * @param {string[]} requiredPermissions - From one-pager config
 * @returns {{ pass: boolean, evidence: string }}
 */
function checkPermissionCorrectness(projectPath, requiredPermissions = []) {
  const plistPath = findInfoPlist(projectPath);
  if (!plistPath) {
    // No plist needed if no permissions required
    if (requiredPermissions.length === 0) {
      return { pass: true, evidence: "No permissions required, no Info.plist needed" };
    }
    return { pass: false, evidence: "Info.plist not found but permissions required" };
  }

  let plistContent;
  try {
    plistContent = fs.readFileSync(plistPath, "utf-8");
  } catch {
    return { pass: false, evidence: "Cannot read Info.plist" };
  }

  const declaredKeys = [];
  const undeclared = [];
  const unnecessary = [];

  // Common permission keys
  const PERMISSION_KEYS = {
    camera: "NSCameraUsageDescription",
    microphone: "NSMicrophoneUsageDescription",
    location: "NSLocationWhenInUseUsageDescription",
    photos: "NSPhotoLibraryUsageDescription",
    contacts: "NSContactsUsageDescription",
    calendar: "NSCalendarsUsageDescription",
    notifications: "NSUserNotificationsUsageDescription",
    health: "NSHealthShareUsageDescription",
    tracking: "NSUserTrackingUsageDescription",
  };

  // Check required permissions are declared
  for (const perm of requiredPermissions) {
    const key = PERMISSION_KEYS[perm.toLowerCase()];
    if (key && !plistContent.includes(key)) {
      undeclared.push(`${perm} (${key})`);
    } else if (key) {
      declaredKeys.push(perm);
    }
  }

  // Check for unnecessary permissions
  for (const [perm, key] of Object.entries(PERMISSION_KEYS)) {
    if (
      plistContent.includes(key) &&
      !requiredPermissions.map((r) => r.toLowerCase()).includes(perm)
    ) {
      unnecessary.push(`${perm} (${key}) declared but not required`);
    }
  }

  const issues = [...undeclared.map((u) => `Missing: ${u}`), ...unnecessary];
  const pass = issues.length === 0;

  return {
    pass,
    evidence: pass
      ? `All ${declaredKeys.length} permissions correctly declared`
      : `Permission issues: ${issues.join("; ")}`,
    declaredKeys,
    issues,
  };
}

/**
 * Validate StoreKit 2 integration.
 * @param {string} projectPath
 * @returns {{ pass: boolean, evidence: string }}
 */
function checkStoreKitValidation(projectPath) {
  const srcDir = path.join(projectPath, "Sources");
  if (!fs.existsSync(srcDir)) {
    return { pass: false, evidence: "No Sources directory" };
  }

  const sourceFiles = getAllFiles(srcDir, ".swift");
  const allSource = sourceFiles
    .map((f) => fs.readFileSync(f, "utf-8"))
    .join("\n");

  const checks = {
    hasProductImport:
      allSource.includes("import StoreKit") ||
      allSource.includes("StoreKit"),
    hasProductRequest:
      allSource.includes("Product.products") ||
      allSource.includes("Product.SubscriptionInfo"),
    hasTransactionHandling:
      allSource.includes("Transaction.currentEntitlements") ||
      allSource.includes("Transaction.updates"),
    hasPaywallUI:
      allSource.includes("PaywallView") ||
      allSource.includes("SubscriptionView") ||
      allSource.includes("PurchaseView"),
    hasConfiguration:
      fs.existsSync(
        path.join(projectPath, "Resources", "Products.storekit")
      ) ||
      allSource.includes("productIdentifiers"),
  };

  const passed = Object.values(checks).filter(Boolean).length;
  const total = Object.keys(checks).length;
  const pass = passed >= 3; // At least 3 of 5 StoreKit patterns present

  return {
    pass,
    evidence: `StoreKit integration: ${passed}/${total} patterns found`,
    checks,
  };
}

/**
 * UI/UX baseline check via simulated traversal.
 * @param {string} projectPath
 * @returns {{ pass: boolean, evidence: string }}
 */
function checkUIUXBaseline(projectPath) {
  const srcDir = path.join(projectPath, "Sources");
  if (!fs.existsSync(srcDir)) {
    return { pass: false, evidence: "No Sources directory" };
  }

  const sourceFiles = getAllFiles(srcDir, ".swift");
  const allSource = sourceFiles
    .map((f) => fs.readFileSync(f, "utf-8"))
    .join("\n");

  const uiChecks = {
    hasNavigationStructure:
      allSource.includes("NavigationStack") ||
      allSource.includes("NavigationView") ||
      allSource.includes("TabView"),
    hasOnboarding:
      allSource.includes("OnboardingView") ||
      allSource.includes("WelcomeView") ||
      sourceFiles.some((f) =>
        path.basename(f).toLowerCase().includes("onboard")
      ),
    hasSettings:
      allSource.includes("SettingsView") ||
      sourceFiles.some((f) =>
        path.basename(f).toLowerCase().includes("setting")
      ),
    hasAccessibility:
      allSource.includes(".accessibilityLabel") ||
      allSource.includes(".accessibilityHint"),
    hasErrorStates:
      allSource.includes("ErrorView") ||
      allSource.includes(".alert") ||
      allSource.includes("EmptyStateView"),
  };

  const passed = Object.values(uiChecks).filter(Boolean).length;
  const total = Object.keys(uiChecks).length;
  const pass = passed >= 3; // At least 3 of 5 UI patterns present

  return {
    pass,
    evidence: `UI/UX patterns: ${passed}/${total} found`,
    checks: uiChecks,
  };
}

/**
 * Run all 6 quality checks and produce a quality report.
 * @param {string} projectPath
 * @param {object} [onePager] - One-pager JSON
 * @param {object} [reviewReport] - Code reviewer report
 * @param {string[]} [requiredPermissions]
 * @returns {object} Quality report
 */
function runQualityGate(
  projectPath,
  onePager = null,
  reviewReport = null,
  requiredPermissions = []
) {
  const results = {
    compilation: checkCompilation(projectPath),
    feature_completeness: checkFeatureCompleteness(projectPath, onePager),
    crash_surface: checkCrashSurface(projectPath, reviewReport),
    permission_correctness: checkPermissionCorrectness(
      projectPath,
      requiredPermissions
    ),
    storekit_validation: checkStoreKitValidation(projectPath),
    ui_ux_baseline: checkUIUXBaseline(projectPath),
  };

  let totalScore = 0;
  const checkResults = {};

  for (const [key, check] of Object.entries(CHECKS)) {
    const result = results[key];
    const score = result.pass ? check.weight : 0;
    totalScore += score;
    checkResults[key] = {
      name: check.name,
      weight: check.weight,
      pass: result.pass,
      score,
      evidence: result.evidence,
      details: result.details || result.issues || result.checks || null,
    };
  }

  return {
    timestamp: new Date().toISOString(),
    project_path: projectPath,
    total_score: totalScore,
    max_score: MAX_SCORE,
    passed: totalScore >= PASS_THRESHOLD,
    pass_threshold: PASS_THRESHOLD,
    checks: checkResults,
    recommendation:
      totalScore >= PASS_THRESHOLD ? "proceed_to_monetization" : "needs_remediation",
  };
}

// ── Helpers ──────────────────────────────────────────────────

function findXcodeProject(dir) {
  if (!fs.existsSync(dir)) return null;
  const entries = fs.readdirSync(dir);
  const proj = entries.find((e) => e.endsWith(".xcodeproj"));
  return proj ? path.join(dir, proj) : null;
}

function findInfoPlist(dir) {
  const candidates = [
    path.join(dir, "Info.plist"),
    path.join(dir, "Resources", "Info.plist"),
    path.join(dir, "Sources", "Info.plist"),
  ];
  for (const c of candidates) {
    if (fs.existsSync(c)) return c;
  }
  // Recursive search
  const all = getAllFiles(dir, ".plist");
  return all.find((f) => path.basename(f) === "Info.plist") || null;
}

function getAllFiles(dir, ext) {
  const results = [];
  if (!fs.existsSync(dir)) return results;

  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...getAllFiles(fullPath, ext));
    } else if (entry.name.endsWith(ext)) {
      results.push(fullPath);
    }
  }
  return results;
}

module.exports = {
  CHECKS,
  MAX_SCORE,
  PASS_THRESHOLD,
  MAX_QA_ATTEMPTS,
  checkCompilation,
  checkFeatureCompleteness,
  checkCrashSurface,
  checkPermissionCorrectness,
  checkStoreKitValidation,
  checkUIUXBaseline,
  runQualityGate,
};
