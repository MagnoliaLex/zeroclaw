/**
 * Summary Generator
 *
 * Produces summary.json for Shelly routing and dashboard consumption.
 */

const fs = require("fs");
const path = require("path");
const { listStates, STATE_DIR } = require("./state");
const { isActionablePhase, skillForPhase } = require("./pipeline");

/**
 * Generate the aggregate summary.
 * @param {string} [stateDir]
 * @returns {object} Summary object
 */
function generateSummary(stateDir = STATE_DIR) {
  const states = listStates(stateDir);
  const now = new Date();

  const projects = states.map((s) => {
    const phaseEnteredAt = new Date(s.timestamps.phase_entered_at);
    const stalledMs = now.getTime() - phaseEnteredAt.getTime();
    const stalledMinutes = Math.floor(stalledMs / 60000);

    return {
      id: s.id,
      name: s.name,
      phase: s.phase,
      skill: skillForPhase(s.phase),
      actionable: isActionablePhase(s.phase),
      stalled_minutes: stalledMinutes,
      qa_attempts: s.attempt_counters.qa || 0,
      locked: s.lock != null,
      lock_holder: s.lock ? s.lock.holder : null,
      has_error: s.error != null,
      updated_at: s.timestamps.updated_at,
    };
  });

  // Queue depths by phase
  const queueDepths = {};
  for (const p of projects) {
    queueDepths[p.phase] = (queueDepths[p.phase] || 0) + 1;
  }

  // Token totals across all projects
  let totalTokens = 0;
  const tokensBySkill = {};
  for (const s of states) {
    for (const [skill, usage] of Object.entries(s.token_usage)) {
      totalTokens += usage.total || 0;
      if (!tokensBySkill[skill]) tokensBySkill[skill] = 0;
      tokensBySkill[skill] += usage.total || 0;
    }
  }

  const summary = {
    generated_at: now.toISOString(),
    total_projects: projects.length,
    active_projects: projects.filter(
      (p) =>
        !["archived", "paused", "manual_review_required"].includes(p.phase)
    ).length,
    actionable_projects: projects.filter((p) => p.actionable && !p.locked)
      .length,
    needs_attention: projects.filter(
      (p) => p.phase === "manual_review_required" || p.has_error
    ).length,
    shipped_apps: projects.filter((p) =>
      ["submission_ready", "marketing_active"].includes(p.phase)
    ).length,
    queue_depths: queueDepths,
    token_totals: {
      total: totalTokens,
      by_skill: tokensBySkill,
    },
    projects,
  };

  return summary;
}

/**
 * Write summary.json to disk.
 * @param {string} [stateDir]
 */
function writeSummary(stateDir = STATE_DIR) {
  const summary = generateSummary(stateDir);
  const summaryPath = path.join(stateDir, "summary.json");
  fs.mkdirSync(stateDir, { recursive: true });
  fs.writeFileSync(summaryPath, JSON.stringify(summary, null, 2), "utf-8");
  return summary;
}

module.exports = {
  generateSummary,
  writeSummary,
};
