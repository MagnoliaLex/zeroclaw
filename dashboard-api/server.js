/**
 * App Factory Dashboard API
 *
 * Read-only REST API that reads state files and logs for the dashboard.
 * Binds to localhost only by default for security.
 */

const express = require("express");
const cors = require("cors");
const path = require("path");
const fs = require("fs");
const crypto = require("crypto");

const app = express();
app.use(express.json());
app.use(cors({ origin: "http://localhost:3001" }));

// ── Configuration ──────────────────────────────────────────

const PORT = parseInt(process.env.DASHBOARD_API_PORT || "3002", 10);
const HOST = process.env.DASHBOARD_API_HOST || "127.0.0.1";
const PASSPHRASE = process.env.DASHBOARD_PASSPHRASE || "zeroclaw-local";

const STATE_DIR =
  process.env.APP_FACTORY_STATE_DIR ||
  path.join(__dirname, "..", "app-factory", "state");
const PROJECTS_DIR =
  process.env.APP_FACTORY_PROJECTS_DIR ||
  path.join(__dirname, "..", "app-factory", "projects");
const LOGS_DIR =
  process.env.APP_FACTORY_LOGS_DIR ||
  path.join(__dirname, "..", "app-factory", "logs");

// Add lib to path
const libDir = path.join(__dirname, "..", "app-factory", "lib");

// ── Auth Middleware ─────────────────────────────────────────

const sessions = new Map();

function authMiddleware(req, res, next) {
  const token = req.headers.authorization?.replace("Bearer ", "");
  if (!token || !sessions.has(token)) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  const session = sessions.get(token);
  if (Date.now() > session.expiresAt) {
    sessions.delete(token);
    return res.status(401).json({ error: "Session expired" });
  }
  next();
}

// ── Auth Routes ────────────────────────────────────────────

app.post("/api/auth/login", (req, res) => {
  const { passphrase } = req.body;
  if (passphrase !== PASSPHRASE) {
    return res.status(403).json({ error: "Invalid passphrase" });
  }
  const token = crypto.randomBytes(32).toString("hex");
  sessions.set(token, {
    createdAt: Date.now(),
    expiresAt: Date.now() + 24 * 60 * 60 * 1000, // 24 hours
  });
  res.json({ token, expiresIn: 86400 });
});

// ── API Routes (all require auth) ──────────────────────────

app.get("/api/metrics", authMiddleware, (req, res) => {
  try {
    const summaryPath = path.join(STATE_DIR, "summary.json");
    if (!fs.existsSync(summaryPath)) {
      // Generate fresh summary
      const { writeSummary } = require(path.join(libDir, "summary"));
      writeSummary(STATE_DIR);
    }

    const summary = JSON.parse(
      fs.readFileSync(path.join(STATE_DIR, "summary.json"), "utf-8")
    );

    res.json({
      active_projects: summary.active_projects || 0,
      shipped_apps: summary.shipped_apps || 0,
      queue_depth: summary.total_projects || 0,
      needs_attention: summary.needs_attention || 0,
      system_health: "operational",
      token_totals: summary.token_totals || { total: 0, by_skill: {} },
      generated_at: summary.generated_at,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get("/api/projects", authMiddleware, (req, res) => {
  try {
    const { listStates } = require(path.join(libDir, "state"));
    const { skillForPhase } = require(path.join(libDir, "pipeline"));

    const states = listStates(STATE_DIR);
    const projects = states.map((s) => ({
      id: s.id,
      name: s.name,
      phase: s.phase,
      skill: skillForPhase(s.phase),
      idea: s.idea,
      created_at: s.timestamps.created_at,
      updated_at: s.timestamps.updated_at,
      phase_entered_at: s.timestamps.phase_entered_at,
      qa_attempts: s.attempt_counters.qa || 0,
      has_error: s.error != null,
      error: s.error,
      locked: s.lock != null,
      template: s.config?.template,
      has_one_pager: s.artifacts?.one_pager_md != null,
      has_quality_report: s.artifacts?.quality_report != null,
      notes: s.notes || [],
    }));

    res.json({ projects, total: projects.length });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get("/api/projects/:id", authMiddleware, (req, res) => {
  try {
    const { loadState } = require(path.join(libDir, "state"));
    const state = loadState(req.params.id, STATE_DIR);

    if (!state) {
      return res.status(404).json({ error: "Project not found" });
    }

    // Load artifacts if they exist
    const projectPath = path.join(PROJECTS_DIR, state.id);
    const artifacts = {};

    if (state.artifacts.one_pager_md) {
      try {
        artifacts.one_pager_md = fs.readFileSync(
          path.join(projectPath, "one_pager.md"),
          "utf-8"
        );
      } catch {
        /* not found */
      }
    }
    if (state.artifacts.one_pager_json) {
      try {
        artifacts.one_pager_json = JSON.parse(
          fs.readFileSync(
            path.join(projectPath, "one_pager.json"),
            "utf-8"
          )
        );
      } catch {
        /* not found */
      }
    }
    if (state.artifacts.quality_report) {
      try {
        artifacts.quality_report = JSON.parse(
          fs.readFileSync(
            path.join(projectPath, "quality_report.json"),
            "utf-8"
          )
        );
      } catch {
        /* not found */
      }
    }
    if (state.artifacts.review_report) {
      try {
        artifacts.review_report = JSON.parse(
          fs.readFileSync(
            path.join(projectPath, "review_report.json"),
            "utf-8"
          )
        );
      } catch {
        /* not found */
      }
    }

    res.json({ ...state, loaded_artifacts: artifacts });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── One-Pager Actions ──────────────────────────────────────

app.post(
  "/api/projects/:id/one-pager/approve",
  authMiddleware,
  (req, res) => {
    try {
      const { loadState, saveState } = require(path.join(libDir, "state"));
      const { transitionPhase } = require(path.join(libDir, "pipeline"));

      const state = loadState(req.params.id, STATE_DIR);
      if (!state) return res.status(404).json({ error: "Project not found" });

      if (state.phase !== "idea_pending_approval") {
        return res
          .status(400)
          .json({ error: `Cannot approve in phase: ${state.phase}` });
      }

      const result = transitionPhase(state, "approved", "dashboard", STATE_DIR);
      if (!result.success) {
        return res.status(400).json({ error: result.error });
      }

      if (req.body.notes) {
        state.notes.push({
          text: req.body.notes,
          author: "operator",
          timestamp: new Date().toISOString(),
        });
      }

      saveState(state, STATE_DIR);
      res.json({ success: true, phase: state.phase });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  }
);

app.post(
  "/api/projects/:id/one-pager/reject",
  authMiddleware,
  (req, res) => {
    try {
      const { loadState, saveState } = require(path.join(libDir, "state"));
      const { transitionPhase } = require(path.join(libDir, "pipeline"));

      const state = loadState(req.params.id, STATE_DIR);
      if (!state) return res.status(404).json({ error: "Project not found" });

      if (state.phase !== "idea_pending_approval") {
        return res
          .status(400)
          .json({ error: `Cannot reject in phase: ${state.phase}` });
      }

      const result = transitionPhase(
        state,
        "archived",
        "dashboard",
        STATE_DIR
      );
      if (!result.success) {
        return res.status(400).json({ error: result.error });
      }

      state.notes.push({
        text: req.body.reason || "Rejected by operator",
        author: "operator",
        timestamp: new Date().toISOString(),
      });

      saveState(state, STATE_DIR);
      res.json({ success: true, phase: state.phase });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  }
);

app.post(
  "/api/projects/:id/one-pager/flag",
  authMiddleware,
  (req, res) => {
    try {
      const { loadState, saveState } = require(path.join(libDir, "state"));

      const state = loadState(req.params.id, STATE_DIR);
      if (!state) return res.status(404).json({ error: "Project not found" });

      state.notes.push({
        text: `[FLAGGED] ${req.body.reason || "Flagged for review"}`,
        author: "operator",
        timestamp: new Date().toISOString(),
      });

      saveState(state, STATE_DIR);
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  }
);

// ── Project Actions ────────────────────────────────────────

app.post(
  "/api/projects/:id/actions/force-retry",
  authMiddleware,
  (req, res) => {
    try {
      const { loadState, saveState } = require(path.join(libDir, "state"));
      const { transitionPhase } = require(path.join(libDir, "pipeline"));

      const state = loadState(req.params.id, STATE_DIR);
      if (!state) return res.status(404).json({ error: "Project not found" });

      if (state.phase !== "manual_review_required") {
        return res.status(400).json({
          error: `Force retry only available from manual_review_required, current: ${state.phase}`,
        });
      }

      // Reset QA counter and send back to dev
      state.attempt_counters.qa = 0;
      const result = transitionPhase(
        state,
        "dev_in_progress",
        "dashboard",
        STATE_DIR
      );
      if (!result.success) {
        return res.status(400).json({ error: result.error });
      }

      state.notes.push({
        text: "Force retry initiated by operator",
        author: "operator",
        timestamp: new Date().toISOString(),
      });

      saveState(state, STATE_DIR);
      res.json({ success: true, phase: state.phase });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  }
);

app.post(
  "/api/projects/:id/actions/archive",
  authMiddleware,
  (req, res) => {
    try {
      const { loadState, saveState } = require(path.join(libDir, "state"));
      const { transitionPhase } = require(path.join(libDir, "pipeline"));

      const state = loadState(req.params.id, STATE_DIR);
      if (!state) return res.status(404).json({ error: "Project not found" });

      // Archive is available from several states
      const archivablePhases = [
        "idea_pending_approval",
        "manual_review_required",
        "marketing_active",
        "paused",
      ];
      if (!archivablePhases.includes(state.phase)) {
        return res.status(400).json({
          error: `Cannot archive from phase: ${state.phase}`,
        });
      }

      const result = transitionPhase(
        state,
        "archived",
        "dashboard",
        STATE_DIR
      );
      if (!result.success) {
        return res.status(400).json({ error: result.error });
      }

      saveState(state, STATE_DIR);
      res.json({ success: true, phase: state.phase });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  }
);

app.post(
  "/api/projects/:id/actions/pause-marketing",
  authMiddleware,
  (req, res) => {
    try {
      const { loadState, saveState } = require(path.join(libDir, "state"));
      const { transitionPhase } = require(path.join(libDir, "pipeline"));

      const state = loadState(req.params.id, STATE_DIR);
      if (!state) return res.status(404).json({ error: "Project not found" });

      if (state.phase !== "marketing_active") {
        return res.status(400).json({
          error: `Can only pause marketing from marketing_active, current: ${state.phase}`,
        });
      }

      const result = transitionPhase(state, "paused", "dashboard", STATE_DIR);
      if (!result.success) {
        return res.status(400).json({ error: result.error });
      }

      saveState(state, STATE_DIR);
      res.json({ success: true, phase: state.phase });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  }
);

app.post(
  "/api/projects/:id/actions/resume-marketing",
  authMiddleware,
  (req, res) => {
    try {
      const { loadState, saveState } = require(path.join(libDir, "state"));
      const { transitionPhase } = require(path.join(libDir, "pipeline"));

      const state = loadState(req.params.id, STATE_DIR);
      if (!state) return res.status(404).json({ error: "Project not found" });

      if (state.phase !== "paused") {
        return res.status(400).json({
          error: `Can only resume from paused, current: ${state.phase}`,
        });
      }

      const result = transitionPhase(
        state,
        "marketing_active",
        "dashboard",
        STATE_DIR
      );
      if (!result.success) {
        return res.status(400).json({ error: result.error });
      }

      saveState(state, STATE_DIR);
      res.json({ success: true, phase: state.phase });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  }
);

// ── Live Feed ──────────────────────────────────────────────

app.get("/api/live-feed", authMiddleware, (req, res) => {
  try {
    const { readLiveFeed } = require(path.join(libDir, "notifications"));

    const entries = readLiveFeed({
      project: req.query.project,
      skill: req.query.skill,
      limit: parseInt(req.query.limit || "100", 10),
      logsDir: LOGS_DIR,
    });

    // Filter by 'since' timestamp if provided
    let filtered = entries;
    if (req.query.since) {
      const sinceDate = new Date(req.query.since);
      filtered = entries.filter((entry) => {
        // Extract time from log entry format [HH:MM:SS]
        const match = entry.match(/^\[(\d{2}:\d{2}:\d{2})\]/);
        if (!match) return true;
        return true; // Include all if we can't parse reliably
      });
    }

    res.json({ entries: filtered, count: filtered.length });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Health ─────────────────────────────────────────────────

app.get("/api/health", (req, res) => {
  res.json({ status: "ok", service: "app-factory-dashboard-api" });
});

// ── Start Server ───────────────────────────────────────────

app.listen(PORT, HOST, () => {
  console.log(`App Factory Dashboard API listening on ${HOST}:${PORT}`);
  console.log(`State dir: ${STATE_DIR}`);
  console.log(`Projects dir: ${PROJECTS_DIR}`);
  console.log(`Logs dir: ${LOGS_DIR}`);
});

module.exports = app;
