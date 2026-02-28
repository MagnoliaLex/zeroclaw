#!/usr/bin/env node
/**
 * QA Gatekeeper Tool
 *
 * Runs 6 quality checks and routes project based on score.
 * Usage: node qa-gate.js --project-id <id> [--state-dir PATH] [--projects-dir PATH]
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
const { transitionPhase, incrementAttempt, canRetryQA } = require(path.join(libDir, "pipeline"));
const { runQualityGate, PASS_THRESHOLD } = require(path.join(libDir, "quality"));
const { appendLiveFeed, notifyQAFailure, notifyManualReview } = require(path.join(libDir, "notifications"));
const logsDir = path.join(stateDir, "..", "logs");

function run() {
  if (!projectId) {
    console.error("Usage: node qa-gate.js --project-id <id>");
    process.exit(1);
  }

  const state = loadState(projectId, stateDir);
  if (!state) {
    console.error(`Project not found: ${projectId}`);
    process.exit(1);
  }

  const projectPath = path.join(projectsDir, projectId);
  appendLiveFeed("qa-gatekeeper", projectId, "Starting quality gate", logsDir);

  // Increment QA attempt counter
  incrementAttempt(state, "qa");

  // Load one-pager and review report if available
  let onePager = null;
  let reviewReport = null;
  try {
    onePager = JSON.parse(fs.readFileSync(path.join(projectPath, "one_pager.json"), "utf-8"));
  } catch { /* no one-pager */ }
  try {
    reviewReport = JSON.parse(fs.readFileSync(path.join(projectPath, "review_report.json"), "utf-8"));
  } catch { /* no review report */ }

  // Run quality gate
  const report = runQualityGate(
    projectPath,
    onePager,
    reviewReport,
    state.config.permissions || []
  );

  // Write report
  fs.mkdirSync(projectPath, { recursive: true });
  fs.writeFileSync(path.join(projectPath, "quality_report.json"), JSON.stringify(report, null, 2));
  state.artifacts.quality_report = "quality_report.json";

  // Route based on score
  if (report.total_score >= PASS_THRESHOLD) {
    transitionPhase(state, "qa_passed", "qa-gatekeeper", stateDir);
    transitionPhase(state, "monetization", "qa-gatekeeper", stateDir);
    appendLiveFeed("qa-gatekeeper", projectId, `QA PASSED (score: ${report.total_score}/${report.max_score})`, logsDir);
  } else {
    const retry = canRetryQA(state);
    if (retry.allowed) {
      transitionPhase(state, "qa_failed", "qa-gatekeeper", stateDir);
      transitionPhase(state, "dev_in_progress", "qa-gatekeeper", stateDir);
      state.notes.push({
        text: `QA failed (attempt ${state.attempt_counters.qa}/3, score ${report.total_score}). Remediation needed.`,
        author: "qa-gatekeeper",
        timestamp: new Date().toISOString(),
      });
      appendLiveFeed("qa-gatekeeper", projectId, `QA FAILED (score: ${report.total_score}, attempt ${state.attempt_counters.qa}/3) — returning to dev`, logsDir);
      notifyQAFailure(state, report).catch(() => {});
    } else {
      transitionPhase(state, "qa_failed", "qa-gatekeeper", stateDir);
      transitionPhase(state, "manual_review_required", "qa-gatekeeper", stateDir);
      appendLiveFeed("qa-gatekeeper", projectId, `QA FAILED (attempt 3/3) — MANUAL REVIEW REQUIRED`, logsDir);
      notifyManualReview(state, `QA failed 3 times. Last score: ${report.total_score}/${report.max_score}`).catch(() => {});
    }
  }

  saveState(state, stateDir);
  console.log(JSON.stringify(report, null, 2));
}

if (require.main === module) {
  run();
}

module.exports = { run };
