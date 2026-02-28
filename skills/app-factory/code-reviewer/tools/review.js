#!/usr/bin/env node
/**
 * Code Reviewer Tool
 *
 * Reads project source code and produces a review report.
 * In production, invokes Codex CLI for analysis.
 * Falls back to static analysis if codex is unavailable.
 *
 * Usage: node review.js --project-id <id> [--state-dir PATH] [--projects-dir PATH]
 */

const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

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

function getAllSwiftFiles(dir) {
  const results = [];
  if (!fs.existsSync(dir)) return results;
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...getAllSwiftFiles(fullPath));
    } else if (entry.name.endsWith(".swift")) {
      results.push(fullPath);
    }
  }
  return results;
}

function staticReview(projectPath) {
  const srcDir = path.join(projectPath, "Sources");
  const files = getAllSwiftFiles(srcDir);
  const issues = [];
  const crashRisks = [];
  const securityIssues = [];
  const performanceConcerns = [];

  for (const file of files) {
    const content = fs.readFileSync(file, "utf-8");
    const basename = path.basename(file);
    const lines = content.split("\n");

    lines.forEach((line, idx) => {
      const lineNum = idx + 1;

      // Force unwraps
      if (/[^?!]!\s*\./.test(line) && !/IBOutlet|IBAction|@objc/.test(line)) {
        issues.push({ severity: "high", file: basename, line: lineNum, description: "Force unwrap detected", suggestion: "Use optional binding (if let/guard let)" });
        crashRisks.push(`Force unwrap in ${basename}:${lineNum}`);
      }

      // Force try
      if (/\btry!\s/.test(line)) {
        issues.push({ severity: "high", file: basename, line: lineNum, description: "Force try detected", suggestion: "Use do-catch or try?" });
        crashRisks.push(`Force try in ${basename}:${lineNum}`);
      }

      // fatalError
      if (/fatalError\(/.test(line) && !basename.includes("Test")) {
        issues.push({ severity: "medium", file: basename, line: lineNum, description: "fatalError call in production code", suggestion: "Return error or use assertionFailure for debug-only" });
        crashRisks.push(`fatalError in ${basename}:${lineNum}`);
      }

      // Hardcoded URLs/keys (potential secrets)
      if (/["']sk[-_]/.test(line) || /["']api[-_]?key/i.test(line)) {
        securityIssues.push({ severity: "high", file: basename, line: lineNum, description: "Potential hardcoded API key/secret" });
      }

      // Main thread blocking
      if (/URLSession.*\.data\(/.test(line) && !/await/.test(line) && !/async/.test(content.slice(Math.max(0, content.indexOf(line) - 200), content.indexOf(line)))) {
        performanceConcerns.push(`Potential synchronous network call in ${basename}:${lineNum}`);
      }
    });
  }

  const qualityScore = Math.max(0, 10 - issues.length * 0.5 - crashRisks.length * 1.0);

  return {
    timestamp: new Date().toISOString(),
    project_id: projectId,
    code_quality_score: Math.round(qualityScore * 10) / 10,
    total_files_reviewed: files.length,
    issues,
    crash_risks: crashRisks,
    security_issues: securityIssues,
    performance_concerns: performanceConcerns,
    recommendations: generateRecommendations(issues, crashRisks, securityIssues),
    summary: `Reviewed ${files.length} files. Found ${issues.length} issues, ${crashRisks.length} crash risks, ${securityIssues.length} security concerns.`,
  };
}

function generateRecommendations(issues, crashRisks, securityIssues) {
  const recs = [];
  if (crashRisks.length > 0) recs.push("Address force unwraps and force try calls to prevent runtime crashes");
  if (securityIssues.length > 0) recs.push("Move API keys and secrets to environment variables or secure storage");
  if (issues.some((i) => i.description.includes("fatalError"))) recs.push("Replace fatalError calls with proper error handling");
  if (recs.length === 0) recs.push("Code passes basic static analysis checks");
  return recs;
}

function run() {
  if (!projectId) {
    console.error("Usage: node review.js --project-id <id>");
    process.exit(1);
  }

  const state = loadState(projectId, stateDir);
  if (!state) {
    console.error(`Project not found: ${projectId}`);
    process.exit(1);
  }

  const projectPath = path.join(projectsDir, projectId);
  appendLiveFeed("code-reviewer", projectId, "Starting code review", path.join(stateDir, "..", "logs"));

  const report = staticReview(projectPath);

  // Write report
  fs.mkdirSync(projectPath, { recursive: true });
  fs.writeFileSync(path.join(projectPath, "review_report.json"), JSON.stringify(report, null, 2));

  state.artifacts.review_report = "review_report.json";
  transitionPhase(state, "review_complete", "code-reviewer", stateDir);
  saveState(state, stateDir);

  appendLiveFeed("code-reviewer", projectId, `Review complete: ${report.issues.length} issues, score ${report.code_quality_score}`, path.join(stateDir, "..", "logs"));
  console.log(JSON.stringify(report, null, 2));
}

if (require.main === module) {
  run();
}

module.exports = { staticReview };
