/**
 * Pipeline Transition Engine
 *
 * Enforces valid phase transitions and records history.
 */

const { saveState, PHASES } = require("./state");

/**
 * Allowed transitions map.
 * Key: current phase → Value: array of valid next phases.
 */
const TRANSITIONS = {
  idea_pending_validation: ["validated"],
  validated: ["idea_pending_approval", "approved"],
  idea_pending_approval: ["approved", "archived"],
  approved: ["dev_in_progress"],
  dev_in_progress: ["dev_complete", "manual_review_required"],
  dev_complete: ["review_in_progress"],
  review_in_progress: ["review_complete"],
  review_complete: ["qa_in_progress"],
  qa_in_progress: ["qa_passed", "qa_failed"],
  qa_passed: ["monetization"],
  qa_failed: ["dev_in_progress", "manual_review_required"],
  monetization: ["store_packaging"],
  store_packaging: ["screenshots"],
  screenshots: ["icon_generation"],
  icon_generation: ["video_production"],
  video_production: ["submission_ready"],
  submission_ready: ["marketing_active"],
  marketing_active: ["paused", "archived"],
  manual_review_required: ["dev_in_progress", "archived"],
  paused: ["marketing_active", "archived"],
  archived: [],
};

/**
 * Map each phase to the skill responsible for processing it.
 */
const PHASE_SKILL_MAP = {
  idea_pending_validation: "research-scout",
  validated: "validation-analyst",
  idea_pending_approval: null, // dashboard action
  approved: "app-builder",
  dev_in_progress: "app-builder",
  dev_complete: "code-reviewer",
  review_in_progress: "code-reviewer",
  review_complete: "qa-gatekeeper",
  qa_in_progress: "qa-gatekeeper",
  qa_passed: "monetization-agent",
  qa_failed: "app-builder", // remediation
  monetization: "monetization-agent",
  store_packaging: "store-packager",
  screenshots: "screenshot-agent",
  icon_generation: "icon-designer",
  video_production: "video-producer",
  submission_ready: "larry-marketing",
  marketing_active: "larry-marketing",
  manual_review_required: null,
  paused: null,
  archived: null,
};

/**
 * Check if a transition from currentPhase to nextPhase is valid.
 * @param {string} currentPhase
 * @param {string} nextPhase
 * @returns {boolean}
 */
function isValidTransition(currentPhase, nextPhase) {
  const allowed = TRANSITIONS[currentPhase];
  if (!allowed) return false;
  return allowed.includes(nextPhase);
}

/**
 * Transition a project to a new phase.
 * @param {object} state - Project state object
 * @param {string} nextPhase - Target phase
 * @param {string} skill - Skill performing the transition
 * @param {string} [stateDir] - Override state directory
 * @returns {{ success: boolean, error?: string }}
 */
function transitionPhase(state, nextPhase, skill, stateDir) {
  if (!isValidTransition(state.phase, nextPhase)) {
    return {
      success: false,
      error: `Invalid transition: ${state.phase} → ${nextPhase}`,
    };
  }

  const now = new Date().toISOString();

  // Close current phase history entry
  const currentEntry = state.phase_history[state.phase_history.length - 1];
  if (currentEntry && !currentEntry.exited_at) {
    currentEntry.exited_at = now;
  }

  // Add new phase history entry
  state.phase_history.push({
    phase: nextPhase,
    entered_at: now,
    exited_at: null,
    skill,
  });

  state.phase = nextPhase;
  state.timestamps.phase_entered_at = now;

  if (stateDir) {
    saveState(state, stateDir);
  }

  return { success: true };
}

/**
 * Get the skill responsible for processing the current phase.
 * @param {string} phase
 * @returns {string|null}
 */
function skillForPhase(phase) {
  return PHASE_SKILL_MAP[phase] || null;
}

/**
 * Get phases that require a specific skill.
 * @param {string} skillName
 * @returns {string[]}
 */
function phasesForSkill(skillName) {
  return Object.entries(PHASE_SKILL_MAP)
    .filter(([, skill]) => skill === skillName)
    .map(([phase]) => phase);
}

/**
 * Check if a phase is actionable (can be worked on by a skill).
 * @param {string} phase
 * @returns {boolean}
 */
function isActionablePhase(phase) {
  return PHASE_SKILL_MAP[phase] != null;
}

/**
 * Check if QA retry is allowed for a project.
 * @param {object} state
 * @returns {{ allowed: boolean, reason?: string }}
 */
function canRetryQA(state) {
  const qaAttempts = state.attempt_counters.qa || 0;
  if (qaAttempts >= 3) {
    return {
      allowed: false,
      reason: "Max QA attempts (3) reached. Manual review required.",
    };
  }
  return { allowed: true };
}

/**
 * Increment an attempt counter.
 * @param {object} state
 * @param {string} counter - Counter name (qa, build, review)
 */
function incrementAttempt(state, counter) {
  if (!state.attempt_counters[counter]) {
    state.attempt_counters[counter] = 0;
  }
  state.attempt_counters[counter] += 1;
}

module.exports = {
  TRANSITIONS,
  PHASE_SKILL_MAP,
  isValidTransition,
  transitionPhase,
  skillForPhase,
  phasesForSkill,
  isActionablePhase,
  canRetryQA,
  incrementAttempt,
};
