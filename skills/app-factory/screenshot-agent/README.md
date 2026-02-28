# Screenshot Agent

Automated iOS simulator screenshot capture for ZeroClaw App Factory projects.

## Inputs

- `app-factory/state/<project_id>.json` — project state; must be in phase `screenshots`
- `<project_dir>/submission_ready/store_listing.json` — app name for context
- Xcode project at `<project_dir>/` (must be buildable)

## Outputs

Written to `<project_dir>/submission_ready/screenshots/`:

| Directory | Device | App Store Requirement |
|-----------|--------|----------------------|
| `iphone-6.7/` | iPhone 16 Pro Max (6.7") | Required |
| `iphone-6.1/` | iPhone 16 (6.1") | Required |
| `ipad-12.9/` | iPad Pro 12.9" | Required |

Also writes `manifest.json` — index of all captured screenshots with device metadata.

## State Transition

| Before | After (success) | After (failure) |
|--------|-----------------|-----------------|
| `screenshots` | `icon_generation` | `manual_review_required` |

## Model

`claude-sonnet-4-6`

## Constraints

- 300 second timeout
- 8,000 token budget
- Requires macOS with Xcode and iOS simulators installed
- Requires `xcrun simctl` and `xcodebuild` in PATH
- Minimum 3 screenshots per device size required

## Tool Script

`tools/screenshot.js` — uses `xcrun simctl` and `xcodebuild test` to drive the simulator, navigate flows, and capture screenshots.

Usage:
```
node skills/app-factory/screenshot-agent/tools/screenshot.js [--project-id ID] [--state-dir PATH] [--projects-dir PATH] [--logs-dir PATH]
```

## Dependencies

- macOS (Xcode required)
- Xcode with iOS simulators (iPhone 16, iPhone 16 Pro Max, iPad Pro 12.9")
- `xcrun`, `xcodebuild` available in PATH
- Node.js for the tool script
