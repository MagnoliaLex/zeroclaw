# Research Scout

App idea discovery agent for the ZeroClaw App Factory pipeline.

## Purpose

Monitors trending signals from X/Twitter, Reddit, App Store trends, and RSS feeds to discover commercially viable iOS app ideas. Maintains a queue of at least 10 pending ideas in `app-factory/state/`.

## Inputs

| Source | Description | Required |
|--------|-------------|----------|
| `app-factory/state/*.json` | Existing project states (for queue depth and deduplication) | Yes |
| `X_BEARER_TOKEN` env | X API bearer token for trend discovery | Optional |
| `REDDIT_CLIENT_ID` env | Reddit OAuth client ID | Optional |
| `REDDIT_CLIENT_SECRET` env | Reddit OAuth client secret | Optional |

## Outputs

| Output | Description |
|--------|-------------|
| `app-factory/state/<id>.json` | One state file per new idea, phase `idea_pending_validation` |
| `app-factory/logs/live-feed.log` | Append-only log entry per idea created |

## Queue Target

- Target depth: **10 ideas** in `idea_pending_validation` phase
- If current depth >= 10, scout exits with no-op
- If current depth < 10, scout generates `(10 - current_depth)` new ideas

## Provider Priority

1. X API (`X_BEARER_TOKEN` env) — trending hashtags and app-related discussions
2. Reddit API (`REDDIT_CLIENT_ID` + `REDDIT_CLIENT_SECRET`) — r/apps, r/productivity, r/getdisciplined, r/startups
3. RSS fallback — Product Hunt daily, Hacker News Show HN, IndieHackers

## Idea Filters

Ideas are accepted only if they pass:
- iOS applicability (not hardware-only, not pure B2B enterprise)
- Clear user persona and measurable pain point
- Feasible scope for small team development
- Not already represented in existing state (name deduplication)

## Schedule

Runs on-demand via Shelly Router heartbeat when `idea_pending_validation` queue drops below target.

## Constraints

- Timeout: 120 seconds
- Token budget: 8,000
- Never writes to project directories
- Only appends to logs; never overwrites

## Tool Script

`tools/scout.js` — standalone runner that checks queue depth and generates new idea state files. Can be invoked directly:

```bash
node skills/app-factory/research-scout/tools/scout.js [--state-dir PATH] [--logs-dir PATH] [--target 10]
```
