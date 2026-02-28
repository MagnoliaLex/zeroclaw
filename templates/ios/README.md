# iOS SwiftUI Template Library

A collection of production-ready SwiftUI app archetypes targeting iOS 17+. Each template is a complete, compilable starting point with shared infrastructure modules pre-wired.

## Archetypes

| Archetype | Description | Navigation |
|-----------|-------------|------------|
| `utility` | Calculator, converter, formatter apps | TabView (Tool, History, Settings) |
| `ai-wrapper` | AI-powered chat and generation interface | NavigationStack |
| `tracker` | Habit, health, or activity tracker | TabView (Dashboard, Add, History, Settings) |
| `reference` | Reference guide or knowledge base | NavigationSplitView |
| `timer` | Timer, stopwatch, and countdown app | TabView (Timer, Stopwatch, Presets, Settings) |

## Common Infrastructure

Every archetype ships with these shared modules pre-integrated:

| File | Purpose |
|------|---------|
| `OnboardingView.swift` | 3-5 screen onboarding flow using `PageTabViewStyle` |
| `SettingsView.swift` | App info, preferences, and support link screen |
| `GeminiService.swift` | Gemini Flash API wrapper for runtime AI features |
| `PaywallView.swift` | StoreKit 2 paywall scaffold (premium + subscription tiers) |
| `AnalyticsService.swift` | Analytics event stubs (`trackEvent`, `trackScreen`, etc.) |
| `PermissionHelper.swift` | Camera, notifications, location permission request helpers |
| `AppEntry.swift` | `@main` App struct and scene setup |

## Template Variables

Each archetype supports substitution variables in the form `{{VARIABLE_NAME}}`. See each archetype's `template.json` for the full variable list. Core variables shared by all archetypes:

| Variable | Description | Example |
|----------|-------------|---------|
| `{{APP_NAME}}` | Human-readable app name | `MyApp` |
| `{{BUNDLE_ID}}` | iOS bundle identifier | `com.example.myapp` |
| `{{PRIMARY_COLOR}}` | Hex color for brand accent | `#007AFF` |
| `{{GEMINI_API_KEY}}` | Gemini Flash API key | `AIza...` |
| `{{TEAM_ID}}` | Apple Developer Team ID | `XXXXXXXXXX` |

## Directory Layout

```
templates/ios/
  README.md                   — this file
  <archetype>/
    template.json             — manifest: files, variables, features
    Sources/                  — Swift source files
      AppEntry.swift
      OnboardingView.swift
      SettingsView.swift
      GeminiService.swift
      PaywallView.swift
      AnalyticsService.swift
      PermissionHelper.swift
      <archetype-specific>.swift
      ...
    Resources/
      Info.plist
      Products.storekit
      Assets.xcassets         — placeholder note
```

## Requirements

- Xcode 15+
- iOS 17+ deployment target
- Swift 5.9+
- StoreKit 2 (built-in, no extra dependency)
- Gemini Flash API key (obtain from Google AI Studio)

## Usage

1. Copy the desired archetype directory into your Xcode project.
2. Replace all `{{VARIABLE}}` placeholders (or use the search-and-replace workflow in your IDE / the ZeroClaw template CLI).
3. Add your Gemini API key to `GeminiService.swift` or inject via environment variable.
4. Configure `Products.storekit` with your real product identifiers.
5. Run `cargo run -- template apply --archetype <name>` from the ZeroClaw CLI to automate substitution.

## License

Templates are provided under the same license as the ZeroClaw project. See root `LICENSE` for details.
