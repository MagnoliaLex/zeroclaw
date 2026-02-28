# IMPROVEMENTS.md — Strategic Improvement Recommendations

**Audit Date:** 2026-02-28

---

## 5a. Architecture Improvements

### A-01: Add connection pooling for PostgreSQL memory
- **Priority:** P0 (do now)
- **Effort:** Medium
- **Impact:** Current single `Arc<Mutex<Client>>` serializes all memory operations. Under concurrent channel usage, this becomes a severe bottleneck.
- **Implementation:** Replace `postgres::Client` with `deadpool-postgres` or `bb8-postgres`. Create pool during `create_memory()` with configurable min/max connections. Update `PostgresMemory` methods to acquire connection from pool instead of locking mutex.

### A-02: Make OpenTelemetry and PostgreSQL optional features
- **Priority:** P1 (do soon)
- **Effort:** Low
- **Impact:** Both are unconditionally compiled but rarely used. Making them feature-gated reduces binary size by ~2-5MB and compile time by ~30s.
- **Implementation:** Add `feature = "otel"` and `feature = "postgres"` to Cargo.toml. Gate `src/observability/otel.rs` and `src/memory/postgres.rs` behind `#[cfg(feature = "...")]`. Update factory functions with graceful "not compiled" errors.

### A-03: Add LRU eviction to proxy client cache
- **Priority:** P1 (do soon)
- **Effort:** Low
- **Impact:** `RUNTIME_PROXY_CLIENT_CACHE` grows unbounded. Each entry holds a reqwest Client with its own connection pool.
- **Implementation:** Replace `HashMap` with `lru::LruCache` (already audited crate). Set max capacity to 32 or make configurable.

### A-04: Implement configurable prompt size limits
- **Priority:** P1 (do soon)
- **Effort:** Low
- **Impact:** Files injected into system prompt (AGENTS.md, SOUL.md, MEMORY.md) have no size limit. A 1MB file wastes tokens and money.
- **Implementation:** Add `max_prompt_file_bytes` to `AgentConfig` (default: 32KB). Truncate files with `[...truncated]` marker in `inject_workspace_file()`.

### A-05: Pre-sort classification rules at config load time
- **Priority:** P2 (plan for)
- **Effort:** Low
- **Impact:** Rules sorted by priority on every `classify()` call. Sorting once at config load saves O(N*log(N)) per query.
- **Implementation:** Sort rules in `QueryClassificationConfig::new()` or `Config::load()`. Store as `Vec<ClassificationRule>` already sorted.

### A-06: Implement PostgreSQL full-text search
- **Priority:** P2 (plan for)
- **Effort:** Medium
- **Impact:** Current ILIKE-based keyword search is slow and doesn't support stemming, ranking, or relevance scoring.
- **Implementation:** Add `tsvector` column and `GIN` index. Use `ts_query` with `ts_rank()` for keyword scoring. Update `recall()` to use full-text search with configurable language.

### A-07: Extract memory context configuration
- **Priority:** P2 (plan for)
- **Effort:** Low
- **Impact:** `DefaultMemoryLoader` has hardcoded `limit=5` and `min_relevance_score=0.4`. Different use cases need different settings.
- **Implementation:** Add `memory_context_limit` and `memory_context_min_score` to `AgentConfig`. Pass to `DefaultMemoryLoader` constructor.

### A-08: Add WASM runtime implementation
- **Priority:** P3 (nice to have)
- **Effort:** High
- **Impact:** WASM runtime stub exists but is unimplemented. Would enable browser-based and edge deployment.
- **Implementation:** Implement `RuntimeAdapter` for WASM using `wasm-bindgen`. Restrict to tools that don't require filesystem/shell.

---

## 5b. Developer Experience

### D-01: Add pre-commit hook for test execution
- **Priority:** P0 (do now)
- **Effort:** Low
- **Impact:** Current `.githooks/pre-commit` exists but may not be installed by default. Catching test failures before commit saves CI time.
- **Implementation:** Update `bootstrap.sh` to configure `git config core.hooksPath .githooks`. Add quick test subset (unit tests only, skip integration) to pre-commit hook.

### D-02: Add cargo-deny to CI for all PRs
- **Priority:** P0 (do now)
- **Effort:** Low
- **Impact:** License and advisory checks currently run on push to main and weekly schedule, but not on all PRs. Could merge incompatible licenses.
- **Implementation:** Add `cargo deny check advisories licenses` step to `ci-run.yml` for all pull_request triggers.

### D-03: Set deny.toml wildcards to "deny"
- **Priority:** P1 (do soon)
- **Effort:** Low
- **Impact:** `wildcards = "allow"` permits `*` versions in lockfile, undermining reproducibility.
- **Implementation:** Change `deny.toml` line 38 from `wildcards = "allow"` to `wildcards = "deny"`.

### D-04: Lower clippy complexity thresholds
- **Priority:** P1 (do soon)
- **Effort:** Low
- **Impact:** `cognitive-complexity-threshold = 30` is too permissive. Industry standard is 10-15.
- **Implementation:** Lower `clippy.toml` threshold to 15. Fix any new warnings (likely in `onboard/wizard.rs` and `config/schema.rs`).

### D-05: Add integration test timeouts
- **Priority:** P1 (do soon)
- **Effort:** Low
- **Impact:** E2E tests have no timeout constraints; can hang CI indefinitely.
- **Implementation:** Add `#[tokio::test(start_paused = true)]` or explicit `tokio::time::timeout()` wrappers to all async tests.

### D-06: Improve test assertions specificity
- **Priority:** P2 (plan for)
- **Effort:** Medium
- **Impact:** Many tests use `assert!(!response.is_empty())` instead of checking specific content.
- **Implementation:** Replace weak assertions with `assert_eq!()` or `assert!(response.contains("expected"))` throughout `tests/agent_e2e.rs`.

### D-07: Add Python test coverage for tool execution
- **Priority:** P2 (plan for)
- **Effort:** Medium
- **Impact:** Python tests check `hasattr(tool, "invoke")` but never actually call tools. Path traversal fix is untested.
- **Implementation:** Add tests that actually invoke `file_read`, `shell`, `memory_store` with both valid and malicious inputs. Use `pytest-tmp-files` for filesystem tests.

### D-08: Structured error types for tools
- **Priority:** P2 (plan for)
- **Effort:** Medium
- **Impact:** Tools return `anyhow::Result` with string errors. Callers can't distinguish "file not found" from "permission denied" programmatically.
- **Implementation:** Create `ToolError` enum with variants: `NotFound`, `PermissionDenied`, `Timeout`, `RateLimit`, `ValidationError`, `ExecutionError`. Implement `From<ToolError> for anyhow::Error`.

---

## 5c. Feature & Capability Enhancements

### F-01: Add conversation threading for multi-user channels
- **Priority:** P1 (do soon)
- **Effort:** Medium
- **Impact:** Currently all messages in a channel share one conversation. In multi-user channels (Discord, Slack), this creates context mixing.
- **Implementation:** Add `session_id` tracking per user/thread. Route conversations through session-specific agent instances or history partitions.

### F-02: Add streaming response support for channels
- **Priority:** P1 (do soon)
- **Effort:** Medium
- **Impact:** Channels like Discord and Telegram support message editing. Streaming responses would significantly improve perceived latency.
- **Implementation:** Implement `supports_draft_updates()` for Discord/Telegram channels. Use provider's `stream_chat_with_history()` and progressively update the message.

### F-03: Add memory export/import CLI commands
- **Priority:** P2 (plan for)
- **Effort:** Low
- **Impact:** Users can't easily backup, migrate, or inspect their agent's memory.
- **Implementation:** Add `zeroclaw memory export --format json/markdown` and `zeroclaw memory import` commands. Use existing `snapshot.rs` infrastructure.

### F-04: Add multi-agent collaboration
- **Priority:** P2 (plan for)
- **Effort:** High
- **Impact:** Current `delegate` tool supports sub-agent calls but lacks coordination, shared context, and result aggregation.
- **Implementation:** Add `AgentPool` with named agents, shared memory context, and result aggregation. Implement turn-taking protocol for agent-to-agent communication.

### F-05: Add voice input/output support
- **Priority:** P3 (nice to have)
- **Effort:** High
- **Impact:** Would enable hands-free interaction, especially valuable for robot-kit users.
- **Implementation:** Integrate with whisper-cpp (already referenced in robot-kit config) for STT. Use piper TTS (already in robot-kit). Add `VoiceChannel` implementation.

---

## 5d. Operational & Infrastructure

### O-01: Add structured health check endpoint
- **Priority:** P0 (do now)
- **Effort:** Low
- **Impact:** Current health check returns basic status. Kubernetes/Docker health probes need structured JSON with per-component status.
- **Implementation:** Add `/health/ready` and `/health/live` endpoints. Return JSON with component statuses: `{"status": "ok", "components": {"memory": "ok", "provider": "ok", ...}}`.

### O-02: Add graceful shutdown with drain
- **Priority:** P1 (do soon)
- **Effort:** Medium
- **Impact:** Current Ctrl+C handler stops immediately. In-flight requests are dropped.
- **Implementation:** Add shutdown signal handler that: (1) stops accepting new requests, (2) waits for in-flight requests (with timeout), (3) flushes memory/cache, (4) closes connections.

### O-03: Add configuration hot-reload
- **Priority:** P2 (plan for)
- **Effort:** Medium
- **Impact:** Config changes currently require restart. For long-running daemons, this means downtime.
- **Implementation:** Watch config file with `notify` crate. On change, reload non-structural config (model, temperature, rate limits) without restart. Log changes to audit log.

### O-04: Add backup automation
- **Priority:** P2 (plan for)
- **Effort:** Low
- **Impact:** SQLite memory database has no automatic backup. Corruption or accidental deletion loses all memories.
- **Implementation:** Add periodic SQLite `VACUUM INTO` backup to configurable location. Integrate with `hygiene.rs` schedule. Add retention policy (keep N backups).

### O-05: Add container image size optimization
- **Priority:** P2 (plan for)
- **Effort:** Low
- **Impact:** Multi-stage Dockerfile could be further optimized. Current image includes unnecessary files.
- **Implementation:** Use `scratch` or `distroless` base image for final stage. Ensure static linking with musl. Strip debug symbols (already done in release profile).

### O-06: Add Kubernetes deployment manifests
- **Priority:** P3 (nice to have)
- **Effort:** Medium
- **Impact:** Users deploying to Kubernetes need to create their own manifests.
- **Implementation:** Add `deploy/k8s/` with Deployment, Service, ConfigMap, Secret, HPA, PDB manifests. Add Helm chart for customization.

---

## 5e. Security Hardening

### S-01: Add constant-time comparison for all token verification
- **Priority:** P0 (do now)
- **Effort:** Low
- **Impact:** While `pairing.rs` uses constant-time comparison, other token checks (gateway bearer, webhook signatures) may use `==` which is timing-attack vulnerable.
- **Implementation:** Audit all token/signature comparisons. Replace `==` with `ring::constant_time::verify_slices_are_equal()` or `subtle::ConstantTimeEq`.

### S-02: Add Content Security Policy headers to gateway
- **Priority:** P1 (do soon)
- **Effort:** Low
- **Impact:** Gateway serves HTTP responses without security headers. If any response is rendered in a browser, XSS attacks are possible.
- **Implementation:** Add tower middleware for headers: `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Content-Security-Policy: default-src 'none'`, `Strict-Transport-Security` (if HTTPS).

### S-03: Add per-IP rate limiting to gateway
- **Priority:** P1 (do soon)
- **Effort:** Medium
- **Impact:** Current rate limiter is global. A single client can exhaust the rate limit, denying service to all others.
- **Implementation:** Add IP-based buckets to `SlidingWindowRateLimiter`. Use `X-Forwarded-For` or `X-Real-IP` behind reverse proxy. Add configurable per-IP and global limits.

### S-04: Add automated dependency vulnerability scanning
- **Priority:** P1 (do soon)
- **Effort:** Low
- **Impact:** `cargo audit` runs weekly via `sec-audit.yml` but vulnerabilities could persist for up to a week.
- **Implementation:** Add `cargo audit` to PR CI pipeline. Configure Dependabot security alerts. Add `cargo-deny advisories` check to pre-commit hook.

### S-05: Add TLS certificate pinning for critical APIs
- **Priority:** P2 (plan for)
- **Effort:** Medium
- **Impact:** MITM attacks on LLM API calls could intercept prompts and responses containing sensitive data.
- **Implementation:** Add certificate pinning for Anthropic, OpenAI, and Google APIs using `reqwest` custom TLS configuration. Allow override via config for corporate proxies.

### S-06: Add secret rotation automation
- **Priority:** P2 (plan for)
- **Effort:** Medium
- **Impact:** Secret store encryption key (`~/.zeroclaw/.secret_key`) is generated once and never rotated.
- **Implementation:** Add `zeroclaw auth rotate-key` command. Re-encrypt all secrets with new key. Backup old key for rollback.

### S-07: Add network egress allowlist
- **Priority:** P2 (plan for)
- **Effort:** Medium
- **Impact:** Shell tool and HTTP request tool can make connections to arbitrary hosts. Network-level restriction would add defense-in-depth.
- **Implementation:** Add `allowed_egress_hosts` to `SecurityConfig`. Enforce at `http_request` tool and shell command level. Default to LLM API hosts + configured webhook endpoints.

### S-08: Firmware authentication
- **Priority:** P2 (plan for)
- **Effort:** Medium
- **Impact:** All firmware (Arduino, ESP32, Nucleo, Uno Q Bridge) accepts commands with no authentication. Any serial/network device can control GPIO.
- **Implementation:** Add HMAC-SHA256 pairing protocol to firmware. Use shared secret from config. Add replay protection with nonces.

---

## Priority Summary

| Priority | Count | Category Breakdown |
|----------|-------|--------------------|
| P0 (do now) | 5 | A-01, D-01, D-02, O-01, S-01 |
| P1 (do soon) | 12 | A-02, A-03, A-04, D-03, D-04, D-05, F-01, F-02, O-02, S-02, S-03, S-04 |
| P2 (plan for) | 14 | A-05, A-06, A-07, D-06, D-07, D-08, F-03, F-04, O-03, O-04, O-05, S-05, S-06, S-07, S-08 |
| P3 (nice to have) | 3 | A-08, F-05, O-06 |
| **Total** | **34** | |
