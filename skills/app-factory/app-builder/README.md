# App Builder

Xcode project generation agent for the ZeroClaw App Factory pipeline.

## Purpose

Generates a complete, buildable iOS Xcode project from the validated one-pager. Selects the appropriate template, scaffolds all required SwiftUI views, wires onboarding, settings, a Gemini AI wrapper, and StoreKit2 paywall, then runs a fast xcodebuild compilation check.

## Inputs

| Source | Description | Required |
|--------|-------------|----------|
| `app-factory/state/<id>.json` | Project state with phase `approved` or `dev_in_progress` | Yes |
| `app-factory/projects/<id>/one_pager.json` | Validated one-pager with features and feasibility data | Yes |
| `app-factory/templates/ios/<template-name>/` | Base Xcode project template | Yes |

## Outputs

| Output | Description |
|--------|-------------|
| `app-factory/projects/<id>/<AppName>.xcodeproj` | Xcode project file |
| `app-factory/projects/<id>/Sources/` | Generated Swift source files |
| `app-factory/projects/<id>/Resources/` | Assets, Info.plist, StoreKit config |
| `app-factory/state/<id>.json` | Updated with phase `dev_complete` and `xcode_project` artifact |
| `app-factory/logs/live-feed.log` | Appended build result entry |

## Generated Files

| File | Description |
|------|-------------|
| `Sources/ContentView.swift` | Root view with NavigationStack |
| `Sources/OnboardingView.swift` | 3-step onboarding flow |
| `Sources/HomeView.swift` | Primary feature view |
| `Sources/SettingsView.swift` | Preferences, notifications, about |
| `Sources/PaywallView.swift` | StoreKit2 subscription paywall |
| `Sources/Services/GeminiService.swift` | Gemini REST API wrapper |
| `Sources/Services/StoreService.swift` | StoreKit2 purchase manager |
| `Sources/Models/AppState.swift` | Top-level app state model |
| `Resources/Info.plist` | Permission declarations |
| `Resources/Products.storekit` | StoreKit configuration |

## Template Selection

| Template | Use Case |
|----------|----------|
| `productivity-base` | Task, habit, timer, focus apps |
| `content-base` | Reading, media, feed apps |
| `social-base` | Community, messaging, sharing apps |
| `health-base` | Fitness, wellness, nutrition apps |
| `finance-base` | Budgeting, tracking, investment apps |
| `education-base` | Learning, quiz, flashcard apps |
| `utility-base` | Tools, converters, calculators (default) |

## Build Retry Logic

| Condition | Action |
|-----------|--------|
| Build succeeds | Transition to `dev_complete` |
| Build fails, attempts < 3 | Stay in `dev_in_progress`, increment `attempt_counters.build` |
| Build fails, attempts == 3 | Transition to `manual_review_required` |

## Code Standards

All generated Swift must:
- Target iOS 17.0+
- Use SwiftUI (not UIKit)
- Use `NavigationStack` (not `NavigationView`)
- Use `async/await` for networking
- Include `.accessibilityLabel` on interactive elements
- Have no force unwraps in production paths

## Tool Script

`tools/build.js` — standalone orchestration script for template selection and project generation.

```bash
node skills/app-factory/app-builder/tools/build.js \
  --project-id <id> \
  [--state-dir PATH] \
  [--projects-dir PATH] \
  [--templates-dir PATH] \
  [--logs-dir PATH]
```

## Constraints

- Timeout: 300 seconds
- Token budget: 32,000
- Uses claude-opus-4-6 for highest code quality
- xcodebuild check is mandatory — never skipped
- Never generates placeholder TODO comments without real implementation
