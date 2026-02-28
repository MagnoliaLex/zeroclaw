# ZeroClaw App Factory

Autonomous iOS app generation pipeline powered by ZeroClaw skill agents.

## Overview

The App Factory is a workflow layer that orchestrates 12 skill agents to autonomously:

1. **Research** trending app ideas (Research Scout)
2. **Validate** ideas with market analysis (Validation Analyst)
3. **Build** SwiftUI apps from templates (App Builder)
4. **Review** code quality independently (Code Reviewer via Codex)
5. **QA Gate** with 6 automated checks (QA Gatekeeper)
6. **Monetize** with StoreKit 2 integration (Monetization Agent)
7. **Package** store listings and metadata (Store Packager)
8. **Screenshot** automated simulator captures (Screenshot Agent)
9. **Icon** generation via Nano Banana Pro (Icon Designer)
10. **Video** promo creation via Votion (Video Producer)
11. **Submit** and market on social platforms (Larry Marketing)

**Shelly** (router) orchestrates the pipeline every 5 minutes via ZeroClaw heartbeat.

## Directory Structure

```
app-factory/
  README.md              # This file
  lib/
    state.js             # State store schema + helpers
    pipeline.js          # Pipeline transition engine
    summary.js           # Summary generator
    quality.js           # Quality gate implementation
    notifications.js     # Telegram notification hooks
  state/                 # Project state files (JSON)
    summary.json         # Aggregate summary
  projects/              # Per-project workspace directories
  logs/                  # Routing + live feed logs
    routing.log          # Shelly routing decisions (append-only)
    live-feed.log        # Timestamped skill activity log
  tests/                 # Unit + integration tests

skills/app-factory/      # Skill agent definitions
  <skill-name>/
    prompt.md            # System prompt
    config.yaml          # Model, timeout, token caps
    tools/               # Helper scripts
    README.md            # Inputs/outputs documentation

templates/ios/           # SwiftUI app archetypes
  utility/
  ai-wrapper/
  tracker/
  reference/
  timer/

dashboard/               # Next.js 15 read-only dashboard
dashboard-api/           # Express API for dashboard
```

## Setup

### Environment Variables

Add to `.env` (never commit):

```bash
# App Factory
APP_FACTORY_STATE_DIR=./app-factory/state
APP_FACTORY_PROJECTS_DIR=./app-factory/projects
APP_FACTORY_LOGS_DIR=./app-factory/logs

# External Services (optional, stubs used if absent)
NANO_BANANA_PRO_API_KEY=your-key
VOTION_API_KEY=your-key
APP_STORE_CONNECT_KEY_ID=your-key-id
APP_STORE_CONNECT_ISSUER_ID=your-issuer-id
APP_STORE_CONNECT_PRIVATE_KEY_PATH=./keys/AuthKey.p8

# Social Media (Larry Marketing)
LARRY_X_API_KEY=your-key
LARRY_X_API_SECRET=your-secret
LARRY_REDDIT_CLIENT_ID=your-id
LARRY_REDDIT_CLIENT_SECRET=your-secret
LARRY_TIKTOK_ACCESS_TOKEN=your-token
LARRY_INSTAGRAM_ACCESS_TOKEN=your-token
```

### Running

```bash
# Start the full pipeline (ZeroClaw heartbeat triggers Shelly every 5 min)
npm run app-factory:start

# Start dashboard
npm run dashboard:start

# Run tests
npm test --prefix app-factory
node app-factory/tests/run.js
```

## Pipeline States

```
idea_pending_validation → validated → idea_pending_approval → approved →
dev_in_progress → dev_complete → review_in_progress → review_complete →
qa_in_progress → qa_passed / qa_failed →
monetization → store_packaging → screenshots → icon_generation →
video_production → submission_ready → marketing_active →
manual_review_required (terminal until operator action)
```

## Concurrency

- Max 5 active projects at any time
- Shelly picks oldest stalled actionable project first
- File-based locking prevents double-processing

## Quality Gate

6 checks with weighted scoring (max 10.0):

| Check | Weight | Method |
|-------|--------|--------|
| Compilation | 2.0 | xcodebuild |
| Feature completeness | 2.0 | One-pager cross-ref |
| Crash surface | 2.0 | Static analysis |
| Permission correctness | 1.5 | Info.plist audit |
| StoreKit validation | 1.5 | Sandbox test harness |
| UI/UX baseline | 1.0 | Simulated traversal |

- Score >= 8.0 → passes to monetization
- Score < 8.0 and attempts < 3 → returns to dev with remediation report
- Attempts == 3 → manual_review_required
