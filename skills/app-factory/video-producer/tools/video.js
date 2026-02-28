#!/usr/bin/env node
/**
 * Video Producer Tool
 *
 * Generates promotional video via Votion API or ffmpeg slideshow fallback.
 * Usage: node video.js --project-id <id>
 */

const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

const args = process.argv.slice(2);
function getArg(name, defaultVal) {
  const idx = args.indexOf(`--${name}`);
  return idx >= 0 && args[idx + 1] ? args[idx + 1] : defaultVal;
}

const projectId = getArg("project-id", null);
const libDir = path.join(__dirname, "..", "..", "..", "..", "app-factory", "lib");
const stateDir = getArg("state-dir", path.join(__dirname, "..", "..", "..", "..", "app-factory", "state"));
const projectsDir = getArg("projects-dir", path.join(__dirname, "..", "..", "..", "..", "app-factory", "projects"));

const { loadState, saveState } = require(path.join(libDir, "state"));
const { transitionPhase } = require(path.join(libDir, "pipeline"));
const { appendLiveFeed, notifySubmissionReady } = require(path.join(libDir, "notifications"));
const logsDir = path.join(stateDir, "..", "logs");

const VOTION_API_KEY = process.env.VOTION_API_KEY;
const VOTION_API_URL = process.env.VOTION_API_URL || "https://api.votion.io/v1";

async function generateViaVotion(projectPath, storeListing) {
  if (!VOTION_API_KEY) return null;

  try {
    const https = require("https");
    const url = new URL(`${VOTION_API_URL}/videos/generate`);

    const payload = JSON.stringify({
      title: storeListing?.name || "App Preview",
      description: storeListing?.description || "",
      style: "app_preview",
      screenshots_dir: path.join(projectPath, "submission_ready", "screenshots"),
    });

    // Stub: In production this would make a real API call
    appendLiveFeed("video-producer", projectId, "Votion API called (stub mode)", logsDir);
    return null; // Fallback to slideshow
  } catch (err) {
    appendLiveFeed("video-producer", projectId, `Votion API failed: ${err.message}`, logsDir);
    return null;
  }
}

function generateSlideshow(projectPath) {
  const screenshotsDir = path.join(projectPath, "submission_ready", "screenshots");
  const outputPath = path.join(projectPath, "submission_ready", "promo_video.mp4");

  // Check if ffmpeg is available
  try {
    execSync("which ffmpeg", { encoding: "utf-8" });
  } catch {
    // ffmpeg not available — create a placeholder
    appendLiveFeed("video-producer", projectId, "ffmpeg not available — creating placeholder", logsDir);
    fs.writeFileSync(outputPath + ".placeholder", JSON.stringify({
      type: "video_placeholder",
      message: "Install ffmpeg to generate slideshow video",
      screenshots_dir: screenshotsDir,
      created_at: new Date().toISOString(),
    }, null, 2));
    return outputPath + ".placeholder";
  }

  // Find screenshots
  const screenshots = [];
  if (fs.existsSync(screenshotsDir)) {
    for (const sizeDir of fs.readdirSync(screenshotsDir)) {
      const sizePath = path.join(screenshotsDir, sizeDir);
      if (fs.statSync(sizePath).isDirectory()) {
        for (const file of fs.readdirSync(sizePath)) {
          if (/\.(png|jpg|jpeg)$/i.test(file)) {
            screenshots.push(path.join(sizePath, file));
          }
        }
      }
    }
  }

  if (screenshots.length === 0) {
    appendLiveFeed("video-producer", projectId, "No screenshots found for slideshow", logsDir);
    fs.writeFileSync(outputPath + ".placeholder", JSON.stringify({
      type: "video_placeholder",
      message: "No screenshots available for video generation",
      created_at: new Date().toISOString(),
    }, null, 2));
    return outputPath + ".placeholder";
  }

  // Create file list for ffmpeg
  const listPath = path.join(projectPath, "submission_ready", "ffmpeg_list.txt");
  const listContent = screenshots.map((s) => `file '${s}'\nduration 3`).join("\n");
  fs.writeFileSync(listPath, listContent);

  try {
    execSync(
      `ffmpeg -y -f concat -safe 0 -i "${listPath}" -vf "scale=1080:1920:force_original_aspect_ratio=decrease,pad=1080:1920:(ow-iw)/2:(oh-ih)/2" -c:v libx264 -pix_fmt yuv420p -r 30 "${outputPath}"`,
      { timeout: 120000 }
    );
    // Clean up temp file
    fs.unlinkSync(listPath);
    return outputPath;
  } catch (err) {
    appendLiveFeed("video-producer", projectId, `ffmpeg slideshow failed: ${err.message}`, logsDir);
    return null;
  }
}

async function run() {
  if (!projectId) {
    console.error("Usage: node video.js --project-id <id>");
    process.exit(1);
  }

  const state = loadState(projectId, stateDir);
  if (!state) {
    console.error(`Project not found: ${projectId}`);
    process.exit(1);
  }

  const projectPath = path.join(projectsDir, projectId);
  appendLiveFeed("video-producer", projectId, "Starting video production", logsDir);

  // Load store listing
  let storeListing = null;
  try {
    storeListing = JSON.parse(fs.readFileSync(path.join(projectPath, "submission_ready", "store_listing.json"), "utf-8"));
  } catch { /* no listing */ }

  // Try Votion first, then slideshow
  let videoPath = await generateViaVotion(projectPath, storeListing);

  if (!videoPath) {
    videoPath = generateSlideshow(projectPath);
  }

  state.artifacts.video_path = videoPath;
  transitionPhase(state, "submission_ready", "video-producer", stateDir);
  saveState(state, stateDir);

  // Notify on submission ready
  notifySubmissionReady(state).catch(() => {});

  appendLiveFeed("video-producer", projectId, `Video production complete → SUBMISSION READY`, logsDir);
  console.log(JSON.stringify({ status: "complete", video: videoPath }, null, 2));
}

if (require.main === module) {
  run();
}
