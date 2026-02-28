/**
 * App Factory State Store
 *
 * File-based project state management with atomic writes,
 * leasing/locking, and phase history tracking.
 */

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

// Default directories (overridable via env)
const STATE_DIR =
  process.env.APP_FACTORY_STATE_DIR ||
  path.join(__dirname, "..", "state");
const PROJECTS_DIR =
  process.env.APP_FACTORY_PROJECTS_DIR ||
  path.join(__dirname, "..", "projects");
const LOGS_DIR =
  process.env.APP_FACTORY_LOGS_DIR ||
  path.join(__dirname, "..", "logs");

// Pipeline phases in order
const PHASES = [
  "idea_pending_validation",
  "validated",
  "idea_pending_approval",
  "approved",
  "dev_in_progress",
  "dev_complete",
  "review_in_progress",
  "review_complete",
  "qa_in_progress",
  "qa_passed",
  "qa_failed",
  "monetization",
  "store_packaging",
  "screenshots",
  "icon_generation",
  "video_production",
  "submission_ready",
  "marketing_active",
  "manual_review_required",
  "archived",
  "paused",
];

// Lease duration in milliseconds (2 minutes)
const LEASE_DURATION_MS = 2 * 60 * 1000;

/**
 * Create a new project state object.
 * @param {object} params
 * @param {string} params.id - Unique project identifier
 * @param {string} params.name - Human-readable project name
 * @param {string} params.idea - The app idea description
 * @param {string} [params.source] - Where the idea came from
 * @returns {object} Initial project state
 */
function createProjectState({ id, name, idea, source = "research-scout" }) {
  const now = new Date().toISOString();
  return {
    id,
    name,
    idea,
    source,
    phase: "idea_pending_validation",
    phase_history: [
      {
        phase: "idea_pending_validation",
        entered_at: now,
        exited_at: null,
        skill: "research-scout",
      },
    ],
    attempt_counters: {
      qa: 0,
      build: 0,
      review: 0,
    },
    timestamps: {
      created_at: now,
      updated_at: now,
      phase_entered_at: now,
    },
    token_usage: {},
    artifacts: {
      one_pager_md: null,
      one_pager_json: null,
      xcode_project: null,
      review_report: null,
      quality_report: null,
      store_listing: null,
      screenshots_dir: null,
      icon_path: null,
      video_path: null,
      privacy_policy: null,
      submission_package: null,
    },
    config: {
      template: null,
      monetization_model: null,
      permissions: [],
    },
    lock: null,
    error: null,
    notes: [],
  };
}

/**
 * Validate a project state object against the schema.
 * @param {object} state - State object to validate
 * @returns {{ valid: boolean, errors: string[] }}
 */
function validateState(state) {
  const errors = [];

  if (!state.id || typeof state.id !== "string") {
    errors.push("Missing or invalid 'id'");
  }
  if (!state.name || typeof state.name !== "string") {
    errors.push("Missing or invalid 'name'");
  }
  if (!state.phase || !PHASES.includes(state.phase)) {
    errors.push(`Invalid phase: '${state.phase}'`);
  }
  if (!state.idea || typeof state.idea !== "string") {
    errors.push("Missing or invalid 'idea'");
  }
  if (!Array.isArray(state.phase_history)) {
    errors.push("'phase_history' must be an array");
  }
  if (typeof state.attempt_counters !== "object") {
    errors.push("'attempt_counters' must be an object");
  }
  if (typeof state.timestamps !== "object") {
    errors.push("'timestamps' must be an object");
  }
  if (typeof state.token_usage !== "object") {
    errors.push("'token_usage' must be an object");
  }
  if (typeof state.artifacts !== "object") {
    errors.push("'artifacts' must be an object");
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Save project state atomically (write to temp, then rename).
 * @param {object} state - Project state
 * @param {string} [stateDir] - Override state directory
 */
function saveState(state, stateDir = STATE_DIR) {
  fs.mkdirSync(stateDir, { recursive: true });

  state.timestamps.updated_at = new Date().toISOString();

  const filePath = path.join(stateDir, `${state.id}.json`);
  const tempPath = `${filePath}.${crypto.randomBytes(4).toString("hex")}.tmp`;

  fs.writeFileSync(tempPath, JSON.stringify(state, null, 2), "utf-8");
  fs.renameSync(tempPath, filePath);
}

/**
 * Load project state from disk.
 * @param {string} projectId
 * @param {string} [stateDir]
 * @returns {object|null}
 */
function loadState(projectId, stateDir = STATE_DIR) {
  const filePath = path.join(stateDir, `${projectId}.json`);
  if (!fs.existsSync(filePath)) return null;

  const raw = fs.readFileSync(filePath, "utf-8");
  return JSON.parse(raw);
}

/**
 * List all project states.
 * @param {string} [stateDir]
 * @returns {object[]}
 */
function listStates(stateDir = STATE_DIR) {
  if (!fs.existsSync(stateDir)) return [];

  return fs
    .readdirSync(stateDir)
    .filter((f) => f.endsWith(".json") && f !== "summary.json")
    .map((f) => {
      try {
        const raw = fs.readFileSync(path.join(stateDir, f), "utf-8");
        return JSON.parse(raw);
      } catch {
        return null;
      }
    })
    .filter(Boolean);
}

/**
 * Acquire a lease on a project to prevent concurrent processing.
 * @param {string} projectId
 * @param {string} skillName
 * @param {string} [stateDir]
 * @returns {boolean} true if lease acquired
 */
function acquireLease(projectId, skillName, stateDir = STATE_DIR) {
  const state = loadState(projectId, stateDir);
  if (!state) return false;

  const now = Date.now();

  // Check existing lease
  if (state.lock) {
    const leaseAge = now - new Date(state.lock.acquired_at).getTime();
    if (leaseAge < LEASE_DURATION_MS) {
      return false; // Still held
    }
    // Expired lease — take over
  }

  state.lock = {
    holder: skillName,
    acquired_at: new Date(now).toISOString(),
    expires_at: new Date(now + LEASE_DURATION_MS).toISOString(),
  };

  saveState(state, stateDir);
  return true;
}

/**
 * Release a lease on a project.
 * @param {string} projectId
 * @param {string} skillName
 * @param {string} [stateDir]
 */
function releaseLease(projectId, skillName, stateDir = STATE_DIR) {
  const state = loadState(projectId, stateDir);
  if (!state) return;

  if (state.lock && state.lock.holder === skillName) {
    state.lock = null;
    saveState(state, stateDir);
  }
}

/**
 * Record token usage for a skill invocation.
 * @param {object} state
 * @param {string} skillName
 * @param {number} tokensUsed
 */
function recordTokenUsage(state, skillName, tokensUsed) {
  if (!state.token_usage[skillName]) {
    state.token_usage[skillName] = { total: 0, invocations: 0 };
  }
  state.token_usage[skillName].total += tokensUsed;
  state.token_usage[skillName].invocations += 1;
}

/**
 * Get the project workspace directory.
 * @param {string} projectId
 * @param {string} [projectsDir]
 * @returns {string}
 */
function projectDir(projectId, projectsDir = PROJECTS_DIR) {
  return path.join(projectsDir, projectId);
}

/**
 * Ensure the project workspace directory exists.
 * @param {string} projectId
 * @param {string} [projectsDir]
 * @returns {string} The project directory path
 */
function ensureProjectDir(projectId, projectsDir = PROJECTS_DIR) {
  const dir = projectDir(projectId, projectsDir);
  fs.mkdirSync(dir, { recursive: true });
  fs.mkdirSync(path.join(dir, "submission_ready"), { recursive: true });
  return dir;
}

/**
 * Generate a unique project ID.
 * @param {string} name - Project name for slug
 * @returns {string}
 */
function generateId(name) {
  const slug = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 30);
  const suffix = crypto.randomBytes(3).toString("hex");
  return `${slug}-${suffix}`;
}

module.exports = {
  PHASES,
  STATE_DIR,
  PROJECTS_DIR,
  LOGS_DIR,
  LEASE_DURATION_MS,
  createProjectState,
  validateState,
  saveState,
  loadState,
  listStates,
  acquireLease,
  releaseLease,
  recordTokenUsage,
  projectDir,
  ensureProjectDir,
  generateId,
};
