#!/usr/bin/env node
/**
 * Research Scout — Idea discovery tool.
 *
 * Checks current idea queue depth and generates new idea state files
 * if below the target of 10. Uses pluggable providers in priority order:
 *   1. X API (X_BEARER_TOKEN env)
 *   2. Reddit API (REDDIT_CLIENT_ID + REDDIT_CLIENT_SECRET env)
 *   3. RSS fallback (Product Hunt, Hacker News, IndieHackers)
 *
 * Usage: node scout.js [--state-dir PATH] [--logs-dir PATH] [--target N]
 */

"use strict";

const path = require("path");
const https = require("https");
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
const logsDir = getArg(
  "logs-dir",
  path.join(__dirname, "..", "..", "..", "..", "app-factory", "logs")
);
const TARGET_DEPTH = parseInt(getArg("target", "10"), 10);

const {
  listStates,
  createProjectState,
  saveState,
  generateId,
} = require(path.join(libDir, "state"));
const { appendLiveFeed } = require(path.join(libDir, "notifications"));

// ── Provider helpers ─────────────────────────────────────────

/**
 * Fetch ideas from X API trending search.
 * @returns {Promise<object[]>} Array of raw idea candidates
 */
async function fetchFromX() {
  const token = process.env.X_BEARER_TOKEN;
  if (!token) return [];

  return new Promise((resolve) => {
    const query = encodeURIComponent(
      "(iOS app OR #buildinpublic OR #indiedev OR #appstore) -is:retweet lang:en"
    );
    const options = {
      hostname: "api.twitter.com",
      path: `/2/tweets/search/recent?query=${query}&max_results=20&tweet.fields=public_metrics,entities`,
      method: "GET",
      headers: { Authorization: `Bearer ${token}` },
      timeout: 15000,
    };

    const req = https.request(options, (res) => {
      let body = "";
      res.on("data", (chunk) => { body += chunk; });
      res.on("end", () => {
        try {
          const data = JSON.parse(body);
          const tweets = data.data || [];
          const ideas = tweets
            .filter((t) => (t.public_metrics?.like_count || 0) >= 10)
            .map((t) => ({
              name: extractAppName(t.text),
              idea: t.text.slice(0, 300),
              source: "x/trending",
              signal_strength: t.public_metrics?.like_count >= 100 ? "high" : "medium",
            }))
            .filter((i) => i.name);
          resolve(ideas);
        } catch {
          resolve([]);
        }
      });
    });

    req.on("error", () => resolve([]));
    req.on("timeout", () => { req.destroy(); resolve([]); });
    req.end();
  });
}

/**
 * Fetch ideas from Reddit API.
 * @returns {Promise<object[]>}
 */
async function fetchFromReddit() {
  const clientId = process.env.REDDIT_CLIENT_ID;
  const clientSecret = process.env.REDDIT_CLIENT_SECRET;
  if (!clientId || !clientSecret) return [];

  // Get OAuth token first
  const token = await getRedditToken(clientId, clientSecret);
  if (!token) return [];

  const subreddits = [
    "r/getdisciplined",
    "r/productivity",
    "r/apps",
    "r/startups",
    "r/SideProject",
  ];

  const ideas = [];
  for (const sub of subreddits) {
    const posts = await fetchRedditPosts(sub, token);
    ideas.push(...posts);
    if (ideas.length >= 20) break;
  }

  return ideas.slice(0, 20);
}

async function getRedditToken(clientId, clientSecret) {
  return new Promise((resolve) => {
    const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");
    const body = "grant_type=client_credentials";
    const options = {
      hostname: "www.reddit.com",
      path: "/api/v1/access_token",
      method: "POST",
      headers: {
        Authorization: `Basic ${credentials}`,
        "Content-Type": "application/x-www-form-urlencoded",
        "User-Agent": "ZeroClaw/1.0",
        "Content-Length": Buffer.byteLength(body),
      },
      timeout: 10000,
    };

    const req = https.request(options, (res) => {
      let data = "";
      res.on("data", (chunk) => { data += chunk; });
      res.on("end", () => {
        try {
          const parsed = JSON.parse(data);
          resolve(parsed.access_token || null);
        } catch {
          resolve(null);
        }
      });
    });

    req.on("error", () => resolve(null));
    req.on("timeout", () => { req.destroy(); resolve(null); });
    req.write(body);
    req.end();
  });
}

async function fetchRedditPosts(subreddit, token) {
  return new Promise((resolve) => {
    const sub = subreddit.replace("r/", "");
    const options = {
      hostname: "oauth.reddit.com",
      path: `/r/${sub}/hot.json?limit=10`,
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
        "User-Agent": "ZeroClaw/1.0",
      },
      timeout: 10000,
    };

    const req = https.request(options, (res) => {
      let data = "";
      res.on("data", (chunk) => { data += chunk; });
      res.on("end", () => {
        try {
          const parsed = JSON.parse(data);
          const posts = (parsed.data?.children || [])
            .filter((p) => p.data?.score >= 50 && !p.data?.is_self === false)
            .map((p) => ({
              name: extractAppName(p.data.title),
              idea: `${p.data.title}. ${(p.data.selftext || "").slice(0, 200)}`.trim(),
              source: `reddit/${subreddit}`,
              signal_strength: p.data.score >= 500 ? "high" : "medium",
            }))
            .filter((i) => i.name);
          resolve(posts);
        } catch {
          resolve([]);
        }
      });
    });

    req.on("error", () => resolve([]));
    req.on("timeout", () => { req.destroy(); resolve([]); });
    req.end();
  });
}

/**
 * Fetch ideas from RSS feeds (Product Hunt, Hacker News, IndieHackers).
 * @returns {Promise<object[]>}
 */
async function fetchFromRSS() {
  const feeds = [
    {
      hostname: "www.producthunt.com",
      path: "/feed",
      source: "rss/producthunt",
    },
    {
      hostname: "hnrss.org",
      path: "/show",
      source: "rss/hackernews-show",
    },
  ];

  const ideas = [];
  for (const feed of feeds) {
    const items = await fetchRSSFeed(feed);
    ideas.push(...items);
  }

  return ideas;
}

async function fetchRSSFeed({ hostname, path: feedPath, source }) {
  return new Promise((resolve) => {
    const options = {
      hostname,
      path: feedPath,
      method: "GET",
      headers: { "User-Agent": "ZeroClaw/1.0" },
      timeout: 10000,
    };

    const req = https.request(options, (res) => {
      let data = "";
      res.on("data", (chunk) => { data += chunk; });
      res.on("end", () => {
        try {
          // Simple RSS title extraction without xml parser dependency
          const titleMatches = [...data.matchAll(/<title><!\[CDATA\[(.*?)\]\]><\/title>|<title>(.*?)<\/title>/gs)];
          const ideas = titleMatches
            .slice(1, 11) // Skip channel title
            .map((m) => {
              const title = (m[1] || m[2] || "").trim();
              const name = extractAppName(title);
              if (!name) return null;
              return {
                name,
                idea: title.slice(0, 300),
                source,
                signal_strength: "low",
              };
            })
            .filter(Boolean);
          resolve(ideas);
        } catch {
          resolve([]);
        }
      });
    });

    req.on("error", () => resolve([]));
    req.on("timeout", () => { req.destroy(); resolve([]); });
    req.end();
  });
}

// ── Filtering helpers ─────────────────────────────────────────

/**
 * Extract a plausible iOS app name from text.
 * @param {string} text
 * @returns {string|null}
 */
function extractAppName(text) {
  if (!text) return null;

  // Remove URLs
  const clean = text.replace(/https?:\/\/\S+/g, "").trim();

  // Look for quoted names
  const quoted = clean.match(/["']([^"']{3,40})["']/);
  if (quoted) return quoted[1].trim();

  // Use first 5 words as name candidate
  const words = clean.split(/\s+/).slice(0, 5).join(" ");
  if (words.length >= 5 && words.length <= 60) return words;

  return null;
}

/**
 * Determine if an idea is iOS-viable.
 * @param {object} idea
 * @returns {boolean}
 */
function isIOSViable(idea) {
  const text = `${idea.name} ${idea.idea}`.toLowerCase();

  // Exclude non-iOS categories
  const exclusions = [
    "hardware", "iot device", "raspberry pi", "arduino",
    "enterprise saas", "b2b platform", "government", "medical device",
    "pure web service", "chrome extension", "browser plugin",
  ];
  if (exclusions.some((ex) => text.includes(ex))) return false;

  // Must have some iOS relevance or generic utility
  const iosSignals = [
    "app", "ios", "iphone", "ipad", "swift", "swiftui",
    "mobile", "productivity", "habit", "tracker", "reminder",
    "fitness", "finance", "budget", "journal", "meditation",
    "focus", "learning", "language", "recipe", "travel",
  ];

  return iosSignals.some((sig) => text.includes(sig));
}

/**
 * Check if an idea name is a duplicate of existing states.
 * @param {string} name
 * @param {object[]} existing
 * @returns {boolean}
 */
function isDuplicate(name, existing) {
  const normalize = (s) => s.toLowerCase().replace(/[^a-z0-9]/g, "");
  const normalized = normalize(name);

  return existing.some((s) => {
    const existingNorm = normalize(s.name || "");
    // Simple overlap check: if 70%+ of chars match
    const shorter = Math.min(normalized.length, existingNorm.length);
    if (shorter < 4) return false;
    return normalized.includes(existingNorm.slice(0, Math.max(4, shorter - 2))) ||
      existingNorm.includes(normalized.slice(0, Math.max(4, shorter - 2)));
  });
}

// ── Main ─────────────────────────────────────────────────────

async function scout() {
  const existing = listStates(stateDir);
  const pendingValidation = existing.filter(
    (s) => s.phase === "idea_pending_validation"
  );

  const currentDepth = pendingValidation.length;
  const needed = TARGET_DEPTH - currentDepth;

  if (needed <= 0) {
    const msg = `Queue at target (${currentDepth}/${TARGET_DEPTH}). No new ideas needed.`;
    appendLiveFeed("research-scout", "system", msg, logsDir);
    console.log(JSON.stringify({ action: "no_op", reason: msg, queue_depth: currentDepth }));
    return;
  }

  console.error(`Queue depth: ${currentDepth}/${TARGET_DEPTH}. Generating ${needed} ideas...`);

  // Gather candidates from all providers
  let candidates = [];

  const xIdeas = await fetchFromX();
  if (xIdeas.length > 0) {
    console.error(`X API: ${xIdeas.length} candidates`);
    candidates.push(...xIdeas);
  }

  if (candidates.length < needed * 2) {
    const redditIdeas = await fetchFromReddit();
    if (redditIdeas.length > 0) {
      console.error(`Reddit API: ${redditIdeas.length} candidates`);
      candidates.push(...redditIdeas);
    }
  }

  if (candidates.length < needed * 2) {
    const rssIdeas = await fetchFromRSS();
    if (rssIdeas.length > 0) {
      console.error(`RSS: ${rssIdeas.length} candidates`);
      candidates.push(...rssIdeas);
    }
  }

  // When all providers are unavailable, use fallback seed ideas
  if (candidates.length === 0) {
    console.error("All external providers unavailable. Using fallback seed ideas.");
    candidates = [
      { name: "Focus Timer Pro", idea: "Pomodoro timer with deep work analytics and habit streaks for iOS users.", source: "fallback/seed", signal_strength: "low" },
      { name: "Budget Buddy", idea: "Simple expense tracker with AI categorization and weekly spending insights.", source: "fallback/seed", signal_strength: "low" },
      { name: "Habit Stack", idea: "Visual habit stacking tool that links new habits to existing morning routines.", source: "fallback/seed", signal_strength: "low" },
      { name: "Sleep Score", idea: "Sleep quality tracker using iPhone motion sensors with personalized improvement tips.", source: "fallback/seed", signal_strength: "low" },
      { name: "Recipe Vault", idea: "Save, organize, and scale recipes with automatic grocery list generation.", source: "fallback/seed", signal_strength: "low" },
      { name: "Language Spark", idea: "Micro-lesson language learning with 5-minute daily sessions and spaced repetition.", source: "fallback/seed", signal_strength: "low" },
      { name: "Mood Journal", idea: "Daily mood check-ins with pattern visualization and AI-generated insights.", source: "fallback/seed", signal_strength: "low" },
      { name: "Net Worth Tracker", idea: "Simple net worth dashboard connecting bank, investment, and loan accounts.", source: "fallback/seed", signal_strength: "low" },
      { name: "Meal Planner", idea: "Weekly meal planning with nutrition goals, grocery lists, and recipe discovery.", source: "fallback/seed", signal_strength: "low" },
      { name: "Study Blocks", idea: "Study session planner with subject rotation, break reminders, and progress tracking.", source: "fallback/seed", signal_strength: "low" },
    ];
  }

  // Filter and deduplicate
  const filtered = candidates
    .filter((c) => isIOSViable(c))
    .filter((c) => !isDuplicate(c.name, existing));

  if (filtered.length === 0) {
    const msg = "No viable non-duplicate ideas found from any provider.";
    appendLiveFeed("research-scout", "system", msg, logsDir);
    console.log(JSON.stringify({ action: "no_op", reason: msg, queue_depth: currentDepth }));
    return;
  }

  // Take only what we need
  const toCreate = filtered.slice(0, needed);
  const created = [];

  for (const candidate of toCreate) {
    const id = generateId(candidate.name);
    const state = createProjectState({
      id,
      name: candidate.name,
      idea: candidate.idea,
      source: candidate.source,
    });

    state.notes.push(
      `Discovered via: ${candidate.source}`,
      `Signal strength: ${candidate.signal_strength || "unknown"}`
    );

    saveState(state, stateDir);
    appendLiveFeed(
      "research-scout",
      id,
      `Created idea: "${candidate.name}" [${candidate.source}] (${candidate.signal_strength})`,
      logsDir
    );

    created.push({ id, name: candidate.name, source: candidate.source });
    console.error(`Created: ${id} — ${candidate.name}`);
  }

  const result = {
    action: "ideas_created",
    created_count: created.length,
    new_queue_depth: currentDepth + created.length,
    target_depth: TARGET_DEPTH,
    ideas: created,
  };

  console.log(JSON.stringify(result, null, 2));
}

// Run if invoked directly
if (require.main === module) {
  scout().catch((err) => {
    console.error(`Scout failed: ${err.message}`);
    process.exit(1);
  });
}

module.exports = { scout };
