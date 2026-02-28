# AUDIT_INVENTORY.md — ZeroClaw Full Project Inventory

**Audit Date:** 2026-02-28
**Auditor:** Claude Opus 4.6 (automated full-codebase audit)
**Baseline Test Results:** 2160 passed, 3 failed, 0 ignored

---

## 1. Project Overview

**Name:** ZeroClaw
**Description:** Zero overhead, zero compromise, 100% Rust autonomous agent runtime — the fastest, smallest AI assistant.
**License:** Apache-2.0
**Repository:** https://github.com/zeroclaw-labs/zeroclaw
**Version:** 0.1.0
**Rust Edition:** 2021 (toolchain 1.92.0)

---

## 2. Tech Stack

| Layer | Technology |
|-------|-----------|
| Language (primary) | Rust 1.92.0 |
| Language (secondary) | Python 3.10+, C/C++ (Arduino firmware), Slint (UI) |
| Async Runtime | Tokio (multi-threaded) |
| HTTP Client | reqwest (rustls-tls) |
| HTTP Server | Axum + Tower |
| Database | SQLite (rusqlite/bundled), PostgreSQL (postgres crate) |
| Serialization | serde + serde_json, TOML |
| Encryption | ChaCha20-Poly1305 (AEAD), HMAC-SHA256, SHA-256 |
| Observability | OpenTelemetry (OTLP), Prometheus, tracing |
| CLI Framework | clap (derive) |
| WebSocket | tokio-tungstenite (rustls) |
| Email | lettre (SMTP), async-imap, mail-parser |
| Chat Protocol | matrix-sdk (E2EE) |
| Protobuf | prost |
| Hardware | nusb (USB), tokio-serial, rppal (RPi GPIO), probe-rs |
| Browser | fantoccini (optional native backend) |
| Sandbox | Landlock, Firejail, Bubblewrap, Docker |
| Build Profiles | release (size-opt), release-fast (parallel), dist (fat LTO) |
| Container | Docker (multi-stage), docker-compose |
| CI/CD | GitHub Actions |
| Package Manager (Python) | pip/pyproject.toml with LangChain/LangGraph |
| Firmware Targets | Arduino Uno, ESP32, STM32 Nucleo-F401RE |

---

## 3. Directory Structure

```
zeroclaw/
├── src/                          # Main Rust source (91,623 lines)
│   ├── main.rs                   # CLI entrypoint and command routing
│   ├── lib.rs                    # Module exports and command enums
│   ├── util.rs                   # UTF-8 safe string utilities
│   ├── identity.rs               # AIEOS/OpenClaw identity format support
│   ├── migration.rs              # OpenClaw → ZeroClaw memory migration
│   ├── agent/                    # Agent orchestration loop
│   │   ├── mod.rs                # Module exports
│   │   ├── agent.rs              # Core Agent struct & AgentBuilder
│   │   ├── loop_.rs              # Streaming loop, credential scrubbing, compaction
│   │   ├── classifier.rs         # Query classification for model routing
│   │   ├── dispatcher.rs         # Tool dispatch (XML and Native)
│   │   ├── memory_loader.rs      # Memory context loading
│   │   ├── prompt.rs             # System prompt builder (pluggable sections)
│   │   └── tests.rs              # 25+ agent unit tests
│   ├── approval/mod.rs           # Interactive tool approval workflow
│   ├── auth/                     # OAuth and token management
│   │   ├── mod.rs                # Module exports
│   │   ├── anthropic_token.rs    # Anthropic token exchange
│   │   ├── openai_oauth.rs       # OpenAI device-code OAuth
│   │   └── profiles.rs           # Auth profile storage
│   ├── channels/                 # Message transport channels
│   │   ├── traits.rs             # Channel trait definition
│   │   ├── mod.rs                # Channel factory
│   │   ├── telegram.rs           # Telegram bot (polling)
│   │   ├── discord.rs            # Discord bot (WebSocket Gateway)
│   │   ├── slack.rs              # Slack bot (polling)
│   │   ├── cli.rs                # CLI stdin/stdout channel
│   │   ├── whatsapp.rs           # WhatsApp webhook channel
│   │   ├── signal.rs             # Signal messenger
│   │   ├── matrix.rs             # Matrix E2EE channel
│   │   ├── mattermost.rs         # Mattermost bot
│   │   ├── irc.rs                # IRC channel
│   │   ├── email_channel.rs      # Email (SMTP/IMAP)
│   │   ├── imessage.rs           # iMessage (macOS)
│   │   ├── dingtalk.rs           # DingTalk (China)
│   │   ├── lark.rs               # Lark/Feishu (China)
│   │   └── qq.rs                 # QQ (China)
│   ├── config/                   # Configuration system
│   │   ├── mod.rs                # Module re-exports
│   │   └── schema.rs             # Master config schema (~5000 lines)
│   ├── cost/                     # Token usage and cost tracking
│   │   ├── mod.rs                # Module exports
│   │   ├── tracker.rs            # Cost tracker implementation
│   │   └── types.rs              # TokenUsage, CostRecord, BudgetCheck
│   ├── cron/                     # Cron job scheduling
│   │   ├── mod.rs                # Module exports
│   │   ├── schedule.rs           # Schedule parsing
│   │   ├── scheduler.rs          # Scheduler loop
│   │   ├── store.rs              # Job persistence
│   │   └── types.rs              # CronJob, JobType, SessionTarget
│   ├── daemon/mod.rs             # Process supervisor
│   ├── doctor/mod.rs             # Diagnostic health checks
│   ├── gateway/mod.rs            # Axum HTTP gateway (rate limiting, timeouts)
│   ├── hardware/                 # Hardware discovery and introspection
│   │   ├── mod.rs                # Module exports
│   │   ├── discover.rs           # USB device enumeration
│   │   ├── introspect.rs         # Device introspection
│   │   └── registry.rs           # Board registry
│   ├── health/mod.rs             # Component health tracking
│   ├── heartbeat/                # Heartbeat system
│   │   ├── mod.rs                # Module exports
│   │   └── engine.rs             # Heartbeat engine
│   ├── integrations/             # Integration catalog
│   │   ├── mod.rs                # Module exports
│   │   └── registry.rs           # Hardcoded integration table
│   ├── memory/                   # Memory subsystem
│   │   ├── traits.rs             # Memory trait definition
│   │   ├── mod.rs                # Memory factory
│   │   ├── markdown.rs           # Markdown file backend
│   │   ├── sqlite.rs             # SQLite + FTS5 + vector search
│   │   ├── postgres.rs           # PostgreSQL backend
│   │   ├── none.rs               # No-op backend
│   │   ├── backend.rs            # Backend classification
│   │   ├── embeddings.rs         # Embedding provider (OpenAI)
│   │   ├── vector.rs             # Vector math (cosine similarity, BM25)
│   │   ├── chunker.rs            # Markdown chunking for RAG
│   │   ├── hygiene.rs            # Memory archival/pruning
│   │   ├── lucid.rs              # External lucid-memory bridge
│   │   ├── response_cache.rs     # LLM response cache
│   │   └── snapshot.rs           # Memory export/import
│   ├── observability/            # Observability subsystem
│   │   ├── traits.rs             # Observer trait
│   │   ├── mod.rs                # Observer factory
│   │   ├── log.rs                # Tracing-based observer
│   │   ├── verbose.rs            # Verbose observer
│   │   ├── noop.rs               # No-op observer
│   │   ├── multi.rs              # Fan-out observer
│   │   ├── otel.rs               # OpenTelemetry backend
│   │   └── prometheus.rs         # Prometheus metrics
│   ├── onboard/                  # First-time setup
│   │   ├── mod.rs                # Module exports
│   │   └── wizard.rs             # Interactive setup wizard (~5200 lines)
│   ├── peripherals/              # Hardware peripheral drivers
│   │   ├── traits.rs             # Peripheral trait
│   │   ├── mod.rs                # Peripheral factory + CLI
│   │   ├── rpi.rs                # Raspberry Pi GPIO
│   │   ├── serial.rs             # Serial port communication
│   │   ├── arduino_flash.rs      # Arduino firmware flash
│   │   ├── arduino_upload.rs     # Arduino upload
│   │   ├── nucleo_flash.rs       # STM32 Nucleo flash
│   │   ├── capabilities_tool.rs  # Capabilities discovery tool
│   │   ├── uno_q_bridge.rs       # Arduino Uno Q bridge
│   │   └── uno_q_setup.rs        # Uno Q setup
│   ├── providers/                # LLM providers
│   │   ├── traits.rs             # Provider trait
│   │   ├── mod.rs                # Provider factory
│   │   ├── anthropic.rs          # Anthropic Claude
│   │   ├── openai.rs             # OpenAI GPT
│   │   ├── openai_codex.rs       # OpenAI Codex (OAuth)
│   │   ├── ollama.rs             # Ollama (local/cloud)
│   │   ├── gemini.rs             # Google Gemini
│   │   ├── glm.rs                # Zhipu GLM (JWT)
│   │   ├── copilot.rs            # GitHub Copilot
│   │   ├── openrouter.rs         # OpenRouter
│   │   ├── compatible.rs         # OpenAI-compatible providers
│   │   ├── reliable.rs           # Resilient wrapper (retry/fallback)
│   │   └── router.rs             # Multi-provider router
│   ├── rag/mod.rs                # Hardware datasheet RAG
│   ├── runtime/                  # Runtime adapters
│   │   ├── traits.rs             # RuntimeAdapter trait
│   │   ├── mod.rs                # Runtime factory
│   │   ├── native.rs             # Native platform runtime
│   │   ├── docker.rs             # Docker container runtime
│   │   └── wasm.rs               # WASM runtime (stub)
│   ├── security/                 # Security subsystem
│   │   ├── traits.rs             # Sandbox trait
│   │   ├── mod.rs                # Module exports + redact()
│   │   ├── policy.rs             # AutonomyLevel, CommandRiskLevel, SecurityPolicy
│   │   ├── pairing.rs            # Gateway pairing (one-time codes)
│   │   ├── secrets.rs            # ChaCha20-Poly1305 secret store
│   │   ├── audit.rs              # Audit event logging
│   │   ├── detect.rs             # Sandbox auto-detection
│   │   ├── bubblewrap.rs         # Bubblewrap sandbox
│   │   ├── docker.rs             # Docker sandbox
│   │   ├── firejail.rs           # Firejail sandbox
│   │   └── landlock.rs           # Landlock kernel LSM
│   ├── service/mod.rs            # OS service management (systemd/launchd)
│   ├── skillforge/               # Automatic skill discovery
│   │   ├── mod.rs                # Module exports
│   │   ├── evaluate.rs           # Skill evaluation
│   │   ├── integrate.rs          # Skill integration
│   │   └── scout.rs              # Skill scouting
│   ├── skills/                   # Skill management
│   │   ├── mod.rs                # Skill loading
│   │   └── symlink_tests.rs      # Symlink safety tests
│   ├── tools/                    # Tool execution surface
│   │   ├── traits.rs             # Tool trait
│   │   ├── mod.rs                # Tool registry factory
│   │   ├── schema.rs             # JSON Schema cleaning for providers
│   │   ├── shell.rs              # Shell command execution (sandboxed)
│   │   ├── file_read.rs          # File read (path sandbox)
│   │   ├── file_write.rs         # File write (symlink protection)
│   │   ├── browser.rs            # Browser automation
│   │   ├── browser_open.rs       # URL opening (allowlist)
│   │   ├── http_request.rs       # HTTP requests (allowlist)
│   │   ├── web_search_tool.rs    # Web search (DDG/Brave)
│   │   ├── memory_store.rs       # Memory store tool
│   │   ├── memory_recall.rs      # Memory recall tool
│   │   ├── memory_forget.rs      # Memory forget tool
│   │   ├── screenshot.rs         # Screenshot capture
│   │   ├── image_info.rs         # Image info tool
│   │   ├── schedule.rs           # Task scheduling tool
│   │   ├── delegate.rs           # Sub-agent delegation tool
│   │   ├── pushover.rs           # Pushover notification tool
│   │   ├── git_operations.rs     # Git operations (sanitized)
│   │   ├── proxy_config.rs       # Proxy configuration tool
│   │   ├── composio.rs           # Composio integration tool
│   │   ├── hardware_board_info.rs # Hardware board info tool
│   │   ├── hardware_memory_map.rs # Hardware memory map tool
│   │   ├── hardware_memory_read.rs # Hardware memory read tool
│   │   ├── cron_add.rs           # Cron add tool
│   │   ├── cron_list.rs          # Cron list tool
│   │   ├── cron_remove.rs        # Cron remove tool
│   │   ├── cron_run.rs           # Cron run tool
│   │   ├── cron_runs.rs          # Cron runs tool
│   │   └── cron_update.rs        # Cron update tool
│   └── tunnel/                   # Network tunnels
│       ├── mod.rs                # Tunnel factory
│       ├── ngrok.rs              # ngrok tunnel
│       ├── cloudflare.rs         # Cloudflare tunnel
│       ├── tailscale.rs          # Tailscale tunnel
│       ├── custom.rs             # Custom tunnel
│       └── none.rs               # No-op tunnel
├── crates/robot-kit/             # Robotics toolkit crate
│   ├── Cargo.toml                # Crate manifest
│   └── src/                      # Robot capabilities
│       ├── lib.rs                # Module exports + tool factory
│       ├── config.rs             # Robot hardware config
│       ├── drive.rs              # Motor control (ROS2)
│       ├── emote.rs              # LED/sound emotion expression
│       ├── listen.rs             # Audio capture (arecord)
│       ├── look.rs               # Camera capture (ffmpeg)
│       ├── safety.rs             # Collision avoidance (rplidar)
│       ├── sense.rs              # Sensor reading
│       ├── speak.rs              # TTS (piper)
│       ├── tests.rs              # Robot kit tests
│       └── traits.rs             # Robot traits
├── tests/                        # Integration tests
│   ├── agent_e2e.rs              # Agent E2E tests
│   ├── dockerignore_test.rs      # .dockerignore validation
│   ├── memory_comparison.rs      # SQLite vs Markdown comparison
│   ├── reply_target_field_regression.rs  # Field regression guard
│   └── whatsapp_webhook_security.rs     # WhatsApp HMAC tests
├── examples/                     # Usage examples
│   ├── custom_channel.rs         # Custom Telegram channel
│   ├── custom_memory.rs          # Custom in-memory backend
│   ├── custom_provider.rs        # Custom Ollama provider
│   └── custom_tool.rs            # Custom HTTP GET tool
├── benches/                      # Performance benchmarks
│   └── agent_benchmarks.rs       # Tool dispatch/memory/agent benchmarks
├── fuzz/                         # Fuzz targets
│   ├── Cargo.toml                # Fuzz dependencies
│   └── fuzz_targets/
│       ├── fuzz_config_parse.rs  # Config parsing fuzzer
│       └── fuzz_tool_params.rs   # Tool parameter fuzzer
├── python/                       # Python SDK (LangChain-based)
│   ├── pyproject.toml            # Package metadata
│   ├── zeroclaw_tools/           # Python package
│   │   ├── __init__.py           # Package exports
│   │   ├── __main__.py           # CLI entry point
│   │   ├── agent.py              # LangGraph agent factory
│   │   ├── tools/                # Python tool implementations
│   │   │   ├── base.py           # Tool decorator wrapper
│   │   │   ├── file.py           # File read/write tools
│   │   │   ├── memory.py         # Memory store/recall tools
│   │   │   ├── shell.py          # Shell execution tool
│   │   │   └── web.py            # HTTP/web search tools
│   │   └── integrations/
│   │       └── discord_bot.py    # Discord integration
│   └── tests/                    # Python tests
│       └── test_tools.py         # Tool tests
├── firmware/                     # Embedded firmware
│   ├── zeroclaw-arduino/         # Arduino Uno sketch
│   ├── zeroclaw-esp32/           # ESP32 Rust firmware
│   ├── zeroclaw-esp32-ui/        # ESP32 Slint UI
│   ├── zeroclaw-nucleo/          # STM32 Nucleo firmware
│   └── zeroclaw-uno-q-bridge/    # Arduino Uno Q bridge
├── docs/                         # Documentation system
│   ├── README.md (+ .ja, .ru, .zh-CN)  # Docs hub (multilingual)
│   ├── SUMMARY.md                # Unified TOC
│   ├── architecture.svg          # Architecture diagram
│   ├── commands-reference.md     # CLI commands reference
│   ├── providers-reference.md    # Provider reference
│   ├── channels-reference.md     # Channel reference
│   ├── config-reference.md       # Config reference
│   ├── operations-runbook.md     # Operations runbook
│   ├── troubleshooting.md        # Troubleshooting guide
│   └── [30+ additional docs]     # Security, hardware, CI docs
├── .github/                      # GitHub automation
│   ├── workflows/                # 18 CI/CD workflows
│   │   └── scripts/              # 8 JavaScript automation scripts
│   ├── CODEOWNERS                # Code ownership
│   ├── dependabot.yml            # Dependency updates
│   └── ISSUE_TEMPLATE/           # Bug/feature templates
├── dev/                          # Development environment
│   ├── ci.sh                     # Local CI orchestration
│   ├── cli.sh                    # Dev environment manager
│   └── docker-compose.*.yml      # Dev/CI containers
├── scripts/                      # Build/install scripts
│   ├── bootstrap.sh              # One-click installer
│   ├── install.sh                # Install wrapper
│   └── ci/                       # CI helper scripts
├── Cargo.toml                    # Workspace manifest
├── Cargo.lock                    # Locked dependencies
├── Dockerfile                    # Multi-stage Docker build
├── docker-compose.yml            # Production compose
├── CLAUDE.md                     # Agent protocol (this repo)
├── CONTRIBUTING.md               # Contribution guide
├── CHANGELOG.md                  # Changelog
├── SECURITY.md                   # Security policy
├── LICENSE                       # Apache-2.0
└── [config files]                # .editorconfig, rustfmt.toml, clippy.toml, deny.toml, etc.
```

---

## 4. Entry Points

| Entry Point | File | Description |
|-------------|------|-------------|
| CLI Binary | `src/main.rs` | Primary entry; `clap` command routing |
| Gateway HTTP | `src/gateway/mod.rs` | Axum HTTP server for webhooks |
| Daemon | `src/daemon/mod.rs` | Process supervisor (gateway + channels + heartbeat + cron) |
| Python CLI | `python/zeroclaw_tools/__main__.py` | Python LangChain agent CLI |
| Arduino | `firmware/zeroclaw-arduino/zeroclaw-arduino.ino` | Serial JSON GPIO control |
| ESP32 | `firmware/zeroclaw-esp32/src/main.rs` | Serial JSON GPIO control |
| Nucleo | `firmware/zeroclaw-nucleo/src/main.rs` | Serial JSON GPIO control |
| Uno Q Bridge | `firmware/zeroclaw-uno-q-bridge/python/main.py` | Socket GPIO bridge |

---

## 5. CLI Commands

| Command | Subcommands | Description |
|---------|-------------|-------------|
| `agent` | — | Start interactive agent |
| `gateway` | — | Start HTTP gateway |
| `daemon` | — | Start process supervisor |
| `service` | install, uninstall, start, stop, restart, status, logs | OS service management |
| `doctor` | — | Diagnostic health checks |
| `status` | — | Show daemon/component status |
| `cron` | list, add, add-at, add-every, once, remove, pause, resume | Scheduler management |
| `models` | — | Model listing/refresh |
| `providers` | — | Provider listing |
| `channel` | list, start, doctor, add, remove, bind-telegram | Channel management |
| `integrations` | list | Integration catalog |
| `skills` | list, install, remove | Skill management |
| `migrate` | openclaw | Memory migration |
| `auth` | login, paste-redirect, paste-token, setup-token, refresh, logout, use, list, status | Auth management |
| `hardware` | discover, info, introspect | Hardware discovery |
| `peripheral` | add, remove, list, flash, setup-uno-q, flash-nucleo | Peripheral management |

---

## 6. Data Flow

```
User Input (CLI/Telegram/Discord/Slack/etc.)
    │
    ▼
Channel (traits.rs) → ChannelMessage
    │
    ▼
Agent (agent.rs) → Query Classification → Model Routing
    │
    ├── Memory Loader → Load context from memory
    ├── Prompt Builder → Construct system prompt
    │
    ▼
Provider (traits.rs) → ChatRequest → LLM API
    │
    ▼
ChatResponse (text + tool_calls)
    │
    ├── [If tool_calls] → Dispatcher → Tool Execution
    │       │                              │
    │       │    ┌─────────────────────────┘
    │       │    ▼
    │       │  ToolResult → Loop back to Provider
    │       │
    ├── [If text only] → Format response
    │
    ▼
Channel.send() → User Output
    │
    ├── Memory Auto-save (if enabled)
    ├── Observer Event (telemetry)
    └── Cost Tracking (token usage)
```

---

## 7. External Dependencies (Key)

| Dependency | Version | Purpose |
|-----------|---------|---------|
| tokio | 1.42 | Async runtime |
| reqwest | 0.12 | HTTP client |
| axum | 0.8 | HTTP server |
| rusqlite | 0.37 | SQLite (bundled) |
| postgres | 0.19 | PostgreSQL client |
| matrix-sdk | 0.16 | Matrix E2EE |
| chacha20poly1305 | 0.10 | AEAD encryption |
| ring | 0.17 | HMAC-SHA256 (GLM JWT) |
| opentelemetry | 0.31 | Tracing/metrics |
| prometheus | 0.14 | Metrics |
| clap | 4.5 | CLI parsing |
| serde | 1.0 | Serialization |
| tokio-tungstenite | 0.24 | WebSocket |
| lettre | 0.11 | Email SMTP |
| fantoccini | 0.22 | Browser automation (optional) |
| nusb | 0.2 | USB enumeration (optional) |
| rppal | 0.22 | RPi GPIO (Linux, optional) |
| landlock | 0.4 | Kernel LSM sandbox (Linux, optional) |

---

## 8. Feature Flags

| Feature | Dependencies | Default |
|---------|-------------|---------|
| `hardware` | nusb, tokio-serial | Yes |
| `peripheral-rpi` | rppal | No |
| `browser-native` | fantoccini | No |
| `sandbox-landlock` | landlock | No |
| `sandbox-bubblewrap` | — | No |
| `probe` | probe-rs | No |
| `rag-pdf` | pdf-extract | No |

---

## 9. Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `API_KEY` | Default LLM API key | Yes (or provider-specific) |
| `ANTHROPIC_API_KEY` | Anthropic Claude API key | Provider-specific |
| `OPENAI_API_KEY` | OpenAI API key | Provider-specific |
| `GEMINI_API_KEY` | Google Gemini API key | Provider-specific |
| `GLM_API_KEY` | Zhipu GLM API key | Provider-specific |
| `OPENROUTER_API_KEY` | OpenRouter API key | Provider-specific |
| `TELEGRAM_BOT_TOKEN` | Telegram bot token | Channel-specific |
| `DISCORD_BOT_TOKEN` | Discord bot token | Channel-specific |
| `SLACK_BOT_TOKEN` | Slack bot token | Channel-specific |
| `BRAVE_SEARCH_API_KEY` | Brave Search API key | Optional |
| `PUSHOVER_TOKEN` / `PUSHOVER_USER` | Pushover notification | Optional |
| `COMPOSIO_API_KEY` | Composio integration | Optional |
| `EMBEDDING_API_KEY` | Embedding provider key | Optional |
| `OTEL_EXPORTER_OTLP_ENDPOINT` | OTel collector endpoint | Optional |
| `ZEROCLAW_CONFIG` | Config file path override | Optional |
| `ZEROCLAW_WORKSPACE` | Workspace directory | Optional |
| `ZEROCLAW_LOG` | Log level | Optional |
| `LUCID_CMD` | External lucid-memory path | Optional |

---

## 10. Configuration Files

| File | Format | Purpose |
|------|--------|---------|
| `config.toml` | TOML | Main application configuration |
| `.env` | Key=Value | Environment variable overrides |
| `Cargo.toml` | TOML | Rust workspace manifest |
| `deny.toml` | TOML | Dependency license/advisory policy |
| `clippy.toml` | TOML | Clippy linter thresholds |
| `rustfmt.toml` | TOML | Rust formatter config |
| `rust-toolchain.toml` | TOML | Rust toolchain version pin |
| `.cargo/config.toml` | TOML | Cargo target-specific flags |
| `.editorconfig` | INI | Editor settings |
| `.markdownlint-cli2.yaml` | YAML | Markdown linter config |
| `.coderabbit.yaml` | YAML | CodeRabbit AI review config |
| `.github/dependabot.yml` | YAML | Dependabot config |
| `.github/labeler.yml` | YAML | PR labeler patterns |
| `.github/label-policy.json` | JSON | Label policy rules |

---

## 11. Module Dependency Graph (Simplified)

```
main.rs ──► config/schema ──► all modules
         ├► agent ──► providers, memory, tools, security, observability, runtime
         ├► channels ──► providers (indirect via agent)
         ├► gateway ──► security, config
         ├► daemon ──► gateway, channels, heartbeat, cron
         ├► onboard ──► config, providers, channels, memory
         ├► auth ──► security, config
         └► service ──► config

providers ──► traits (Provider), reqwest
channels ──► traits (Channel), reqwest, tokio
tools ──► traits (Tool), security/policy, runtime
memory ──► traits (Memory), rusqlite/postgres, embeddings
security ──► traits (Sandbox), chacha20poly1305
observability ──► traits (Observer), opentelemetry, prometheus
runtime ──► traits (RuntimeAdapter)
peripherals ──► traits (Peripheral), serial, tools
```

---

## 12. Test Infrastructure

| Type | Location | Count |
|------|----------|-------|
| Unit tests | `src/**` (inline `#[cfg(test)]`) | ~2160 |
| Integration tests | `tests/` | 5 files |
| Examples | `examples/` | 4 files |
| Benchmarks | `benches/` | 1 file (3 benchmark groups) |
| Fuzz targets | `fuzz/` | 2 targets |
| Python tests | `python/tests/` | 1 file |

**Baseline:** 2160 passed, 3 failed (2 env-specific, 1 stale assertion)

---

## 13. CI/CD Workflows

| Workflow | Trigger | Purpose |
|----------|---------|---------|
| ci-run.yml | push/PR | Main CI pipeline (fmt, clippy, test, docs) |
| feature-matrix.yml | push/PR | Feature combination builds |
| test-rust-build.yml | push/PR | Rust compilation check |
| test-benchmarks.yml | push/PR | Performance benchmarks |
| test-e2e.yml | push/PR | E2E tests |
| test-fuzz.yml | manual/schedule | Fuzz testing |
| sec-audit.yml | push/PR/schedule | cargo-deny audit |
| sec-codeql.yml | schedule | CodeQL analysis |
| pub-docker-img.yml | push main/tag | Docker image publish |
| pub-release.yml | tag push | Binary release |
| pr-labeler.yml | PR | Auto-labeling |
| pr-intake-checks.yml | PR | PR sanity checks |
| pr-auto-response.yml | PR | Contributor tier response |
| pr-check-stale.yml | schedule | Stale PR detection |
| pr-check-status.yml | schedule | PR status nudge |
| pr-label-policy-check.yml | PR | Label policy enforcement |
| sync-contributors.yml | push main | NOTICE file update |
| workflow-sanity.yml | push/PR | Workflow YAML lint |
