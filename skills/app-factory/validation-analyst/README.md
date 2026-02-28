# Validation Analyst

Idea validation agent for the ZeroClaw App Factory pipeline.

## Purpose

Evaluates iOS app ideas by conducting competition research, generating structured one-pager documents, and routing projects to the next pipeline phase. Transforms raw idea entries into validated, buildable project briefs.

## Inputs

| Source | Description | Required |
|--------|-------------|----------|
| `app-factory/state/<id>.json` | Project state with phase `idea_pending_validation` | Yes |
| `DASHBOARD_APPROVAL_REQUIRED` env | If `true`, routes to `idea_pending_approval` instead of `validated` | Optional |

## Outputs

| Output | Description |
|--------|-------------|
| `app-factory/projects/<id>/one_pager.md` | Human-readable validation one-pager |
| `app-factory/projects/<id>/one_pager.json` | Machine-readable one-pager with features array, sources, competition_score |
| `app-factory/state/<id>.json` | Updated with phase `validated` or `idea_pending_approval` |
| `app-factory/logs/live-feed.log` | Appended completion entry |

## One-Pager JSON Fields

| Field | Type | Description |
|-------|------|-------------|
| `id` | string | Project identifier |
| `name` | string | App name |
| `summary` | string | Executive summary |
| `persona` | object | Target user demographics, pain points, motivation |
| `features` | array | Feature list with priority and keywords |
| `competition.top_competitors` | array | Top 3 App Store competitors |
| `competition.saturation` | string | `low`, `medium`, or `high` |
| `competition.competition_score` | number | 0.0–1.0 competition intensity |
| `competition.differentiation_angle` | string | Unique positioning |
| `monetization.model` | string | `freemium`, `subscription`, or `one_time` |
| `feasibility.complexity` | string | `low`, `medium`, or `high` |
| `feasibility.estimated_dev_weeks` | number | Estimated development time |
| `feasibility.required_permissions` | array | iOS permission requirements |
| `feasibility.template_suggestion` | string | Suggested Xcode template |
| `risks` | array | Key risk factors |
| `success_metrics` | object | DAU target, retention goal, revenue target |
| `sources` | array | URLs or sources used in research |

## Phase Routing

| Condition | Next Phase |
|-----------|------------|
| `DASHBOARD_APPROVAL_REQUIRED=true` | `idea_pending_approval` |
| Default | `validated` |

## Competition Score Thresholds

| Score Range | Interpretation |
|-------------|----------------|
| 0.0–0.3 | Low competition — proceed with confidence |
| 0.3–0.6 | Medium — viable with differentiation |
| 0.6–0.8 | High — differentiation required |
| 0.8–1.0 | Very high — saturation risk, flag in one-pager |

## Tool Script

`tools/validate.js` — standalone runner that reads project state, conducts competition research, generates one-pager structure, and writes artifacts.

```bash
node skills/app-factory/validation-analyst/tools/validate.js \
  --project-id <id> \
  [--state-dir PATH] \
  [--projects-dir PATH] \
  [--logs-dir PATH]
```

## Constraints

- Timeout: 180 seconds
- Token budget: 12,000
- Never invents competitor names — only cites verifiable apps
- Competition research is mandatory for every idea
- One-pager must be actionable for app-builder immediately
