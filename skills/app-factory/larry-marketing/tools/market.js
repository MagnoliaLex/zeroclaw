#!/usr/bin/env node
/**
 * Larry Marketing Tool
 *
 * Manages social media marketing for App Factory apps.
 * Uses separate LARRY_* credential namespace.
 *
 * Usage: node market.js --project-id <id> [--action generate|post|track]
 */

const fs = require("fs");
const path = require("path");

const args = process.argv.slice(2);
function getArg(name, defaultVal) {
  const idx = args.indexOf(`--${name}`);
  return idx >= 0 && args[idx + 1] ? args[idx + 1] : defaultVal;
}

const projectId = getArg("project-id", null);
const action = getArg("action", "generate");
const libDir = path.join(__dirname, "..", "..", "..", "..", "app-factory", "lib");
const stateDir = getArg("state-dir", path.join(__dirname, "..", "..", "..", "..", "app-factory", "state"));
const projectsDir = getArg("projects-dir", path.join(__dirname, "..", "..", "..", "..", "app-factory", "projects"));

const { loadState, saveState } = require(path.join(libDir, "state"));
const { transitionPhase } = require(path.join(libDir, "pipeline"));
const { appendLiveFeed, notifySubmissionReady } = require(path.join(libDir, "notifications"));
const logsDir = path.join(stateDir, "..", "logs");

// Social media API wrappers (stub implementations)
const PLATFORMS = {
  x: {
    name: "X (Twitter)",
    hasCredentials: () => !!process.env.LARRY_X_API_KEY,
    post: async (content) => ({ success: true, post_id: `x_${Date.now()}`, url: `https://x.com/status/${Date.now()}` }),
  },
  reddit: {
    name: "Reddit",
    hasCredentials: () => !!process.env.LARRY_REDDIT_CLIENT_ID,
    post: async (content) => ({ success: true, post_id: `reddit_${Date.now()}`, url: `https://reddit.com/r/iOSProgramming/comments/${Date.now()}` }),
  },
  tiktok: {
    name: "TikTok",
    hasCredentials: () => !!process.env.LARRY_TIKTOK_ACCESS_TOKEN,
    post: async (content) => ({ success: true, post_id: `tiktok_${Date.now()}`, url: `https://tiktok.com/@user/video/${Date.now()}` }),
  },
  instagram: {
    name: "Instagram",
    hasCredentials: () => !!process.env.LARRY_INSTAGRAM_ACCESS_TOKEN,
    post: async (content) => ({ success: true, post_id: `ig_${Date.now()}`, url: `https://instagram.com/p/${Date.now()}` }),
  },
};

function generateContent(state, storeListing) {
  const appName = storeListing?.name || state.name;
  const description = storeListing?.description || state.idea;
  const subtitle = storeListing?.subtitle || "";

  return {
    x: {
      thread: [
        `Introducing ${appName} — ${subtitle}\n\n${description.slice(0, 200)}`,
        `Key features:\n${(storeListing?.features || []).slice(0, 3).map((f) => `- ${f}`).join("\n")}`,
        `Download now on the App Store!\n\n#iOS #app #${appName.replace(/\s+/g, "")}`,
      ],
    },
    reddit: {
      title: `[App] ${appName} — ${subtitle}`,
      body: `# ${appName}\n\n${description}\n\n## Features\n${(storeListing?.features || []).map((f) => `- ${f}`).join("\n")}\n\nAvailable on the App Store.`,
      subreddits: ["iOSProgramming", "AppHookup", "apple"],
    },
    tiktok: {
      caption: `${appName} is here! ${subtitle} #iOS #app #newapp #${appName.replace(/\s+/g, "")}`,
    },
    instagram: {
      caption: `${appName}\n\n${description.slice(0, 300)}\n\n#iOS #app #apple #newrelease #${appName.replace(/\s+/g, "")}`,
    },
  };
}

function loadMetrics(projectPath) {
  const metricsPath = path.join(projectPath, "submission_ready", "marketing", "metrics.json");
  try {
    return JSON.parse(fs.readFileSync(metricsPath, "utf-8"));
  } catch {
    return { posts: [], total_engagement: 0, last_updated: null };
  }
}

function saveMetrics(projectPath, metrics) {
  const dir = path.join(projectPath, "submission_ready", "marketing");
  fs.mkdirSync(dir, { recursive: true });
  metrics.last_updated = new Date().toISOString();
  fs.writeFileSync(path.join(dir, "metrics.json"), JSON.stringify(metrics, null, 2));
}

async function run() {
  if (!projectId) {
    console.error("Usage: node market.js --project-id <id> [--action generate|post|track]");
    process.exit(1);
  }

  const state = loadState(projectId, stateDir);
  if (!state) {
    console.error(`Project not found: ${projectId}`);
    process.exit(1);
  }

  const projectPath = path.join(projectsDir, projectId);

  // Load store listing if available
  let storeListing = null;
  try {
    storeListing = JSON.parse(fs.readFileSync(path.join(projectPath, "submission_ready", "store_listing.json"), "utf-8"));
  } catch { /* no listing */ }

  if (action === "generate") {
    appendLiveFeed("larry-marketing", projectId, "Generating marketing content", logsDir);
    const content = generateContent(state, storeListing);

    const contentDir = path.join(projectPath, "submission_ready", "marketing");
    fs.mkdirSync(contentDir, { recursive: true });
    fs.writeFileSync(path.join(contentDir, "content.json"), JSON.stringify(content, null, 2));

    // Write posting schedule
    const schedule = {
      generated_at: new Date().toISOString(),
      posts: [
        { platform: "x", type: "thread", scheduled_for: new Date(Date.now() + 3600000).toISOString(), status: "pending" },
        { platform: "reddit", type: "post", scheduled_for: new Date(Date.now() + 7200000).toISOString(), status: "pending" },
        { platform: "tiktok", type: "video_caption", scheduled_for: new Date(Date.now() + 14400000).toISOString(), status: "pending" },
        { platform: "instagram", type: "carousel", scheduled_for: new Date(Date.now() + 21600000).toISOString(), status: "pending" },
      ],
    };
    fs.writeFileSync(path.join(contentDir, "schedule.json"), JSON.stringify(schedule, null, 2));

    // Transition to marketing_active if at submission_ready
    if (state.phase === "submission_ready") {
      transitionPhase(state, "marketing_active", "larry-marketing", stateDir);
      saveState(state, stateDir);
    }

    appendLiveFeed("larry-marketing", projectId, "Marketing content generated, schedule created", logsDir);
    console.log(JSON.stringify({ status: "content_generated", platforms: Object.keys(content) }, null, 2));
  } else if (action === "post") {
    appendLiveFeed("larry-marketing", projectId, "Publishing scheduled posts", logsDir);
    const metrics = loadMetrics(projectPath);

    for (const [platform, api] of Object.entries(PLATFORMS)) {
      if (api.hasCredentials()) {
        try {
          const result = await api.post({});
          metrics.posts.push({
            platform,
            post_id: result.post_id,
            url: result.url,
            posted_at: new Date().toISOString(),
            engagement: { views: 0, likes: 0, shares: 0, clicks: 0 },
          });
          appendLiveFeed("larry-marketing", projectId, `Posted to ${api.name}`, logsDir);
        } catch (err) {
          appendLiveFeed("larry-marketing", projectId, `Failed to post to ${api.name}: ${err.message}`, logsDir);
        }
      }
    }

    saveMetrics(projectPath, metrics);
    console.log(JSON.stringify({ status: "posted", posts: metrics.posts.length }, null, 2));
  } else if (action === "track") {
    const metrics = loadMetrics(projectPath);
    // In production, this would fetch real engagement data from APIs
    metrics.total_engagement = metrics.posts.reduce(
      (sum, p) => sum + (p.engagement?.views || 0) + (p.engagement?.likes || 0),
      0
    );
    saveMetrics(projectPath, metrics);
    appendLiveFeed("larry-marketing", projectId, `Tracked engagement: ${metrics.total_engagement} total`, logsDir);
    console.log(JSON.stringify(metrics, null, 2));
  }
}

if (require.main === module) {
  run();
}
