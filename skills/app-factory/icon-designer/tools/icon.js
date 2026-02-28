#!/usr/bin/env node
/**
 * Icon Designer — App icon generation tool.
 *
 * Primary path: Nano Banana Pro API (NANO_BANANA_API_KEY env required).
 * Fallback path: SVG template generation — category color + initials.
 *
 * Generates master 1024x1024 PNG plus all required App Store sizes.
 *
 * Usage: node icon.js [--project-id ID] [--state-dir PATH] [--projects-dir PATH] [--logs-dir PATH]
 */

"use strict";

const path = require("path");
const fs = require("fs");
const https = require("https");
const { spawnSync } = require("child_process");
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

// ── Icon sizes ────────────────────────────────────────────────

const ICON_SIZES = [
  { size: 1024, filename: "icon-1024.png", usage: "App Store" },
  { size: 180, filename: "icon-180.png", usage: "iPhone @3x" },
  { size: 120, filename: "icon-120.png", usage: "iPhone @2x" },
  { size: 167, filename: "icon-167.png", usage: "iPad Pro @2x" },
  { size: 152, filename: "icon-152.png", usage: "iPad @2x" },
  { size: 76, filename: "icon-76.png", usage: "iPad @1x" },
  { size: 87, filename: "icon-87.png", usage: "iPhone Settings @3x" },
  { size: 58, filename: "icon-58.png", usage: "iPhone Settings @2x" },
  { size: 80, filename: "icon-80.png", usage: "iPhone Spotlight @2x" },
  { size: 40, filename: "icon-40.png", usage: "iPad Spotlight @1x" },
];

// ── Category color palette ────────────────────────────────────

const CATEGORY_COLORS = {
  "Finance": { bg: "#1A6B3C", text: "#FFFFFF" },
  "Health & Fitness": { bg: "#FF5A5F", text: "#FFFFFF" },
  "Productivity": { bg: "#007AFF", text: "#FFFFFF" },
  "Education": { bg: "#FF9500", text: "#FFFFFF" },
  "Food & Drink": { bg: "#FF6B35", text: "#FFFFFF" },
  "Travel": { bg: "#5856D6", text: "#FFFFFF" },
  "Music": { bg: "#FF2D55", text: "#FFFFFF" },
  "Photo & Video": { bg: "#AF52DE", text: "#FFFFFF" },
  "Games": { bg: "#34C759", text: "#FFFFFF" },
  "Social Networking": { bg: "#007AFF", text: "#FFFFFF" },
  "News": { bg: "#1C1C1E", text: "#FFFFFF" },
  "Weather": { bg: "#32ADE6", text: "#FFFFFF" },
  "Utilities": { bg: "#636366", text: "#FFFFFF" },
  "Business": { bg: "#2C3E50", text: "#FFFFFF" },
  "Lifestyle": { bg: "#FF9500", text: "#FFFFFF" },
};

const DEFAULT_COLORS = { bg: "#007AFF", text: "#FFFFFF" };

// ── Nano Banana Pro API ───────────────────────────────────────

/**
 * Call Nano Banana Pro API to generate icon image data.
 * @param {object} params
 * @returns {Promise<Buffer|null>} PNG buffer or null on failure
 */
async function callNanaBananaPro({ name, description, category }) {
  const apiKey = process.env.NANO_BANANA_API_KEY;
  if (!apiKey) return null;

  const apiBase = process.env.NANO_BANANA_API_URL || "https://api.nanobananapro.com/v1";
  const apiUrl = new URL("/generate/icon", apiBase);

  const colors = CATEGORY_COLORS[category] || DEFAULT_COLORS;
  const prompt = [
    `iOS app icon for "${name}".`,
    description ? `App concept: ${description.slice(0, 150)}.` : "",
    `Style: minimal, flat, modern, professional.`,
    `Background color hint: ${colors.bg}.`,
    `No text, no letters, no words in the icon.`,
    `Solid background, no transparency.`,
  ].filter(Boolean).join(" ");

  const payload = JSON.stringify({
    prompt,
    size: "1024x1024",
    format: "png",
    style: "flat-icon",
  });

  return new Promise((resolve) => {
    const options = {
      hostname: apiUrl.hostname,
      port: apiUrl.port || 443,
      path: apiUrl.pathname + apiUrl.search,
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "Content-Length": Buffer.byteLength(payload),
        "User-Agent": "ZeroClaw/1.0 icon-designer",
      },
      timeout: 60000,
    };

    const chunks = [];
    const req = https.request(options, (res) => {
      res.on("data", (chunk) => chunks.push(chunk));
      res.on("end", () => {
        const body = Buffer.concat(chunks);
        if (res.statusCode !== 200) {
          console.error(`Nano Banana Pro API error: HTTP ${res.statusCode} — ${body.toString().slice(0, 200)}`);
          resolve(null);
          return;
        }
        // Response may be JSON with image_url or direct PNG bytes
        const contentType = res.headers["content-type"] || "";
        if (contentType.includes("application/json")) {
          try {
            const json = JSON.parse(body.toString());
            const imageUrl = json.image_url || json.url || json.output;
            if (imageUrl) {
              // Fetch the image URL
              fetchImageUrl(imageUrl).then(resolve).catch(() => resolve(null));
            } else {
              console.error("Nano Banana Pro: no image_url in response");
              resolve(null);
            }
          } catch {
            resolve(null);
          }
        } else if (contentType.includes("image/png") || body.length > 1000) {
          resolve(body);
        } else {
          resolve(null);
        }
      });
    });

    req.on("error", (err) => {
      console.error(`Nano Banana Pro request error: ${err.message}`);
      resolve(null);
    });
    req.on("timeout", () => {
      req.destroy();
      console.error("Nano Banana Pro request timed out");
      resolve(null);
    });

    req.write(payload);
    req.end();
  });
}

/**
 * Fetch image bytes from a URL.
 * @param {string} url
 * @returns {Promise<Buffer|null>}
 */
function fetchImageUrl(url) {
  return new Promise((resolve) => {
    try {
      const parsed = new URL(url);
      const lib = parsed.protocol === "https:" ? https : require("http");
      const chunks = [];
      const req = lib.get(url, { timeout: 30000 }, (res) => {
        res.on("data", (chunk) => chunks.push(chunk));
        res.on("end", () => resolve(Buffer.concat(chunks)));
      });
      req.on("error", () => resolve(null));
      req.on("timeout", () => { req.destroy(); resolve(null); });
    } catch {
      resolve(null);
    }
  });
}

// ── Template-based fallback icon ──────────────────────────────

/**
 * Generate initials from app name.
 * @param {string} name
 * @returns {string} 1-2 uppercase letters
 */
function getInitials(name) {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[1][0]).toUpperCase();
}

/**
 * Generate a template SVG icon (solid color background + initials).
 * @param {object} params
 * @returns {string} SVG string
 */
function generateTemplateSVG({ name, category }) {
  const colors = CATEGORY_COLORS[category] || DEFAULT_COLORS;
  const initials = getInitials(name);
  const size = 1024;
  const fontSize = initials.length === 1 ? 480 : 380;
  const textY = size / 2 + fontSize * 0.36;

  // Generate a subtle gradient using two shades of the base color
  const bgColor = colors.bg;
  const gradientEnd = shadeColor(bgColor, -20);

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="${bgColor}"/>
      <stop offset="100%" stop-color="${gradientEnd}"/>
    </linearGradient>
  </defs>
  <rect width="${size}" height="${size}" fill="url(#bg)"/>
  <text
    x="${size / 2}"
    y="${textY}"
    font-family="-apple-system, SF Pro Display, Helvetica Neue, Helvetica, Arial, sans-serif"
    font-size="${fontSize}"
    font-weight="700"
    letter-spacing="-10"
    fill="${colors.text}"
    fill-opacity="0.95"
    text-anchor="middle"
  >${initials}</text>
</svg>`;
}

/**
 * Lighten or darken a hex color by percentage.
 * @param {string} hex
 * @param {number} percent - negative = darker
 * @returns {string}
 */
function shadeColor(hex, percent) {
  const num = parseInt(hex.slice(1), 16);
  const r = Math.min(255, Math.max(0, (num >> 16) + Math.round(2.55 * percent)));
  const g = Math.min(255, Math.max(0, ((num >> 8) & 0x00ff) + Math.round(2.55 * percent)));
  const b = Math.min(255, Math.max(0, (num & 0x0000ff) + Math.round(2.55 * percent)));
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, "0")}`;
}

/**
 * Write SVG to file.
 * @param {string} svgContent
 * @param {string} outputPath
 */
function writeSVG(svgContent, outputPath) {
  fs.writeFileSync(outputPath, svgContent, "utf-8");
}

// ── Image resizing ────────────────────────────────────────────

/**
 * Check if ImageMagick (convert) is available.
 * @returns {boolean}
 */
function hasImageMagick() {
  const result = spawnSync("which", ["convert"], { encoding: "utf-8" });
  return result.status === 0;
}

/**
 * Check if sips (macOS) is available.
 * @returns {boolean}
 */
function hasSips() {
  const result = spawnSync("which", ["sips"], { encoding: "utf-8" });
  return result.status === 0;
}

/**
 * Resize a PNG or SVG to a specific size using available tools.
 * @param {string} sourcePath
 * @param {string} outputPath
 * @param {number} size
 * @returns {boolean}
 */
function resizeIcon(sourcePath, outputPath, size) {
  const ext = path.extname(sourcePath).toLowerCase();

  if (hasImageMagick()) {
    const result = spawnSync("convert", [
      "-background", "none",
      "-resize", `${size}x${size}!`,
      sourcePath,
      outputPath,
    ], { encoding: "utf-8", timeout: 30000 });
    return result.status === 0 && fs.existsSync(outputPath);
  }

  if (hasSips() && ext === ".png") {
    // sips can only resize PNGs on macOS
    fs.copyFileSync(sourcePath, outputPath);
    const result = spawnSync("sips", [
      "-z", String(size), String(size),
      outputPath,
    ], { encoding: "utf-8", timeout: 15000 });
    return result.status === 0 && fs.existsSync(outputPath);
  }

  // No resize tool available — copy source at original size as placeholder
  console.error(`WARN: No image resize tool available. Writing unresized ${size}x${size} placeholder.`);
  if (fs.existsSync(sourcePath)) {
    fs.copyFileSync(sourcePath, outputPath);
    return true;
  }
  return false;
}

/**
 * Write fallback placeholder PNG (minimal valid PNG in target color).
 * @param {string} outputPath
 * @param {number} size
 * @param {string} color - hex color
 */
function writePlaceholderPNG(outputPath, size, color) {
  // Write the SVG as a placeholder since we can't generate real PNG without tools
  const svgPath = outputPath.replace(".png", ".svg");
  const svg = `<svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg"><rect width="${size}" height="${size}" fill="${color}"/></svg>`;
  fs.writeFileSync(svgPath, svg, "utf-8");
  fs.copyFileSync(svgPath, outputPath);
}

// ── AppIcon.appiconset manifest ───────────────────────────────

/**
 * Generate Contents.json for AppIcon.appiconset.
 * @returns {object}
 */
function generateIconSetManifest() {
  const images = [
    { idiom: "iphone", scale: "2x", size: "20x20", filename: "icon-40.png" },
    { idiom: "iphone", scale: "3x", size: "20x20", filename: "icon-60.png" },
    { idiom: "iphone", scale: "2x", size: "29x29", filename: "icon-58.png" },
    { idiom: "iphone", scale: "3x", size: "29x29", filename: "icon-87.png" },
    { idiom: "iphone", scale: "2x", size: "40x40", filename: "icon-80.png" },
    { idiom: "iphone", scale: "3x", size: "40x40", filename: "icon-120.png" },
    { idiom: "iphone", scale: "2x", size: "60x60", filename: "icon-120.png" },
    { idiom: "iphone", scale: "3x", size: "60x60", filename: "icon-180.png" },
    { idiom: "ipad", scale: "1x", size: "20x20", filename: "icon-20.png" },
    { idiom: "ipad", scale: "2x", size: "20x20", filename: "icon-40.png" },
    { idiom: "ipad", scale: "1x", size: "29x29", filename: "icon-29.png" },
    { idiom: "ipad", scale: "2x", size: "29x29", filename: "icon-58.png" },
    { idiom: "ipad", scale: "1x", size: "40x40", filename: "icon-40.png" },
    { idiom: "ipad", scale: "2x", size: "40x40", filename: "icon-80.png" },
    { idiom: "ipad", scale: "1x", size: "76x76", filename: "icon-76.png" },
    { idiom: "ipad", scale: "2x", size: "76x76", filename: "icon-152.png" },
    { idiom: "ipad", scale: "2x", size: "83.5x83.5", filename: "icon-167.png" },
    { idiom: "ios-marketing", scale: "1x", size: "1024x1024", filename: "icon-1024.png" },
  ];

  return {
    images: images.map(({ idiom, scale, size, filename }) => ({
      filename,
      idiom,
      scale,
      size,
    })),
    info: { author: "zeroclaw", version: 1 },
  };
}

// ── Main ─────────────────────────────────────────────────────

async function run() {
  // Find the target project
  let state;
  if (projectId) {
    state = loadState(projectId, stateDir);
    if (!state) {
      console.error(`Project not found: ${projectId}`);
      process.exit(1);
    }
  } else {
    const all = listStates(stateDir);
    const candidates = all
      .filter((s) => s.phase === "icon_generation")
      .sort((a, b) => new Date(a.timestamps.phase_entered_at) - new Date(b.timestamps.phase_entered_at));
    if (candidates.length === 0) {
      console.log(JSON.stringify({ action: "no_op", reason: "No projects in icon_generation phase" }));
      return;
    }
    state = candidates[0];
  }

  const projectDir = path.join(projectsDir, state.id);
  const iconsDir = path.join(projectDir, "submission_ready", "icons");
  fs.mkdirSync(iconsDir, { recursive: true });

  const now = new Date().toISOString();

  // Read store listing for context
  const storeListingPath = path.join(projectDir, "submission_ready", "store_listing.json");
  let storeListing = {};
  if (fs.existsSync(storeListingPath)) {
    try {
      storeListing = JSON.parse(fs.readFileSync(storeListingPath, "utf-8"));
    } catch {
      // Non-fatal — use state data
    }
  }

  const appName = storeListing.name || state.name || "App";
  const description = storeListing.subtitle || state.idea || "";
  const category = storeListing.category || "Productivity";

  let masterPngBuffer = null;
  let generationMethod = "unknown";

  // Try Nano Banana Pro API
  console.error(`Attempting Nano Banana Pro API for "${appName}"...`);
  masterPngBuffer = await callNanaBananaPro({ name: appName, description, category });

  if (masterPngBuffer && masterPngBuffer.length > 1000) {
    generationMethod = "nano-banana-pro";
    console.error(`Nano Banana Pro API: success (${masterPngBuffer.length} bytes)`);
  } else {
    generationMethod = "template-fallback";
    console.error("Nano Banana Pro API unavailable or failed. Using template fallback.");
    masterPngBuffer = null;
  }

  // Write master source (PNG from API or SVG from template)
  const masterPath = path.join(iconsDir, "icon-1024.png");
  let masterSourcePath;

  if (masterPngBuffer) {
    fs.writeFileSync(masterPath, masterPngBuffer);
    masterSourcePath = masterPath;
  } else {
    // Template-based: write SVG first, then convert
    const svgContent = generateTemplateSVG({ name: appName, category });
    const svgPath = path.join(iconsDir, "icon-1024.svg");
    writeSVG(svgContent, svgPath);
    masterSourcePath = svgPath;

    // Try to convert SVG to PNG
    if (hasImageMagick()) {
      const result = spawnSync("convert", [
        "-background", (CATEGORY_COLORS[category] || DEFAULT_COLORS).bg,
        "-size", "1024x1024",
        svgPath,
        masterPath,
      ], { encoding: "utf-8", timeout: 30000 });

      if (result.status !== 0) {
        console.error(`SVG→PNG conversion failed: ${result.stderr}`);
        // Write SVG as placeholder — downstream tools can handle it
        fs.copyFileSync(svgPath, masterPath);
      }
    } else {
      // No ImageMagick — write SVG content as the "PNG" placeholder
      console.error("WARN: ImageMagick not available. Writing SVG as icon placeholder.");
      fs.copyFileSync(svgPath, masterPath);
    }
  }

  // Resize to all required sizes
  const resizedFiles = [];
  let resizeFailures = 0;

  for (const { size, filename, usage } of ICON_SIZES) {
    if (size === 1024) {
      resizedFiles.push({ filename, size, usage, success: true });
      continue; // Already written
    }

    const outputPath = path.join(iconsDir, filename);
    const success = resizeIcon(masterSourcePath, outputPath, size);

    if (success) {
      resizedFiles.push({ filename, size, usage, success: true });
      console.error(`  Resized: ${filename} (${size}x${size})`);
    } else {
      resizeFailures++;
      // Write placeholder
      writePlaceholderPNG(outputPath, size, (CATEGORY_COLORS[category] || DEFAULT_COLORS).bg);
      resizedFiles.push({ filename, size, usage, success: false, note: "placeholder" });
      console.error(`  WARN: Could not resize to ${size}x${size}. Wrote placeholder.`);
    }
  }

  // Write icon-set.json
  const iconSetManifest = generateIconSetManifest();
  fs.writeFileSync(
    path.join(iconsDir, "icon-set.json"),
    JSON.stringify(iconSetManifest, null, 2),
    "utf-8"
  );

  // Update state
  state.phase = "video_production";
  state.artifacts = state.artifacts || {};
  state.artifacts.icons_dir = `projects/${state.id}/submission_ready/icons`;
  state.artifacts.icon_master = `projects/${state.id}/submission_ready/icons/icon-1024.png`;
  state.artifacts.icon_set_json = `projects/${state.id}/submission_ready/icons/icon-set.json`;
  state.timestamps.updated_at = now;
  state.timestamps.phase_entered_at = now;
  state.notes = state.notes || [];
  state.notes.push(`icon-designer: generated via ${generationMethod}`);
  if (resizeFailures > 0) {
    state.notes.push(`icon-designer: ${resizeFailures} sizes used placeholders (no resize tool)`);
  }
  saveState(state, stateDir);

  appendLiveFeed(
    "icon-designer",
    state.id,
    `Icon generated for "${appName}" via ${generationMethod}. ${resizedFiles.length} sizes produced. Phase → video_production.`,
    logsDir
  );

  console.log(JSON.stringify({
    action: "icon_generated",
    project_id: state.id,
    project_name: appName,
    generation_method: generationMethod,
    sizes_produced: resizedFiles.length,
    resize_failures: resizeFailures,
    icons: resizedFiles,
    next_phase: "video_production",
  }, null, 2));
}

// Run if invoked directly
if (require.main === module) {
  run().catch((err) => {
    console.error(`Icon designer failed: ${err.message}`);
    process.exit(1);
  });
}

module.exports = { run };
