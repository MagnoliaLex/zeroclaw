#!/usr/bin/env node
/**
 * Validation Analyst — Idea validation tool.
 *
 * Reads a project state file, generates a structured one-pager
 * (one_pager.md + one_pager.json), and transitions the project phase.
 *
 * Usage: node validate.js --project-id <id> [--state-dir PATH] [--projects-dir PATH] [--logs-dir PATH]
 */

"use strict";

const path = require("path");
const fs = require("fs");
const args = process.argv.slice(2);

function getArg(name, defaultVal) {
  const idx = args.indexOf(`--${name}`);
  return idx >= 0 && args[idx + 1] ? args[idx + 1] : defaultVal;
}

const libDir = path.join(__dirname, "..", "..", "..", "..", "app-factory", "lib");

const stateDir = getArg(
  "state-dir",
  path.join(__dirname, "..", "..", "..", "..", "app-factory", "state")
);
const projectsDir = getArg(
  "projects-dir",
  path.join(__dirname, "..", "..", "..", "..", "app-factory", "projects")
);
const logsDir = getArg(
  "logs-dir",
  path.join(__dirname, "..", "..", "..", "..", "app-factory", "logs")
);
const projectId = getArg("project-id", null);

const {
  loadState,
  saveState,
  ensureProjectDir,
  acquireLease,
  releaseLease,
} = require(path.join(libDir, "state"));
const { transitionPhase } = require(path.join(libDir, "pipeline"));
const { appendLiveFeed } = require(path.join(libDir, "notifications"));

// ── One-pager generation ──────────────────────────────────────

/**
 * Build a one-pager JSON from project state.
 * This is a structured template — the LLM skill prompt drives actual content.
 * When run standalone (not via LLM), generates a structured placeholder.
 * @param {object} state
 * @returns {object}
 */
function buildOnePagerJson(state) {
  const now = new Date().toISOString();

  return {
    id: state.id,
    name: state.name,
    idea: state.idea,
    summary: `${state.name} addresses the need described in the original idea. Full validation requires LLM-driven analysis.`,
    persona: {
      demographics: "iOS users aged 18-45 seeking productivity improvements",
      pain_points: ["Manual process friction", "Lack of centralized solution"],
      motivation: "Save time and build better habits",
    },
    features: [
      {
        name: "Core Dashboard",
        description: "Main interaction surface for the primary use case",
        priority: "must-have",
        keywords: ["dashboard", "home", "main"],
      },
      {
        name: "Onboarding Flow",
        description: "Guided setup to personalize the experience",
        priority: "must-have",
        keywords: ["onboard", "setup", "welcome"],
      },
      {
        name: "Settings & Profile",
        description: "User preferences, notifications, and account management",
        priority: "must-have",
        keywords: ["settings", "profile", "preferences"],
      },
      {
        name: "Progress Tracking",
        description: "Visualize user progress and key metrics over time",
        priority: "nice-to-have",
        keywords: ["progress", "chart", "analytics", "stats"],
      },
      {
        name: "Paywall / Upgrade",
        description: "StoreKit2 paywall to unlock premium features",
        priority: "must-have",
        keywords: ["paywall", "premium", "subscribe", "upgrade"],
      },
    ],
    competition: {
      top_competitors: [],
      saturation: "medium",
      competition_score: 0.5,
      differentiation_angle: "Pending competitive research via LLM skill",
    },
    monetization: {
      model: "freemium",
      free_tier: "Core features with usage limits",
      paid_tier: "Unlimited usage, advanced features, and sync",
      price_point: "$4.99/month or $39.99/year",
      ltv_estimate: "$60",
    },
    feasibility: {
      complexity: "medium",
      estimated_dev_weeks: 6,
      required_permissions: ["notifications"],
      template_suggestion: "productivity-base",
    },
    risks: [
      "Market saturation in target category",
      "User acquisition cost may exceed LTV at launch",
    ],
    success_metrics: {
      dau_target: 500,
      d7_retention_target: 0.3,
      revenue_target_monthly: 2500,
    },
    sources: [],
    validated_at: now,
  };
}

/**
 * Render a one-pager markdown document from the JSON structure.
 * @param {object} doc
 * @returns {string}
 */
function renderOnePagerMarkdown(doc) {
  const features = (doc.features || [])
    .map(
      (f) =>
        `- **${f.name}** *(${f.priority})*: ${f.description}`
    )
    .join("\n");

  const competitors = (doc.competition?.top_competitors || [])
    .map(
      (c) =>
        `- **${c.name}** (${c.app_store_rating || "?"}★): ${c.differentiator || "No differentiation noted"}`
    )
    .join("\n") || "_No competitors identified yet — requires LLM analysis._";

  const risks = (doc.risks || []).map((r) => `- ${r}`).join("\n");

  return `# ${doc.name} — Validation One-Pager

**Project ID:** ${doc.id}
**Validated:** ${doc.validated_at}

---

## Summary

${doc.summary}

---

## Target User Persona

**Demographics:** ${doc.persona?.demographics || "TBD"}

**Pain Points:**
${(doc.persona?.pain_points || []).map((p) => `- ${p}`).join("\n")}

**Motivation:** ${doc.persona?.motivation || "TBD"}

---

## Core Features

${features || "_Feature list pending LLM analysis._"}

---

## Competitive Analysis

**Category Saturation:** ${doc.competition?.saturation || "unknown"}
**Competition Score:** ${doc.competition?.competition_score ?? "?"} / 1.0

**Top Competitors:**
${competitors}

**Differentiation Angle:** ${doc.competition?.differentiation_angle || "TBD"}

---

## Monetization

**Model:** ${doc.monetization?.model || "TBD"}
**Free Tier:** ${doc.monetization?.free_tier || "TBD"}
**Paid Tier:** ${doc.monetization?.paid_tier || "TBD"}
**Price Point:** ${doc.monetization?.price_point || "TBD"}
**LTV Estimate:** ${doc.monetization?.ltv_estimate || "TBD"}

---

## Feasibility

**Complexity:** ${doc.feasibility?.complexity || "unknown"}
**Estimated Dev Time:** ${doc.feasibility?.estimated_dev_weeks || "?"} weeks
**Suggested Template:** \`${doc.feasibility?.template_suggestion || "tbd"}\`
**Required Permissions:** ${(doc.feasibility?.required_permissions || []).join(", ") || "none"}

---

## Risk Factors

${risks || "_No risks identified._"}

---

## Success Metrics

| Metric | Target |
|--------|--------|
| Daily Active Users | ${doc.success_metrics?.dau_target?.toLocaleString() || "?"} |
| D7 Retention | ${doc.success_metrics?.d7_retention_target ? `${(doc.success_metrics.d7_retention_target * 100).toFixed(0)}%` : "?"} |
| Monthly Revenue | $${doc.success_metrics?.revenue_target_monthly?.toLocaleString() || "?"} |

---

## Sources

${(doc.sources || []).map((s) => `- ${s}`).join("\n") || "_No sources cited._"}
`;
}

// ── Main ─────────────────────────────────────────────────────

function validate() {
  if (!projectId) {
    console.error("Error: --project-id is required");
    process.exit(1);
  }

  const state = loadState(projectId, stateDir);
  if (!state) {
    console.error(`Error: Project state not found for ID: ${projectId}`);
    process.exit(1);
  }

  if (state.phase !== "idea_pending_validation") {
    console.error(
      `Error: Expected phase 'idea_pending_validation', got '${state.phase}'`
    );
    process.exit(1);
  }

  // Acquire lease
  const leaseAcquired = acquireLease(projectId, "validation-analyst", stateDir);
  if (!leaseAcquired) {
    console.error(`Error: Could not acquire lease for project ${projectId}`);
    process.exit(1);
  }

  try {
    // Ensure project directory
    const projDir = path.join(projectsDir, projectId);
    fs.mkdirSync(projDir, { recursive: true });

    // Generate one-pager structure
    const onePagerJson = buildOnePagerJson(state);
    const onePagerMd = renderOnePagerMarkdown(onePagerJson);

    // Write artifacts
    const jsonPath = path.join(projDir, "one_pager.json");
    const mdPath = path.join(projDir, "one_pager.md");

    fs.writeFileSync(jsonPath, JSON.stringify(onePagerJson, null, 2), "utf-8");
    fs.writeFileSync(mdPath, onePagerMd, "utf-8");

    // Update state artifacts
    state.artifacts.one_pager_json = jsonPath;
    state.artifacts.one_pager_md = mdPath;

    // Determine next phase
    const dashboardGating = process.env.DASHBOARD_APPROVAL_REQUIRED === "true";
    const nextPhase = dashboardGating ? "idea_pending_approval" : "validated";

    const transition = transitionPhase(state, nextPhase, "validation-analyst", stateDir);
    if (!transition.success) {
      throw new Error(`Phase transition failed: ${transition.error}`);
    }

    // Add note
    state.notes.push(
      `Validated at: ${onePagerJson.validated_at}`,
      `Competition score: ${onePagerJson.competition.competition_score}`,
      `Routed to: ${nextPhase}`
    );

    saveState(state, stateDir);

    appendLiveFeed(
      "validation-analyst",
      projectId,
      `One-pager generated for "${state.name}". Phase → ${nextPhase}. Competition: ${onePagerJson.competition.competition_score}`,
      logsDir
    );

    const result = {
      action: "validated",
      project_id: projectId,
      project_name: state.name,
      next_phase: nextPhase,
      one_pager_md: mdPath,
      one_pager_json: jsonPath,
      competition_score: onePagerJson.competition.competition_score,
    };

    console.log(JSON.stringify(result, null, 2));
  } finally {
    releaseLease(projectId, "validation-analyst", stateDir);
  }
}

// Run if invoked directly
if (require.main === module) {
  validate();
}

module.exports = { validate, buildOnePagerJson, renderOnePagerMarkdown };
