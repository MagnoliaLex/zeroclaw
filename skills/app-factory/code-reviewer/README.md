# Code Reviewer

Independent code review skill using Codex CLI.

## Inputs
- Project state file with phase `dev_complete`
- Swift source files in project directory

## Outputs
- `review_report.json` — structured review with issues, crash risks, recommendations
- Updated state → `review_complete`

## Model
Codex 5.3 via codex CLI (read-only analysis)

## Constraints
- Read-only access to source code
- 180 second timeout
- 16,000 token budget
