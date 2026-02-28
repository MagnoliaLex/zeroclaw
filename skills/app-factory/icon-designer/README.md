# Icon Designer

Generates the app icon set for ZeroClaw App Factory projects using Nano Banana Pro API (with template-based fallback).

## Inputs

- `app-factory/state/<project_id>.json` — project state; must be in phase `icon_generation`
- `<project_dir>/submission_ready/store_listing.json` — app name, description, category

## Outputs

Written to `<project_dir>/submission_ready/icons/`:

| File | Size | Usage |
|------|------|-------|
| `icon-1024.png` | 1024x1024 | App Store master |
| `icon-180.png` | 180x180 | iPhone @3x |
| `icon-120.png` | 120x120 | iPhone @2x |
| `icon-167.png` | 167x167 | iPad Pro @2x |
| `icon-152.png` | 152x152 | iPad @2x |
| `icon-76.png` | 76x76 | iPad @1x |
| `icon-87.png` | 87x87 | iPhone Settings @3x |
| `icon-58.png` | 58x58 | iPhone Settings @2x |
| `icon-80.png` | 80x80 | iPhone Spotlight @2x |
| `icon-40.png` | 40x40 | iPad Spotlight @1x |
| `icon-set.json` | — | AppIcon.appiconset/Contents.json manifest |

## State Transition

| Before | After (success) | After (failure) |
|--------|-----------------|-----------------|
| `icon_generation` | `video_production` | `manual_review_required` |

## Model

`claude-sonnet-4-6`

## Constraints

- 120 second timeout
- 4,000 token budget
- Icons must be PNG, no transparency, no rounded corners in source
- No text overlaid on AI-generated icons

## Generation Strategy

1. **Primary**: Nano Banana Pro API (`NANO_BANANA_API_KEY` required)
2. **Fallback**: Template-based SVG generation — category-specific background color + app name initials

## Tool Script

`tools/icon.js` — calls Nano Banana Pro API or generates template icon, then resizes to all required sizes.

Usage:
```
node skills/app-factory/icon-designer/tools/icon.js [--project-id ID] [--state-dir PATH] [--projects-dir PATH] [--logs-dir PATH]
```

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `NANO_BANANA_API_KEY` | No | Nano Banana Pro API key. If absent, fallback template is used. |
| `NANO_BANANA_API_URL` | No | API base URL (default: `https://api.nanobananapro.com/v1`) |
