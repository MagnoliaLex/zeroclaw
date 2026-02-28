#!/usr/bin/env node
/**
 * Shelly Router — Standalone routing logic.
 *
 * Can be invoked directly by the cron scheduler as a shell job,
 * or used by the Shelly skill prompt as a tool.
 *
 * Usage: node route.js [--state-dir PATH] [--logs-dir PATH]
 */

const path = require("path");
const args = process.argv.slice(2);

function getArg(name, defaultVal) {
  const idx = args.indexOf(`--${name}`);
  return idx >= 0 && args[idx + 1] ? args[idx + 1] : defaultVal;
}

const stateDir = getArg(
  "state-dir",
  path.join(__dirname, "..", "..", "..", "..", "app-factory", "state")
);
const logsDir = getArg(
  "logs-dir",
  path.join(__dirname, "..", "..", "..", "..", "app-factory", "logs")
);

// Add lib to path
const libDir = path.join(__dirname, "..", "..", "..", "..", "app-factory", "lib");

const { listStates, acquireLease } = require(path.join(libDir, "state"));
const { isActionablePhase, skillForPhase } = require(path.join(libDir, "pipeline"));
const { writeSummary } = require(path.join(libDir, "summary"));
const { appendRoutingLog, appendLiveFeed } = require(path.join(libDir, "notifications"));

const MAX_ACTIVE = 5;

function route() {
  // Generate fresh summary
  const summary = writeSummary(stateDir);

  const states = listStates(stateDir);

  // Filter to actionable, unlocked projects
  const actionable = states
    .filter((s) => {
      if (!isActionablePhase(s.phase)) return false;
      if (s.lock) {
        const leaseAge =
          Date.now() - new Date(s.lock.acquired_at).getTime();
        if (leaseAge < 2 * 60 * 1000) return false; // Still locked
      }
      return true;
    })
    .sort((a, b) => {
      // Oldest stalled first
      const aTime = new Date(a.timestamps.phase_entered_at).getTime();
      const bTime = new Date(b.timestamps.phase_entered_at).getTime();
      return aTime - bTime;
    });

  const activeCount = states.filter(
    (s) =>
      !["archived", "paused", "manual_review_required"].includes(s.phase)
  ).length;

  // Check concurrency cap
  if (activeCount >= MAX_ACTIVE && actionable.length === 0) {
    const decision = {
      action: "no_op",
      reason: "Concurrency cap reached (5 active) with no stalled projects",
      active_project_count: activeCount,
    };
    writeDecision(decision);
    return decision;
  }

  if (actionable.length === 0) {
    const decision = {
      action: "no_op",
      reason: "No actionable projects",
      active_project_count: activeCount,
    };
    writeDecision(decision);
    return decision;
  }

  // Pick oldest stalled
  const target = actionable[0];
  const skill = skillForPhase(target.phase);

  if (!skill) {
    const decision = {
      action: "no_op",
      reason: `No skill mapped for phase: ${target.phase}`,
      active_project_count: activeCount,
    };
    writeDecision(decision);
    return decision;
  }

  // Skip new research if at concurrency cap
  if (
    activeCount >= MAX_ACTIVE &&
    skill === "research-scout"
  ) {
    // Find next non-research project
    const nonResearch = actionable.find(
      (s) => skillForPhase(s.phase) !== "research-scout"
    );
    if (!nonResearch) {
      const decision = {
        action: "no_op",
        reason: "Concurrency cap reached; only research tasks available",
        active_project_count: activeCount,
      };
      writeDecision(decision);
      return decision;
    }
  }

  const stalledMs =
    Date.now() - new Date(target.timestamps.phase_entered_at).getTime();
  const stalledMin = Math.floor(stalledMs / 60000);

  const decision = {
    action: "delegate",
    project_id: target.id,
    project_name: target.name,
    current_phase: target.phase,
    target_skill: skill,
    reason: `Oldest stalled project (${stalledMin} min in ${target.phase})`,
    active_project_count: activeCount,
  };

  writeDecision(decision);
  return decision;
}

function writeDecision(decision) {
  const fs = require("fs");
  decision.timestamp = new Date().toISOString();

  // Write routing decision
  fs.mkdirSync(stateDir, { recursive: true });
  fs.writeFileSync(
    path.join(stateDir, "routing_decision.json"),
    JSON.stringify(decision, null, 2),
    "utf-8"
  );

  // Append to routing log
  appendRoutingLog(decision, logsDir);

  // Append to live feed
  const summary =
    decision.action === "delegate"
      ? `Routing ${decision.project_name} → ${decision.target_skill} (${decision.reason})`
      : `No-op: ${decision.reason}`;
  appendLiveFeed("shelly-router", "system", summary, logsDir);

  // Print for CLI output
  console.log(JSON.stringify(decision, null, 2));
}

// Run if invoked directly
if (require.main === module) {
  route();
}

module.exports = { route };
