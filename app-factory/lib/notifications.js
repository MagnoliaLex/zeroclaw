/**
 * Notification hooks for App Factory events.
 *
 * Uses ZeroClaw's existing Telegram channel integration
 * for operator notifications on key pipeline transitions.
 */

const fs = require("fs");
const path = require("path");
const { LOGS_DIR } = require("./state");

/**
 * Events that trigger notifications.
 */
const NOTIFICATION_EVENTS = [
  "submission_ready",
  "manual_review_required",
  "qa_failure_summary",
];

/**
 * Send a Telegram notification via ZeroClaw's channel.
 * Uses the zeroclaw CLI to send messages through configured Telegram channel.
 * @param {string} message
 * @param {object} [options]
 */
async function sendTelegramNotification(message, options = {}) {
  const { execFile } = require("child_process");
  const { promisify } = require("util");
  const exec = promisify(execFile);

  try {
    // Use zeroclaw's built-in telegram send capability
    await exec("zeroclaw", ["channel", "send", "telegram", "--message", message], {
      timeout: 15000,
      env: { ...process.env },
    });
  } catch (err) {
    // Fallback: log the notification if telegram send fails
    appendLiveFeed("notification", "system", `[NOTIFY FAILED] ${message}`);
    console.error(`Telegram notification failed: ${err.message}`);
  }
}

/**
 * Notify on submission_ready.
 * @param {object} project - Project state
 */
async function notifySubmissionReady(project) {
  const msg =
    `[App Factory] Project "${project.name}" (${project.id}) is SUBMISSION READY.\n` +
    `Template: ${project.config.template || "unknown"}\n` +
    `QA Score: ${project.artifacts.quality_report ? "passed" : "n/a"}`;

  await sendTelegramNotification(msg);
}

/**
 * Notify on manual_review_required.
 * @param {object} project
 * @param {string} reason
 */
async function notifyManualReview(project, reason) {
  const msg =
    `[App Factory] Project "${project.name}" (${project.id}) needs MANUAL REVIEW.\n` +
    `Reason: ${reason}\n` +
    `QA attempts: ${project.attempt_counters.qa || 0}/3`;

  await sendTelegramNotification(msg);
}

/**
 * Notify on repeated QA failures.
 * @param {object} project
 * @param {object} qualityReport
 */
async function notifyQAFailure(project, qualityReport) {
  const failedChecks = Object.entries(qualityReport.checks || {})
    .filter(([, v]) => !v.pass)
    .map(([k, v]) => `  - ${v.name}: ${v.evidence}`)
    .join("\n");

  const msg =
    `[App Factory] QA FAILED for "${project.name}" (attempt ${project.attempt_counters.qa}/3).\n` +
    `Score: ${qualityReport.total_score}/${qualityReport.max_score}\n` +
    `Failed checks:\n${failedChecks}`;

  await sendTelegramNotification(msg);
}

/**
 * Append an entry to the live feed log.
 * @param {string} skill - Skill name
 * @param {string} projectId - Project ID
 * @param {string} action - Description of action taken
 * @param {string} [logsDir]
 */
function appendLiveFeed(skill, projectId, action, logsDir = LOGS_DIR) {
  fs.mkdirSync(logsDir, { recursive: true });
  const logPath = path.join(logsDir, "live-feed.log");
  const now = new Date();
  const ts = now.toTimeString().split(" ")[0]; // HH:MM:SS
  const entry = `[${ts}] [${skill}] [${projectId}] — ${action}\n`;
  fs.appendFileSync(logPath, entry, "utf-8");
}

/**
 * Append an entry to the routing log.
 * @param {object} decision - Router decision object
 * @param {string} [logsDir]
 */
function appendRoutingLog(decision, logsDir = LOGS_DIR) {
  fs.mkdirSync(logsDir, { recursive: true });
  const logPath = path.join(logsDir, "routing.log");
  const entry = JSON.stringify({
    ...decision,
    timestamp: new Date().toISOString(),
  });
  fs.appendFileSync(logPath, entry + "\n", "utf-8");
}

/**
 * Read live feed entries.
 * @param {object} [options]
 * @param {string} [options.since] - ISO timestamp to filter from
 * @param {string} [options.project] - Filter by project ID
 * @param {string} [options.skill] - Filter by skill name
 * @param {number} [options.limit] - Max entries to return
 * @param {string} [options.logsDir]
 * @returns {string[]}
 */
function readLiveFeed(options = {}) {
  const logsDir = options.logsDir || LOGS_DIR;
  const logPath = path.join(logsDir, "live-feed.log");

  if (!fs.existsSync(logPath)) return [];

  let lines = fs.readFileSync(logPath, "utf-8").trim().split("\n").filter(Boolean);

  if (options.project) {
    lines = lines.filter((l) => l.includes(`[${options.project}]`));
  }
  if (options.skill) {
    lines = lines.filter((l) => l.includes(`[${options.skill}]`));
  }
  if (options.limit) {
    lines = lines.slice(-options.limit);
  }

  return lines;
}

module.exports = {
  NOTIFICATION_EVENTS,
  sendTelegramNotification,
  notifySubmissionReady,
  notifyManualReview,
  notifyQAFailure,
  appendLiveFeed,
  appendRoutingLog,
  readLiveFeed,
};
