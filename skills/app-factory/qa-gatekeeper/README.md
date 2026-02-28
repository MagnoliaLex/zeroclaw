# QA Gatekeeper

Quality gate skill that runs 6 automated checks on iOS projects.

## Inputs
- Project state file with phase `review_complete`
- Project source code and artifacts
- One-pager JSON (feature cross-reference)
- Review report (crash risk data)

## Outputs
- `quality_report.json` — per-check results with weighted scoring
- State transition based on score:
  - >= 8.0 → `monetization`
  - < 8.0 (attempts < 3) → `dev_in_progress`
  - attempts == 3 → `manual_review_required`

## Quality Checks (max 10.0)
1. Compilation (2.0) — xcodebuild
2. Feature Completeness (2.0) — one-pager cross-ref
3. Crash Surface (2.0) — static analysis
4. Permission Correctness (1.5) — Info.plist audit
5. StoreKit Validation (1.5) — sandbox patterns
6. UI/UX Baseline (1.0) — structural check
