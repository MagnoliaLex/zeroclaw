#!/usr/bin/env node
/**
 * App Builder Tool
 *
 * Generates Xcode project from templates, adds required modules.
 * Usage: node build.js --project-id <id> [--template TYPE]
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
const templateOverride = getArg("template", null);
const libDir = path.join(__dirname, "..", "..", "..", "..", "app-factory", "lib");
const stateDir = getArg("state-dir", path.join(__dirname, "..", "..", "..", "..", "app-factory", "state"));
const projectsDir = getArg("projects-dir", path.join(__dirname, "..", "..", "..", "..", "app-factory", "projects"));
const templatesDir = path.join(__dirname, "..", "..", "..", "..", "templates", "ios");

const { loadState, saveState, ensureProjectDir } = require(path.join(libDir, "state"));
const { transitionPhase } = require(path.join(libDir, "pipeline"));
const { appendLiveFeed } = require(path.join(libDir, "notifications"));
const logsDir = path.join(stateDir, "..", "logs");

const TEMPLATE_TYPES = ["utility", "ai-wrapper", "tracker", "reference", "timer"];

function selectTemplate(onePager) {
  if (templateOverride && TEMPLATE_TYPES.includes(templateOverride)) {
    return templateOverride;
  }

  if (!onePager) return "utility";

  const idea = (onePager.description || onePager.idea || "").toLowerCase();
  const features = (onePager.features || []).map((f) => (f.name || f).toLowerCase()).join(" ");
  const combined = `${idea} ${features}`;

  if (/ai|gpt|chat|generat|llm|gemini/.test(combined)) return "ai-wrapper";
  if (/track|habit|health|log|journal|fitness/.test(combined)) return "tracker";
  if (/reference|guide|wiki|knowledge|learn|dictionary/.test(combined)) return "reference";
  if (/timer|stopwatch|countdown|pomodoro|clock/.test(combined)) return "timer";
  return "utility";
}

function copyTemplate(templateType, projectPath) {
  const templatePath = path.join(templatesDir, templateType);
  if (!fs.existsSync(templatePath)) {
    console.error(`Template not found: ${templatePath}`);
    return false;
  }

  copyDirRecursive(path.join(templatePath, "Sources"), path.join(projectPath, "Sources"));
  copyDirRecursive(path.join(templatePath, "Resources"), path.join(projectPath, "Resources"));

  return true;
}

function copyDirRecursive(src, dest) {
  if (!fs.existsSync(src)) return;
  fs.mkdirSync(dest, { recursive: true });
  const entries = fs.readdirSync(src, { withFileTypes: true });
  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      copyDirRecursive(srcPath, destPath);
    } else {
      let content = fs.readFileSync(srcPath, "utf-8");
      // Replace template variables
      content = content.replace(/\{\{APP_NAME\}\}/g, appName || "App");
      content = content.replace(/\{\{BUNDLE_ID\}\}/g, bundleId || "com.zeroclaw.app");
      content = content.replace(/\{\{PRIMARY_COLOR\}\}/g, "#007AFF");
      fs.writeFileSync(destPath, content);
    }
  }
}

let appName = "App";
let bundleId = "com.zeroclaw.app";

function run() {
  if (!projectId) {
    console.error("Usage: node build.js --project-id <id> [--template TYPE]");
    process.exit(1);
  }

  const state = loadState(projectId, stateDir);
  if (!state) {
    console.error(`Project not found: ${projectId}`);
    process.exit(1);
  }

  appName = state.name;
  const nameSlug = state.name.toLowerCase().replace(/[^a-z0-9]+/g, "");
  bundleId = `com.zeroclaw.${nameSlug}`;

  const projectPath = ensureProjectDir(projectId, projectsDir);
  appendLiveFeed("app-builder", projectId, "Starting app build", logsDir);

  // Load one-pager
  let onePager = null;
  try {
    onePager = JSON.parse(fs.readFileSync(path.join(projectPath, "one_pager.json"), "utf-8"));
  } catch { /* no one-pager */ }

  // Select and copy template
  const templateType = selectTemplate(onePager);
  state.config.template = templateType;

  appendLiveFeed("app-builder", projectId, `Selected template: ${templateType}`, logsDir);

  const copied = copyTemplate(templateType, projectPath);
  if (!copied) {
    state.error = `Failed to copy template: ${templateType}`;
    saveState(state, stateDir);
    process.exit(1);
  }

  // Generate basic Xcode project structure
  generateXcodeProject(projectPath, state);

  appendLiveFeed("app-builder", projectId, `Build complete using ${templateType} template`, logsDir);

  // Update state
  state.artifacts.xcode_project = `${projectId}.xcodeproj`;
  transitionPhase(state, "dev_complete", "app-builder", stateDir);
  saveState(state, stateDir);

  console.log(JSON.stringify({
    status: "built",
    template: templateType,
    project_path: projectPath,
    bundle_id: bundleId,
  }, null, 2));
}

function generateXcodeProject(projectPath, state) {
  // Create a minimal .xcodeproj structure
  const projDir = path.join(projectPath, `${state.id}.xcodeproj`);
  fs.mkdirSync(projDir, { recursive: true });

  // Write a minimal project.pbxproj
  const pbxproj = `// !$*UTF8*$!
{
  archiveVersion = 1;
  objectVersion = 56;
  rootObject = "ROOT";
  classes = {};
  objects = {
    ROOT = {
      isa = PBXProject;
      buildConfigurationList = "BUILD_CONFIG_LIST";
      compatibilityVersion = "Xcode 14.0";
      mainGroup = "MAIN_GROUP";
      productRefGroup = "PRODUCTS";
    };
  };
}
`;
  fs.writeFileSync(path.join(projDir, "project.pbxproj"), pbxproj);

  // Write Info.plist
  const permissions = state.config.permissions || [];
  let permissionEntries = "";
  const PERM_MAP = {
    camera: ["NSCameraUsageDescription", "This app needs camera access"],
    microphone: ["NSMicrophoneUsageDescription", "This app needs microphone access"],
    location: ["NSLocationWhenInUseUsageDescription", "This app needs location access"],
    photos: ["NSPhotoLibraryUsageDescription", "This app needs photo library access"],
  };
  for (const perm of permissions) {
    const entry = PERM_MAP[perm.toLowerCase()];
    if (entry) {
      permissionEntries += `\t<key>${entry[0]}</key>\n\t<string>${entry[1]}</string>\n`;
    }
  }

  const infoPlist = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
\t<key>CFBundleName</key>
\t<string>${state.name}</string>
\t<key>CFBundleIdentifier</key>
\t<string>${bundleId}</string>
\t<key>CFBundleVersion</key>
\t<string>1</string>
\t<key>CFBundleShortVersionString</key>
\t<string>1.0.0</string>
\t<key>UILaunchScreen</key>
\t<dict/>
${permissionEntries}</dict>
</plist>
`;
  fs.writeFileSync(path.join(projectPath, "Info.plist"), infoPlist);
}

if (require.main === module) {
  run();
}
