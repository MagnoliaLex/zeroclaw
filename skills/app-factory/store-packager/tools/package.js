#!/usr/bin/env node
/**
 * Store Packager — Generates App Store submission package.
 *
 * Reads the project one-pager and source files, produces:
 *   - submission_ready/store_listing.json
 *   - submission_ready/store_listing.md
 *   - submission_ready/privacy_policy.html
 * Then updates the project state to phase "screenshots".
 *
 * Usage: node package.js [--project-id ID] [--state-dir PATH] [--projects-dir PATH] [--logs-dir PATH]
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

const { loadState, saveState, listStates } = require(path.join(libDir, "state"));
const { appendLiveFeed } = require(path.join(libDir, "notifications"));

// ── App Store copy generators ────────────────────────────────

/**
 * Extract key features from one-pager markdown text.
 * @param {string} text
 * @returns {string[]}
 */
function extractFeatures(text) {
  const features = [];
  const lines = text.split("\n");

  for (const line of lines) {
    const trimmed = line.trim();
    // Bullet points and numbered lists
    if (/^[-*•]\s+.{10,}/.test(trimmed) || /^\d+\.\s+.{10,}/.test(trimmed)) {
      const content = trimmed.replace(/^[-*•\d.]\s+/, "").trim();
      if (content.length > 10 && content.length < 200) {
        features.push(content);
      }
    }
  }

  return features.slice(0, 10);
}

/**
 * Extract app category hint from text.
 * @param {string} text
 * @returns {string}
 */
function inferCategory(text) {
  const lower = text.toLowerCase();
  const categoryMap = [
    { keywords: ["finance", "budget", "money", "expense", "investment", "bank"], category: "Finance" },
    { keywords: ["health", "fitness", "workout", "exercise", "calories", "steps"], category: "Health & Fitness" },
    { keywords: ["productivity", "task", "todo", "focus", "timer", "pomodoro", "habit"], category: "Productivity" },
    { keywords: ["education", "learn", "study", "language", "flashcard", "quiz"], category: "Education" },
    { keywords: ["food", "recipe", "cook", "meal", "nutrition", "diet"], category: "Food & Drink" },
    { keywords: ["travel", "trip", "flight", "hotel", "map", "navigation"], category: "Travel" },
    { keywords: ["music", "audio", "sound", "playlist", "podcast"], category: "Music" },
    { keywords: ["photo", "video", "camera", "edit", "filter", "image"], category: "Photo & Video" },
    { keywords: ["game", "puzzle", "arcade", "score", "level"], category: "Games" },
    { keywords: ["news", "article", "read", "feed", "magazine"], category: "News" },
    { keywords: ["social", "chat", "message", "community", "share"], category: "Social Networking" },
    { keywords: ["weather", "forecast", "temperature", "rain"], category: "Weather" },
    { keywords: ["business", "crm", "invoice", "client", "project management"], category: "Business" },
    { keywords: ["utility", "tool", "calculator", "converter", "cleaner"], category: "Utilities" },
    { keywords: ["meditation", "mindfulness", "sleep", "relax", "calm"], category: "Health & Fitness" },
    { keywords: ["journal", "diary", "mood", "note", "writing"], category: "Lifestyle" },
  ];

  for (const { keywords, category } of categoryMap) {
    if (keywords.some((kw) => lower.includes(kw))) {
      return category;
    }
  }

  return "Productivity";
}

/**
 * Generate store name (30 char max) from app name.
 * @param {string} name
 * @returns {string}
 */
function truncateName(name) {
  return name.length <= 30 ? name : name.slice(0, 27) + "...";
}

/**
 * Generate a subtitle from the app idea (30 char max).
 * @param {string} idea
 * @param {string} name
 * @returns {string}
 */
function generateSubtitle(idea, name) {
  // Try to extract a short benefit phrase
  const sentences = idea.split(/[.!?]/);
  const first = sentences[0] || "";

  // Remove app name from phrase to avoid repetition
  const withoutName = first.replace(new RegExp(name, "gi"), "").trim();

  // Trim to 30 chars at word boundary
  if (withoutName.length <= 30) return withoutName;
  const words = withoutName.split(" ");
  let result = "";
  for (const word of words) {
    if ((result + " " + word).trim().length > 30) break;
    result = (result + " " + word).trim();
  }
  return result || withoutName.slice(0, 30);
}

/**
 * Generate keywords string (100 chars max, comma-separated).
 * @param {string} text — combined one-pager + idea text
 * @param {string} appName — to exclude from keywords
 * @returns {string}
 */
function generateKeywords(text, appName) {
  const lower = text.toLowerCase();
  const nameWords = appName.toLowerCase().split(/\s+/);

  // Common iOS app keyword candidates by domain
  const candidates = [
    "tracker", "planner", "organizer", "journal", "habit", "routine",
    "daily", "weekly", "schedule", "reminder", "focus", "productivity",
    "simple", "easy", "fast", "free", "minimal", "smart", "auto",
    "budget", "finance", "expense", "savings", "health", "fitness",
    "workout", "nutrition", "sleep", "meditation", "mindfulness",
    "recipes", "meal", "food", "travel", "notes", "tasks", "goals",
  ];

  const selected = candidates
    .filter((kw) => !nameWords.includes(kw)) // Exclude name words
    .filter((kw) => lower.includes(kw))       // Only relevant terms
    .slice(0, 20);

  // Build keyword string within 100 char limit
  let result = "";
  for (const kw of selected) {
    const candidate = result ? `${result},${kw}` : kw;
    if (candidate.length > 100) break;
    result = candidate;
  }

  return result;
}

/**
 * Generate full App Store description (up to 4000 chars).
 * @param {object} params
 * @returns {string}
 */
function generateDescription({ name, idea, features }) {
  const featureBullets = features
    .slice(0, 6)
    .map((f) => `• ${f}`)
    .join("\n");

  const description = [
    `${idea}`,
    "",
    `${name} helps you get more done with less effort. Whether you're a busy professional or just getting started, the app adapts to your needs from day one.`,
    "",
    "Key features:",
    featureBullets || `• Intuitive, clutter-free interface\n• Offline-first — works without internet\n• Privacy-focused — your data stays on your device`,
    "",
    "Thousands of users rely on apps like this every day to stay organized, focused, and in control. Join a growing community of people who take their goals seriously.",
    "",
    "Download now and start today.",
  ].join("\n");

  // Enforce 4000 char limit
  return description.length <= 4000 ? description : description.slice(0, 3997) + "...";
}

/**
 * Generate privacy policy HTML.
 * @param {object} params
 * @returns {string}
 */
function generatePrivacyPolicy({ name, projectId, features, category }) {
  const today = new Date().toISOString().split("T")[0];
  const collectsUserData = features.some((f) =>
    /account|login|sync|cloud|profile|social|share/i.test(f)
  );
  const collectsHealthData = /Health & Fitness|Food/i.test(category) ||
    features.some((f) => /health|fitness|workout|sleep|heart|step/i.test(f));

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Privacy Policy — ${name}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 800px; margin: 0 auto; padding: 2rem; line-height: 1.7; color: #1a1a1a; }
    h1 { font-size: 2rem; margin-bottom: 0.5rem; }
    h2 { font-size: 1.25rem; margin-top: 2rem; border-bottom: 1px solid #e5e5e5; padding-bottom: 0.25rem; }
    p, li { font-size: 1rem; }
    ul { padding-left: 1.5rem; }
    .updated { color: #666; font-size: 0.9rem; margin-bottom: 2rem; }
    a { color: #007aff; }
  </style>
</head>
<body>
  <h1>Privacy Policy</h1>
  <p class="updated">Last updated: ${today}</p>

  <p>This Privacy Policy describes how ${name} ("we", "our", or "the app") handles your information. We are committed to protecting your privacy.</p>

  <h2>1. Information We Collect</h2>
  ${collectsUserData ? `
  <p>When you use ${name}, we may collect:</p>
  <ul>
    <li><strong>Account information</strong>: email address and username if you create an account.</li>
    <li><strong>Usage data</strong>: how you interact with app features to improve the experience.</li>
    <li><strong>Device information</strong>: device model, OS version, and app version for diagnostics.</li>
  </ul>
  ` : `
  <p>${name} is designed to work entirely on your device. We do not collect personal information. All data you enter stays on your device and is not transmitted to our servers.</p>
  `}
  ${collectsHealthData ? `
  <p><strong>Health and fitness data</strong>: If you grant permission, ${name} may access health data from Apple Health. This data is used only to provide features within the app and is never shared with third parties or uploaded to any server.</p>
  ` : ""}

  <h2>2. How We Use Information</h2>
  <ul>
    <li>To provide and improve app functionality.</li>
    <li>To respond to support requests.</li>
    ${collectsUserData ? "<li>To sync your data across your devices (if account-based sync is used).</li>" : ""}
    <li>To diagnose crashes and fix bugs.</li>
  </ul>
  <p>We do not sell, rent, or share your personal information with advertisers or unrelated third parties.</p>

  <h2>3. Data Storage and Retention</h2>
  ${collectsUserData ? `
  <p>Data associated with your account is stored on secure servers and retained while your account is active. You may request deletion at any time (see Section 5).</p>
  ` : `
  <p>All app data is stored locally on your device. We do not operate servers that store your personal data. Uninstalling the app removes all local data.</p>
  `}

  <h2>4. Third-Party Services</h2>
  <p>The app may use Apple's frameworks (StoreKit, CloudKit, HealthKit as applicable) subject to <a href="https://www.apple.com/legal/privacy/">Apple's Privacy Policy</a>. We do not integrate third-party advertising SDKs.</p>

  <h2>5. Your Rights</h2>
  <p>You have the right to:</p>
  <ul>
    <li><strong>Access</strong> any personal data we hold about you.</li>
    <li><strong>Delete</strong> your data by contacting us or uninstalling the app.</li>
    <li><strong>Correct</strong> inaccurate data.</li>
    <li><strong>Port</strong> your data in a machine-readable format upon request.</li>
  </ul>

  <h2>6. Children's Privacy</h2>
  <p>${name} is not directed at children under 13. We do not knowingly collect personal information from children. If you believe a child has provided us personal data, contact us immediately.</p>

  <h2>7. Changes to This Policy</h2>
  <p>We may update this Privacy Policy periodically. We will notify you of significant changes through the app or by updating the "Last updated" date above. Continued use after changes constitutes acceptance.</p>

  <h2>8. Contact</h2>
  <p>For privacy questions or requests, contact us at: <a href="mailto:privacy@zeroclaw.app">privacy@zeroclaw.app</a></p>
  <p>Privacy policy URL: <a href="https://zeroclaw.app/privacy/${projectId}">https://zeroclaw.app/privacy/${projectId}</a></p>
</body>
</html>`;
}

// ── Main ─────────────────────────────────────────────────────

function run() {
  // Find the target project
  let state;
  if (projectId) {
    state = loadState(projectId, stateDir);
    if (!state) {
      console.error(`Project not found: ${projectId}`);
      process.exit(1);
    }
  } else {
    // Auto-find oldest project in store_listing phase
    const all = listStates(stateDir);
    const candidates = all
      .filter((s) => s.phase === "store_listing")
      .sort((a, b) => new Date(a.timestamps.phase_entered_at) - new Date(b.timestamps.phase_entered_at));
    if (candidates.length === 0) {
      console.log(JSON.stringify({ action: "no_op", reason: "No projects in store_listing phase" }));
      return;
    }
    state = candidates[0];
  }

  const projectDir = path.join(projectsDir, state.id);
  const submissionDir = path.join(projectDir, "submission_ready");

  // Read one-pager
  const onePagerPath = state.artifacts && state.artifacts.one_pager_md
    ? path.resolve(projectsDir, "..", state.artifacts.one_pager_md)
    : path.join(projectDir, "one_pager.md");

  let onePagerText = "";
  if (fs.existsSync(onePagerPath)) {
    onePagerText = fs.readFileSync(onePagerPath, "utf-8");
  } else {
    // Try fallback paths
    const fallbacks = [
      path.join(projectDir, "one_pager.md"),
      path.join(projectDir, "ONE_PAGER.md"),
      path.join(projectDir, "docs", "one_pager.md"),
    ];
    for (const fp of fallbacks) {
      if (fs.existsSync(fp)) {
        onePagerText = fs.readFileSync(fp, "utf-8");
        break;
      }
    }
  }

  if (!onePagerText) {
    console.error(`One-pager not found for project: ${state.id}`);
    state.phase = "manual_review_required";
    state.error = "store-packager: one_pager.md not found; cannot generate store listing";
    state.timestamps.updated_at = new Date().toISOString();
    saveState(state, stateDir);
    appendLiveFeed("store-packager", state.id, `ERROR: one_pager.md missing for "${state.name}"`, logsDir);
    console.log(JSON.stringify({ action: "error", reason: "one_pager.md not found", project_id: state.id }));
    return;
  }

  // Derive listing content
  const appName = state.name || "App";
  const idea = state.idea || "";
  const combined = `${idea}\n${onePagerText}`;

  const features = extractFeatures(onePagerText);
  const category = inferCategory(combined);
  const name = truncateName(appName);
  const subtitle = generateSubtitle(idea, appName);
  const description = generateDescription({ name: appName, idea, features });
  const keywords = generateKeywords(combined, appName);
  const privacyUrl = `https://zeroclaw.app/privacy/${state.id}`;
  const now = new Date().toISOString();

  // Build outputs
  const storeListing = {
    name,
    subtitle,
    description,
    keywords,
    category,
    privacy_policy_url: privacyUrl,
    age_rating: "4+",
    support_url: `https://zeroclaw.app/support/${state.id}`,
    marketing_url: `https://zeroclaw.app/${state.id}`,
    generated_at: now,
  };

  const storeListingMd = [
    `# ${name} — App Store Listing`,
    "",
    `**Subtitle:** ${subtitle}`,
    "",
    `**Category:** ${category}`,
    "",
    `**Age Rating:** 4+`,
    "",
    "## Description",
    "",
    description,
    "",
    `## Keywords`,
    "",
    `\`${keywords}\``,
    "",
    "## URLs",
    "",
    `- Privacy Policy: ${privacyUrl}`,
    `- Support: https://zeroclaw.app/support/${state.id}`,
    `- Marketing: https://zeroclaw.app/${state.id}`,
    "",
    `_Generated: ${now}_`,
  ].join("\n");

  const privacyHtml = generatePrivacyPolicy({
    name: appName,
    projectId: state.id,
    features,
    category,
  });

  // Write outputs
  fs.mkdirSync(submissionDir, { recursive: true });

  fs.writeFileSync(
    path.join(submissionDir, "store_listing.json"),
    JSON.stringify(storeListing, null, 2),
    "utf-8"
  );
  fs.writeFileSync(
    path.join(submissionDir, "store_listing.md"),
    storeListingMd,
    "utf-8"
  );
  fs.writeFileSync(
    path.join(submissionDir, "privacy_policy.html"),
    privacyHtml,
    "utf-8"
  );

  // Update state
  state.phase = "screenshots";
  state.artifacts = state.artifacts || {};
  state.artifacts.store_listing_json = `projects/${state.id}/submission_ready/store_listing.json`;
  state.artifacts.store_listing_md = `projects/${state.id}/submission_ready/store_listing.md`;
  state.artifacts.privacy_policy_html = `projects/${state.id}/submission_ready/privacy_policy.html`;
  state.timestamps.updated_at = now;
  state.timestamps.phase_entered_at = now;
  saveState(state, stateDir);

  appendLiveFeed(
    "store-packager",
    state.id,
    `Store listing generated for "${appName}" → category: ${category}, keywords: ${keywords.split(",").length} terms. Phase → screenshots.`,
    logsDir
  );

  const result = {
    action: "store_listing_generated",
    project_id: state.id,
    project_name: appName,
    outputs: {
      store_listing_json: `projects/${state.id}/submission_ready/store_listing.json`,
      store_listing_md: `projects/${state.id}/submission_ready/store_listing.md`,
      privacy_policy_html: `projects/${state.id}/submission_ready/privacy_policy.html`,
    },
    listing: { name, subtitle, category, keyword_count: keywords.split(",").length },
    next_phase: "screenshots",
  };

  console.log(JSON.stringify(result, null, 2));
}

// Run if invoked directly
if (require.main === module) {
  run();
}

module.exports = { run };
