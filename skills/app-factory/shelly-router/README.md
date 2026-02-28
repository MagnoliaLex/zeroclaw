# Shelly Router

Pipeline orchestrator for the App Factory.

## Inputs
- `state/summary.json` — aggregate project summary
- Individual project state files as needed

## Outputs
- `state/routing_decision.json` — next action to take
- `logs/routing.log` — append-only routing log
- `logs/live-feed.log` — live feed entry

## Schedule
Runs every 5 minutes via ZeroClaw heartbeat.

## Constraints
- 60 second timeout
- 4,000 token budget
- Max 5 concurrent active projects
- Oldest stalled project first
