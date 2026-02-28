# Store Packager

Generates App Store submission copy for ZeroClaw App Factory projects.

## Inputs

- `app-factory/state/<project_id>.json` — project state; must be in phase `store_listing`
- `<project_dir>/one_pager.md` — project one-pager (path from `artifacts.one_pager_md`)
- `<project_dir>/src/` — source files scanned for feature context

## Outputs

Written to `<project_dir>/submission_ready/`:

| File | Description |
|------|-------------|
| `store_listing.json` | Machine-parseable listing: name, subtitle, description, keywords, category, privacy_policy_url |
| `store_listing.md` | Human-readable formatted markdown version of the listing |
| `privacy_policy.html` | Generated privacy policy HTML with embedded CSS, no external dependencies |

## State Transition

| Before | After |
|--------|-------|
| `store_listing` | `screenshots` |

On error (missing one-pager): transitions to `manual_review_required`.

## Model

`claude-opus-4-6` — used for high-quality copywriting and policy generation.

## Constraints

- 180 second timeout
- 16,000 token budget
- App Store name: 30 chars max
- App Store subtitle: 30 chars max
- App Store description: 4,000 chars max
- App Store keywords: 100 chars max (comma-separated)
- No competitor mentions, no "#1"/"best" superlatives, no calls to rate/review

## Tool Script

`tools/package.js` — reads project artifacts, generates store listing and privacy policy, writes outputs, updates state.

Usage:
```
node skills/app-factory/store-packager/tools/package.js [--project-id ID] [--state-dir PATH] [--projects-dir PATH] [--logs-dir PATH]
```
