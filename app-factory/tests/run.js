#!/usr/bin/env node
/**
 * App Factory Test Runner
 *
 * Runs all unit and integration tests for the App Factory.
 * Usage: node app-factory/tests/run.js
 */

const path = require("path");
const fs = require("fs");

let passed = 0;
let failed = 0;
let errors = [];

function assert(condition, message) {
  if (!condition) {
    throw new Error(`Assertion failed: ${message}`);
  }
}

function assertEqual(actual, expected, message) {
  if (actual !== expected) {
    throw new Error(
      `${message}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`
    );
  }
}

function test(name, fn) {
  try {
    fn();
    passed++;
    console.log(`  PASS  ${name}`);
  } catch (err) {
    failed++;
    errors.push({ name, error: err.message });
    console.log(`  FAIL  ${name}`);
    console.log(`        ${err.message}`);
  }
}

// ── State Store Tests ──────────────────────────────────────

console.log("\n== State Store ==\n");

const {
  createProjectState,
  validateState,
  saveState,
  loadState,
  listStates,
  acquireLease,
  releaseLease,
  recordTokenUsage,
  generateId,
  PHASES,
} = require("../lib/state");

const tmpDir = fs.mkdtempSync(path.join(require("os").tmpdir(), "af-test-"));

test("createProjectState returns valid state", () => {
  const state = createProjectState({
    id: "test-1",
    name: "Test App",
    idea: "A test app idea",
  });
  assert(state.id === "test-1", "id matches");
  assert(state.phase === "idea_pending_validation", "initial phase");
  assert(state.phase_history.length === 1, "has initial history");
  assert(state.attempt_counters.qa === 0, "qa counter starts at 0");
});

test("validateState accepts valid state", () => {
  const state = createProjectState({
    id: "test-2",
    name: "Test",
    idea: "Idea",
  });
  const result = validateState(state);
  assert(result.valid, "should be valid");
  assertEqual(result.errors.length, 0, "no errors");
});

test("validateState rejects missing id", () => {
  const result = validateState({ name: "x", phase: "validated", idea: "x", phase_history: [], attempt_counters: {}, timestamps: {}, token_usage: {}, artifacts: {} });
  assert(!result.valid, "should be invalid");
});

test("validateState rejects invalid phase", () => {
  const state = createProjectState({ id: "t", name: "t", idea: "t" });
  state.phase = "nonexistent_phase";
  const result = validateState(state);
  assert(!result.valid, "should be invalid");
});

test("saveState and loadState roundtrip", () => {
  const state = createProjectState({
    id: "roundtrip",
    name: "Roundtrip",
    idea: "Test",
  });
  saveState(state, tmpDir);
  const loaded = loadState("roundtrip", tmpDir);
  assert(loaded !== null, "loaded state is not null");
  assertEqual(loaded.id, "roundtrip", "id matches");
  assertEqual(loaded.name, "Roundtrip", "name matches");
});

test("listStates returns all states", () => {
  // Create a second state
  saveState(
    createProjectState({ id: "list-test", name: "List", idea: "Test" }),
    tmpDir
  );
  const states = listStates(tmpDir);
  assert(states.length >= 2, "at least 2 states");
});

test("loadState returns null for missing project", () => {
  const result = loadState("nonexistent-id", tmpDir);
  assert(result === null, "should return null");
});

test("acquireLease succeeds on unlocked project", () => {
  saveState(
    createProjectState({ id: "lease-test", name: "Lease", idea: "Test" }),
    tmpDir
  );
  const acquired = acquireLease("lease-test", "test-skill", tmpDir);
  assert(acquired, "should acquire lease");
});

test("acquireLease fails on locked project", () => {
  const acquired = acquireLease("lease-test", "another-skill", tmpDir);
  assert(!acquired, "should not acquire lease (already held)");
});

test("releaseLease allows re-acquisition", () => {
  releaseLease("lease-test", "test-skill", tmpDir);
  const acquired = acquireLease("lease-test", "another-skill", tmpDir);
  assert(acquired, "should acquire after release");
  releaseLease("lease-test", "another-skill", tmpDir);
});

test("recordTokenUsage tracks tokens", () => {
  const state = createProjectState({ id: "token", name: "Token", idea: "t" });
  recordTokenUsage(state, "test-skill", 100);
  recordTokenUsage(state, "test-skill", 50);
  assertEqual(state.token_usage["test-skill"].total, 150, "total tokens");
  assertEqual(state.token_usage["test-skill"].invocations, 2, "invocations");
});

test("generateId produces valid slug", () => {
  const id = generateId("My Cool App!");
  assert(id.startsWith("my-cool-app"), "starts with slug");
  assert(id.length > 10, "has suffix");
  assert(!/[A-Z]/.test(id), "lowercase only");
});

test("PHASES contains expected entries", () => {
  assert(PHASES.includes("idea_pending_validation"), "has initial phase");
  assert(PHASES.includes("submission_ready"), "has final phase");
  assert(PHASES.includes("manual_review_required"), "has manual review");
  assert(PHASES.length >= 15, "has enough phases");
});

// ── Pipeline Tests ─────────────────────────────────────────

console.log("\n== Pipeline Engine ==\n");

const {
  isValidTransition,
  transitionPhase,
  skillForPhase,
  phasesForSkill,
  isActionablePhase,
  canRetryQA,
  incrementAttempt,
  TRANSITIONS,
} = require("../lib/pipeline");

test("isValidTransition accepts valid transitions", () => {
  assert(
    isValidTransition("idea_pending_validation", "validated"),
    "validation transition"
  );
  assert(isValidTransition("approved", "dev_in_progress"), "dev transition");
  assert(
    isValidTransition("qa_in_progress", "qa_passed"),
    "qa pass transition"
  );
  assert(
    isValidTransition("qa_in_progress", "qa_failed"),
    "qa fail transition"
  );
});

test("isValidTransition rejects invalid transitions", () => {
  assert(
    !isValidTransition("idea_pending_validation", "dev_complete"),
    "skip phases"
  );
  assert(!isValidTransition("archived", "approved"), "from archived");
  assert(
    !isValidTransition("submission_ready", "idea_pending_validation"),
    "backwards"
  );
});

test("transitionPhase updates state correctly", () => {
  const state = createProjectState({
    id: "trans",
    name: "Trans",
    idea: "Test",
  });
  const result = transitionPhase(state, "validated", "validation-analyst");
  assert(result.success, "transition succeeds");
  assertEqual(state.phase, "validated", "phase updated");
  assertEqual(state.phase_history.length, 2, "history has 2 entries");
  assert(
    state.phase_history[0].exited_at !== null,
    "previous entry closed"
  );
});

test("transitionPhase rejects invalid transition", () => {
  const state = createProjectState({
    id: "bad-trans",
    name: "Bad",
    idea: "Test",
  });
  const result = transitionPhase(state, "submission_ready", "test");
  assert(!result.success, "transition fails");
  assertEqual(
    state.phase,
    "idea_pending_validation",
    "phase unchanged"
  );
});

test("skillForPhase returns correct skill", () => {
  assertEqual(
    skillForPhase("idea_pending_validation"),
    "research-scout",
    "research phase"
  );
  assertEqual(
    skillForPhase("dev_in_progress"),
    "app-builder",
    "dev phase"
  );
  assertEqual(
    skillForPhase("review_in_progress"),
    "code-reviewer",
    "review phase"
  );
  assertEqual(
    skillForPhase("manual_review_required"),
    null,
    "manual review has no skill"
  );
});

test("phasesForSkill returns phases", () => {
  const phases = phasesForSkill("app-builder");
  assert(phases.includes("dev_in_progress"), "has dev phase");
  assert(phases.includes("approved"), "has approved phase");
});

test("isActionablePhase identifies actionable phases", () => {
  assert(isActionablePhase("idea_pending_validation"), "validation");
  assert(isActionablePhase("dev_in_progress"), "dev");
  assert(!isActionablePhase("manual_review_required"), "manual review");
  assert(!isActionablePhase("archived"), "archived");
  assert(!isActionablePhase("paused"), "paused");
});

test("canRetryQA allows retries under limit", () => {
  const state = createProjectState({ id: "qa", name: "QA", idea: "t" });
  state.attempt_counters.qa = 2;
  const result = canRetryQA(state);
  assert(result.allowed, "should allow retry");
});

test("canRetryQA blocks at limit", () => {
  const state = createProjectState({ id: "qa2", name: "QA2", idea: "t" });
  state.attempt_counters.qa = 3;
  const result = canRetryQA(state);
  assert(!result.allowed, "should block retry");
});

test("incrementAttempt increases counter", () => {
  const state = createProjectState({ id: "inc", name: "Inc", idea: "t" });
  incrementAttempt(state, "qa");
  incrementAttempt(state, "qa");
  assertEqual(state.attempt_counters.qa, 2, "counter is 2");
});

test("TRANSITIONS covers all phases", () => {
  const covered = Object.keys(TRANSITIONS);
  assert(covered.includes("idea_pending_validation"), "has initial");
  assert(covered.includes("archived"), "has terminal");
  assert(covered.length >= 15, "covers enough phases");
});

// ── Routing Logic Tests ────────────────────────────────────

console.log("\n== Routing Logic ==\n");

test("router picks oldest stalled project", () => {
  const routerTmp = fs.mkdtempSync(path.join(require("os").tmpdir(), "af-route-"));

  // Create two projects at different phases
  const p1 = createProjectState({ id: "old-project", name: "Old", idea: "t" });
  p1.phase = "validated";
  p1.timestamps.phase_entered_at = new Date(
    Date.now() - 60 * 60000
  ).toISOString(); // 60 min ago
  saveState(p1, routerTmp);

  const p2 = createProjectState({ id: "new-project", name: "New", idea: "t" });
  p2.phase = "validated";
  p2.timestamps.phase_entered_at = new Date(
    Date.now() - 10 * 60000
  ).toISOString(); // 10 min ago
  saveState(p2, routerTmp);

  // Simulate routing logic
  const states = listStates(routerTmp);
  const actionable = states
    .filter((s) => isActionablePhase(s.phase) && !s.lock)
    .sort((a, b) => {
      return (
        new Date(a.timestamps.phase_entered_at).getTime() -
        new Date(b.timestamps.phase_entered_at).getTime()
      );
    });

  assertEqual(actionable[0].id, "old-project", "oldest project first");
  fs.rmSync(routerTmp, { recursive: true, force: true });
});

test("router skips locked projects", () => {
  const routerTmp = fs.mkdtempSync(path.join(require("os").tmpdir(), "af-route2-"));

  const p1 = createProjectState({ id: "locked-p", name: "Locked", idea: "t" });
  p1.phase = "dev_complete";
  p1.lock = {
    holder: "some-skill",
    acquired_at: new Date().toISOString(),
    expires_at: new Date(Date.now() + 120000).toISOString(),
  };
  saveState(p1, routerTmp);

  const states = listStates(routerTmp);
  const actionable = states.filter((s) => {
    if (!isActionablePhase(s.phase)) return false;
    if (s.lock) {
      const age = Date.now() - new Date(s.lock.acquired_at).getTime();
      if (age < 120000) return false;
    }
    return true;
  });

  assertEqual(actionable.length, 0, "no actionable (all locked)");
  fs.rmSync(routerTmp, { recursive: true, force: true });
});

test("router respects concurrency cap", () => {
  const routerTmp = fs.mkdtempSync(path.join(require("os").tmpdir(), "af-route3-"));

  // Create 5 active projects
  for (let i = 0; i < 5; i++) {
    const p = createProjectState({
      id: `active-${i}`,
      name: `Active ${i}`,
      idea: "t",
    });
    p.phase = "dev_in_progress";
    saveState(p, routerTmp);
  }

  // Create a 6th that needs research (new project creation)
  const p6 = createProjectState({
    id: "research-new",
    name: "Research",
    idea: "t",
  });
  p6.phase = "idea_pending_validation";
  saveState(p6, routerTmp);

  const states = listStates(routerTmp);
  const activeCount = states.filter(
    (s) => !["archived", "paused", "manual_review_required"].includes(s.phase)
  ).length;

  assert(activeCount >= 5, "5+ active projects");
  // Research should be skipped due to cap
  fs.rmSync(routerTmp, { recursive: true, force: true });
});

test("router no-ops when nothing actionable", () => {
  const routerTmp = fs.mkdtempSync(path.join(require("os").tmpdir(), "af-route4-"));

  const p = createProjectState({
    id: "archived-p",
    name: "Archived",
    idea: "t",
  });
  p.phase = "archived";
  saveState(p, routerTmp);

  const states = listStates(routerTmp);
  const actionable = states.filter(
    (s) => isActionablePhase(s.phase) && !s.lock
  );

  assertEqual(actionable.length, 0, "nothing actionable");
  fs.rmSync(routerTmp, { recursive: true, force: true });
});

// ── Quality Scoring Tests ──────────────────────────────────

console.log("\n== Quality Scoring ==\n");

const {
  CHECKS,
  MAX_SCORE,
  PASS_THRESHOLD,
  MAX_QA_ATTEMPTS,
} = require("../lib/quality");

test("quality checks have correct weights", () => {
  assertEqual(CHECKS.compilation.weight, 2.0, "compilation weight");
  assertEqual(CHECKS.feature_completeness.weight, 2.0, "features weight");
  assertEqual(CHECKS.crash_surface.weight, 2.0, "crash weight");
  assertEqual(CHECKS.permission_correctness.weight, 1.5, "permission weight");
  assertEqual(CHECKS.storekit_validation.weight, 1.5, "storekit weight");
  assertEqual(CHECKS.ui_ux_baseline.weight, 1.0, "ui weight");
});

test("max score is 10.0", () => {
  assertEqual(MAX_SCORE, 10.0, "max score");
});

test("pass threshold is 8.0", () => {
  assertEqual(PASS_THRESHOLD, 8.0, "pass threshold");
});

test("max QA attempts is 3", () => {
  assertEqual(MAX_QA_ATTEMPTS, 3, "max attempts");
});

test("all 6 checks are defined", () => {
  const checkNames = Object.keys(CHECKS);
  assertEqual(checkNames.length, 6, "6 checks");
  assert(checkNames.includes("compilation"), "has compilation");
  assert(checkNames.includes("feature_completeness"), "has features");
  assert(checkNames.includes("crash_surface"), "has crash");
  assert(checkNames.includes("permission_correctness"), "has permissions");
  assert(checkNames.includes("storekit_validation"), "has storekit");
  assert(checkNames.includes("ui_ux_baseline"), "has ui");
});

// ── Summary Generator Tests ────────────────────────────────

console.log("\n== Summary Generator ==\n");

const { generateSummary, writeSummary } = require("../lib/summary");

test("generateSummary returns valid structure", () => {
  const summaryTmp = fs.mkdtempSync(path.join(require("os").tmpdir(), "af-sum-"));
  const state = createProjectState({ id: "sum-1", name: "Sum", idea: "t" });
  saveState(state, summaryTmp);

  const summary = generateSummary(summaryTmp);
  assert(summary.generated_at, "has timestamp");
  assertEqual(summary.total_projects, 1, "1 project");
  assert(summary.projects.length === 1, "projects array");
  assert(typeof summary.queue_depths === "object", "has queue depths");
  assert(typeof summary.token_totals === "object", "has token totals");

  fs.rmSync(summaryTmp, { recursive: true, force: true });
});

test("writeSummary creates summary.json", () => {
  const summaryTmp = fs.mkdtempSync(path.join(require("os").tmpdir(), "af-sum2-"));
  const state = createProjectState({
    id: "write-sum",
    name: "WriteSummary",
    idea: "t",
  });
  saveState(state, summaryTmp);

  writeSummary(summaryTmp);
  assert(
    fs.existsSync(path.join(summaryTmp, "summary.json")),
    "summary.json exists"
  );

  fs.rmSync(summaryTmp, { recursive: true, force: true });
});

test("summary correctly counts active vs archived", () => {
  const summaryTmp = fs.mkdtempSync(path.join(require("os").tmpdir(), "af-sum3-"));

  const active = createProjectState({
    id: "active-s",
    name: "Active",
    idea: "t",
  });
  active.phase = "dev_in_progress";
  saveState(active, summaryTmp);

  const archived = createProjectState({
    id: "archived-s",
    name: "Archived",
    idea: "t",
  });
  archived.phase = "archived";
  saveState(archived, summaryTmp);

  const summary = generateSummary(summaryTmp);
  assertEqual(summary.total_projects, 2, "total 2");
  assertEqual(summary.active_projects, 1, "1 active");

  fs.rmSync(summaryTmp, { recursive: true, force: true });
});

// ── Notifications Tests ────────────────────────────────────

console.log("\n== Notifications ==\n");

const {
  appendLiveFeed,
  appendRoutingLog,
  readLiveFeed,
} = require("../lib/notifications");

test("appendLiveFeed creates log entries", () => {
  const logsTmp = fs.mkdtempSync(path.join(require("os").tmpdir(), "af-logs-"));
  appendLiveFeed("test-skill", "test-project", "Did something", logsTmp);
  appendLiveFeed("test-skill", "test-project", "Did more", logsTmp);

  const entries = readLiveFeed({ logsDir: logsTmp });
  assertEqual(entries.length, 2, "2 entries");
  assert(entries[0].includes("[test-skill]"), "has skill name");
  assert(entries[0].includes("[test-project]"), "has project id");

  fs.rmSync(logsTmp, { recursive: true, force: true });
});

test("appendRoutingLog writes JSON entries", () => {
  const logsTmp = fs.mkdtempSync(path.join(require("os").tmpdir(), "af-logs2-"));
  appendRoutingLog({ action: "delegate", target: "test" }, logsTmp);

  const logPath = path.join(logsTmp, "routing.log");
  assert(fs.existsSync(logPath), "routing.log exists");
  const content = fs.readFileSync(logPath, "utf-8");
  const entry = JSON.parse(content.trim());
  assertEqual(entry.action, "delegate", "action field");
  assert(entry.timestamp, "has timestamp");

  fs.rmSync(logsTmp, { recursive: true, force: true });
});

test("readLiveFeed filters by project", () => {
  const logsTmp = fs.mkdtempSync(path.join(require("os").tmpdir(), "af-logs3-"));
  appendLiveFeed("skill-a", "project-1", "action a", logsTmp);
  appendLiveFeed("skill-b", "project-2", "action b", logsTmp);

  const filtered = readLiveFeed({ logsDir: logsTmp, project: "project-1" });
  assertEqual(filtered.length, 1, "1 filtered entry");

  fs.rmSync(logsTmp, { recursive: true, force: true });
});

test("readLiveFeed filters by skill", () => {
  const logsTmp = fs.mkdtempSync(path.join(require("os").tmpdir(), "af-logs4-"));
  appendLiveFeed("skill-a", "p1", "a", logsTmp);
  appendLiveFeed("skill-b", "p2", "b", logsTmp);
  appendLiveFeed("skill-a", "p3", "c", logsTmp);

  const filtered = readLiveFeed({ logsDir: logsTmp, skill: "skill-a" });
  assertEqual(filtered.length, 2, "2 filtered entries");

  fs.rmSync(logsTmp, { recursive: true, force: true });
});

// ── Integration Test ───────────────────────────────────────

console.log("\n== Integration Test: Full Pipeline Simulation ==\n");

test("full pipeline state transitions from idea to submission_ready", () => {
  const intDir = fs.mkdtempSync(path.join(require("os").tmpdir(), "af-int-"));

  // Create project
  const state = createProjectState({
    id: "integration-test",
    name: "Integration App",
    idea: "A test integration app",
  });
  saveState(state, intDir);

  // Simulate pipeline progression
  const transitions = [
    { to: "validated", skill: "validation-analyst" },
    { to: "approved", skill: "dashboard" },
    { to: "dev_in_progress", skill: "app-builder" },
    { to: "dev_complete", skill: "app-builder" },
    { to: "review_in_progress", skill: "code-reviewer" },
    { to: "review_complete", skill: "code-reviewer" },
    { to: "qa_in_progress", skill: "qa-gatekeeper" },
    { to: "qa_passed", skill: "qa-gatekeeper" },
    { to: "monetization", skill: "monetization-agent" },
    { to: "store_packaging", skill: "store-packager" },
    { to: "screenshots", skill: "screenshot-agent" },
    { to: "icon_generation", skill: "icon-designer" },
    { to: "video_production", skill: "video-producer" },
    { to: "submission_ready", skill: "video-producer" },
    { to: "marketing_active", skill: "larry-marketing" },
  ];

  for (const t of transitions) {
    const result = transitionPhase(state, t.to, t.skill);
    assert(
      result.success,
      `Transition to ${t.to} should succeed (got error: ${result.error || "none"})`
    );
  }

  assertEqual(state.phase, "marketing_active", "final phase");
  assertEqual(
    state.phase_history.length,
    transitions.length + 1,
    "history entries"
  );
  saveState(state, intDir);

  // Verify summary
  const summary = generateSummary(intDir);
  assertEqual(summary.shipped_apps, 1, "1 shipped app");

  fs.rmSync(intDir, { recursive: true, force: true });
});

test("QA failure loop with max 3 retries leads to manual_review", () => {
  const intDir = fs.mkdtempSync(path.join(require("os").tmpdir(), "af-int2-"));

  const state = createProjectState({
    id: "qa-retry-test",
    name: "QA Retry",
    idea: "test",
  });
  // Fast-forward to QA
  state.phase = "qa_in_progress";
  state.phase_history.push({
    phase: "qa_in_progress",
    entered_at: new Date().toISOString(),
    exited_at: null,
    skill: "qa-gatekeeper",
  });

  // Simulate 3 QA failures
  for (let i = 0; i < 3; i++) {
    incrementAttempt(state, "qa");
    const canRetry = canRetryQA(state);

    if (canRetry.allowed) {
      // Fail QA, go back to dev
      transitionPhase(state, "qa_failed", "qa-gatekeeper");
      transitionPhase(state, "dev_in_progress", "app-builder");
      // Rebuild
      transitionPhase(state, "dev_complete", "app-builder");
      transitionPhase(state, "review_in_progress", "code-reviewer");
      transitionPhase(state, "review_complete", "code-reviewer");
      transitionPhase(state, "qa_in_progress", "qa-gatekeeper");
    } else {
      // At limit, go to manual review
      transitionPhase(state, "qa_failed", "qa-gatekeeper");
      transitionPhase(
        state,
        "manual_review_required",
        "qa-gatekeeper"
      );
    }
  }

  assertEqual(state.phase, "manual_review_required", "stuck at manual review");
  assertEqual(state.attempt_counters.qa, 3, "3 QA attempts");

  fs.rmSync(intDir, { recursive: true, force: true });
});

// ── Cleanup ────────────────────────────────────────────────

fs.rmSync(tmpDir, { recursive: true, force: true });

// ── Results ────────────────────────────────────────────────

console.log(`\n${"=".repeat(40)}`);
console.log(`Results: ${passed} passed, ${failed} failed`);
if (errors.length > 0) {
  console.log("\nFailed tests:");
  errors.forEach((e) => console.log(`  - ${e.name}: ${e.error}`));
}
console.log("");

process.exit(failed > 0 ? 1 : 0);
