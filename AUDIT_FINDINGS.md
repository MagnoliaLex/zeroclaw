# AUDIT_FINDINGS.md — ZeroClaw Code Quality Audit

**Audit Date:** 2026-02-28
**Total Issues Found:** 98
**By Severity:** Critical: 8, High: 19, Medium: 36, Low: 27, Info: 8

---

## Critical Issues (8)

### C-01: Python shell tool allows arbitrary command injection
- **File:** `python/zeroclaw_tools/tools/shell.py:22`
- **Type:** Security — Command Injection
- **Description:** Uses `subprocess.run(command, shell=True)` which passes user input directly to the OS shell. An attacker can inject arbitrary commands via semicolons, pipes, or backticks.
- **Impact:** Full system compromise; arbitrary code execution.
- **Fix:** Use `shell=False` with `shlex.split()`, or delegate to Rust shell tool which has proper sandboxing.

### C-02: Python file_read tool has path traversal vulnerability
- **File:** `python/zeroclaw_tools/tools/file.py:25`
- **Type:** Security — Path Traversal
- **Description:** No validation of the `path` parameter. User input like `../../../etc/passwd` or `/etc/shadow` will be read without restriction.
- **Impact:** Read arbitrary files on the system including credentials, private keys.
- **Fix:** Validate path is relative to an allowed workspace root using `pathlib.Path.resolve().is_relative_to()`.

### C-03: Python file_read reads entire file before size check
- **File:** `python/zeroclaw_tools/tools/file.py:26-28`
- **Type:** Performance — OOM
- **Description:** Reads the entire file into memory (`open(path).read()`), then checks `if len(content) > MAX_FILE_SIZE`. A 1GB file will allocate 1GB before being rejected.
- **Impact:** Denial of service via memory exhaustion.
- **Fix:** Check `os.path.getsize(path)` before opening the file.

### C-04: Arduino firmware buffer overflow
- **File:** `firmware/zeroclaw-arduino/zeroclaw-arduino.ino:137-140`
- **Type:** Security — Buffer Overflow
- **Description:** `lineBuf[MAX_LINE=256]` is filled char-by-char without proper bounds checking. The overflow case resets `lineLen = 0` but `lineBuf[lineLen++] = c` at line 138 does not verify `lineLen < MAX_LINE` before the write.
- **Impact:** Memory corruption on embedded device; potential code execution.
- **Fix:** Add explicit bounds check: `if (lineLen < MAX_LINE - 1) { lineBuf[lineLen++] = c; }`.

### C-05: ESP32 firmware panics on malformed JSON
- **File:** `firmware/zeroclaw-esp32/src/main.rs:98`
- **Type:** Reliability — Panic on Invalid Input
- **Description:** `serde_json::from_str::<Request>()` will panic on invalid JSON, causing firmware crash that requires physical reboot.
- **Impact:** Denial of service to hardware device via malformed serial input.
- **Fix:** Use `match` or `if let Ok()` pattern; send error JSON response instead of panicking.

### C-06: Merge conflict in PR template
- **File:** `.github/pull_request_template.md:15-19`
- **Type:** Configuration — Merge Conflict
- **Description:** Active merge conflict markers (`<<<<<<< ... ======= ... >>>>>>>`) present in the PR template. Every new PR shows conflict markers to contributors.
- **Impact:** Broken PR workflow; confuses contributors.
- **Fix:** Resolve conflict markers manually.

### C-07: Python web tool header injection
- **File:** `python/zeroclaw_tools/tools/web.py:31-34`
- **Type:** Security — Header Injection
- **Description:** Headers are split by comma but not validated for CRLF characters. Input like `X-Custom: value\r\nX-Injected: evil` injects additional HTTP headers.
- **Impact:** HTTP request smuggling; bypass security controls.
- **Fix:** Reject headers containing `\r` or `\n` characters.

### C-08: Uno Q Bridge command injection and no authentication
- **File:** `firmware/zeroclaw-uno-q-bridge/python/main.py:22-25`
- **Type:** Security — Command Injection + Missing Auth
- **Description:** Accepts socket connections on port 9999 with no authentication. Parses commands with `data.split()` and passes directly to Bridge. `int()` conversion has no try-except.
- **Impact:** Any network client can control GPIO pins; crashes on invalid input.
- **Fix:** Add authentication (HMAC pairing), input validation, and try-except blocks.

---

## High Issues (19)

### H-01: Anthropic provider silently drops tool calls during parsing
- **File:** `src/providers/anthropic.rs:233`
- **Type:** Bug — Data Loss
- **Description:** `parse_assistant_tool_call_message()` returns `None` for content blocks marked as `tool_use`, silently losing tool calls when reconstructing messages from storage.

### H-02: Gemini API key exposed in URL query parameter
- **File:** `src/providers/gemini.rs:268`
- **Type:** Security — Credential Exposure
- **Description:** For API key authentication, the key is included in the URL query string. This causes the key to appear in server access logs, proxy logs, and browser history.
- **Fix:** Use `x-goog-api-key` header instead.

### H-03: Discord channel uses hand-written base64 decoder
- **File:** `src/channels/discord.rs:148-170`
- **Type:** Security — Unsafe Implementation
- **Description:** Custom base64 decoding implementation without bounds checking on character indices (line 164-170). Could panic or produce incorrect results on malformed input.
- **Fix:** Use the `base64` crate which is already a dependency.

### H-04: Proxy client cache grows unbounded
- **File:** `src/config/schema.rs:42-44`
- **Type:** Performance — Memory Leak
- **Description:** `RUNTIME_PROXY_CLIENT_CACHE` is a `HashMap` that caches reqwest clients indefinitely. If many different proxy URLs are used over time, memory grows without bound.
- **Fix:** Add LRU eviction or max-size limit.

### H-05: Prompt file injection has no size limit
- **File:** `src/agent/prompt.rs:92-106`
- **Type:** Performance — Resource Exhaustion
- **Description:** Files like AGENTS.md, SOUL.md, MEMORY.md are injected into the system prompt without size limits. A 1MB MEMORY.md would balloon the prompt, consuming excessive tokens.
- **Fix:** Add configurable max file size for prompt injection (e.g., 32KB).

### H-06: Classification rules sorted on every query
- **File:** `src/agent/classifier.rs:16-17`
- **Type:** Performance — Unnecessary Computation
- **Description:** `classify()` sorts rules by priority on every call. With N rules and M messages, this is O(N*log(N)*M) instead of O(N*M).
- **Fix:** Sort rules once during config initialization.

### H-07: Credential scrubbing patterns may miss variants
- **File:** `src/agent/loop_.rs:25-40`
- **Type:** Security — Incomplete Scrubbing
- **Description:** `SENSITIVE_KV_REGEX` pattern matches specific patterns but may miss variants like `api.key=`, underscore variations, or non-ASCII credentials. False negatives could leak credentials in logs.

### H-08: TOCTOU in OAuth state file management
- **File:** `src/main.rs:797-821`
- **Type:** Security — Race Condition
- **Description:** `save_pending_openai_login()` creates a temp file then renames to final path. Between steps, another process could race. Additionally, `timestamp_nanos_opt().unwrap_or_default()` returns 0 on clock failure, making filenames predictable.

### H-09: API key leaked in embedding error messages
- **File:** `src/memory/embeddings.rs:128`
- **Type:** Security — Credential Exposure
- **Description:** When the embedding API fails, error messages may include the API key passed in the Authorization header.
- **Fix:** Redact API key before including in error messages.

### H-10: PostgreSQL memory has no connection pooling
- **File:** `src/memory/postgres.rs`
- **Type:** Performance — Blocking
- **Description:** Single shared `Arc<Mutex<Client>>` blocks all concurrent memory operations. Under load, all requests serialize through one connection.
- **Fix:** Use a connection pool (e.g., `deadpool-postgres` or `bb8`).

### H-11: Vector BM25 normalization bug
- **File:** `src/memory/vector.rs:100`
- **Type:** Bug — Incorrect Calculation
- **Description:** `fold(0.0_f32, f32::max)` in BM25 normalization doesn't accumulate properly — it finds the maximum instead of normalizing. This produces incorrect hybrid search scores.

### H-12: Service tests fail due to login shell environment
- **File:** `src/service/mod.rs:368-380`
- **Type:** Bug — Flaky Tests
- **Description:** Tests use `sh -lc` (login shell) which sources user profile (e.g., nvm), producing extra stdout output. Test assertion `assert_eq!(out.trim(), "hello")` fails when profile output is present.
- **Fix:** Use `sh -c` instead of `sh -lc` to avoid profile sourcing.

### H-13: Onboard wizard test has stale assertion
- **File:** `src/onboard/wizard.rs:5194-5207`
- **Type:** Bug — Stale Test
- **Description:** `run_models_refresh_rejects_unsupported_provider` expects "venice" to not support live model discovery, but `supports_live_model_fetch()` at line 879 includes "venice" in supported list.
- **Fix:** Use a truly unsupported provider in the test (e.g., "nonexistent_provider").

### H-14: Hardcoded owner allowlist with real GitHub usernames
- **File:** `.github/workflows/scripts/ci_workflow_owner_approval.js:13-18`
- **Type:** Security/Privacy — PII in Code
- **Description:** Real GitHub usernames hardcoded in `baseOwners` array, violating the project's privacy policy (CLAUDE.md section 9.1).

### H-15: Docker publish unsafe token parsing
- **File:** `.github/workflows/pub-docker-img.yml:173-174`
- **Type:** Security — Unsafe Parsing
- **Description:** Uses `sed` for JSON token extraction instead of `jq`. Fragile to format changes; could extract invalid tokens silently.

### H-16: Python system prompt injection risk
- **File:** `python/zeroclaw_tools/agent.py:102`
- **Type:** Security — Prompt Injection
- **Description:** User-provided `system_prompt` parameter is injected without validation. Malicious prompts could override safety constraints.

### H-17: Nucleo firmware buffer overflow risk
- **File:** `firmware/zeroclaw-nucleo/src/main.rs:120`
- **Type:** Bug — Buffer Overflow
- **Description:** `id_buf: [u8; 16]` fixed-size buffer copies JSON ID without checking `j < out.len() - 1` until inside the loop. IDs > 16 chars overflow.

### H-18: Python memory store not atomic
- **File:** `python/zeroclaw_tools/tools/memory.py:28-33`
- **Type:** Bug — Data Corruption
- **Description:** Writes JSON directly to file without temp file + rename pattern. Process crash mid-write corrupts the memory store; next read returns `{}`.

### H-19: Cosine similarity silently clamps negative values
- **File:** `src/memory/vector.rs:32-33`
- **Type:** Bug — Data Loss
- **Description:** Clamp to 0.0-1.0 silently loses information about opposite vectors (cosine similarity can be -1.0). Semantic search for antonyms would show 0 instead of negative correlation.

---

## Medium Issues (36)

### M-01: Anthropic drops multiple system messages silently
- **File:** `src/providers/anthropic.rs:291-292`
- **Description:** Only the first system message is preserved; later system messages are silently discarded without warning.

### M-02: Anthropic cache threshold uses bytes instead of tokens
- **File:** `src/providers/anthropic.rs:186-187`
- **Description:** Cache threshold (3072) is in bytes, not tokens. Token count varies significantly by encoding, leading to imprecise caching decisions.

### M-03: OpenAI Codex SSE parser edge case
- **File:** `src/providers/openai_codex.rs:262`
- **Description:** `parse_sse_text()` uses `idx + 2` to skip double newlines without bounds checking.

### M-04: Ollama missing tool call IDs
- **File:** `src/providers/ollama.rs:195`
- **Description:** `format_tool_calls_for_loop()` ignores `None` IDs without generating one, producing tool calls without identifiers.

### M-05: Gemini error messages not sanitized
- **File:** `src/providers/gemini.rs:380-381`
- **Description:** Raw API error text sent to user without sanitization; could contain sensitive nested error details.

### M-06: GLM JWT payload uses raw string formatting
- **File:** `src/providers/glm.rs:126-128`
- **Description:** JWT payload assembled via `format!()` instead of proper JSON structures. Fragile to escaping issues.

### M-07: Copilot token directory race condition
- **File:** `src/providers/copilot.rs:180-184`
- **Description:** Token directory creation doesn't handle concurrent process races.

### M-08: Router provider silently skips unknown routes
- **File:** `src/providers/router.rs:53-59`
- **Description:** Unknown provider routes are warned but skipped; no error propagation to caller.

### M-09: Telegram path traversal in attachment validation
- **File:** `src/channels/telegram.rs:133-134`
- **Description:** `Path::new(candidate).exists()` doesn't validate against path traversal attacks.

### M-10: Telegram JSON UTF-8 boundary issues
- **File:** `src/channels/telegram.rs:183-189`
- **Description:** `extract_first_json_end()` iterates bytes without proper UTF-8 boundary validation.

### M-11: Telegram triple-newline replacement is O(n^2)
- **File:** `src/channels/telegram.rs:245-246`
- **Description:** Triple-newline replacement in a loop has quadratic complexity for messages with many newlines.

### M-12: Discord heartbeat poisoned lock risk
- **File:** `src/channels/discord.rs:288-295`
- **Description:** `Arc<Mutex<>>` used for heartbeat state doesn't handle poisoned locks; could panic on contention.

### M-13: Slack timestamp comparison fragile
- **File:** `src/channels/slack.rs:157`
- **Description:** String comparison `ts <= last_ts.as_str()` used for float timestamp ordering. Fails for extreme values.

### M-14: Pushover .env comment parsing truncates values
- **File:** `src/tools/pushover.rs:38`
- **Description:** Strips comments after `" #"` in unquoted values. Values containing `" #"` are silently truncated.

### M-15: Markdown memory O(n) substring scanning
- **File:** `src/memory/markdown.rs:198`
- **Description:** `get()` uses substring matching on all content — expensive O(n) scan for every lookup.

### M-16: Markdown memory forget returns false (append-only)
- **File:** `src/memory/markdown.rs:213-216`
- **Description:** `forget()` intentionally returns false, but callers may expect deletion to succeed.

### M-17: SQLite memory embedding cache may exhaust memory
- **File:** `src/memory/sqlite.rs`
- **Description:** Default embedding cache size (10,000) could exhaust memory with large models (1536-dim float32 = ~23MB at 4K entries).

### M-18: Postgres memory has no ILIKE-based full-text search
- **File:** `src/memory/postgres.rs:214-215`
- **Description:** Keyword scoring uses simple ILIKE (2.0 weight key, 1.0 weight content) instead of PostgreSQL native full-text search.

### M-19: Chunker token estimate is English-only
- **File:** `src/memory/chunker.rs:27`
- **Description:** Token estimate (4 chars per token) breaks for CJK languages where characters map roughly 1:1 to tokens.

### M-20: Hygiene state file has no locking
- **File:** `src/memory/hygiene.rs`
- **Description:** State stored as JSON with no locking between concurrent zeroclaw instances. Race condition on concurrent runs.

### M-21: Gateway body size limit hardcoded
- **File:** `src/gateway/mod.rs:37-38`
- **Description:** Request body size hardcoded to 65KB with no config option.

### M-22: Gateway rate limiter minimum too low
- **File:** `src/gateway/mod.rs:79`
- **Description:** `max_keys` is min'd to 1, but 1 key per window is effectively useless.

### M-23: Runtime native hardcoded shell path
- **File:** `src/runtime/native.rs:42-44`
- **Description:** Hardcoded `"sh"` with `-c` flag may fail on systems where `sh` is a symlink to incompatible shell.

### M-24: Dispatcher XML substring slicing without bounds check
- **File:** `src/agent/dispatcher.rs:45-47`
- **Description:** Uses `&remaining[start..start + end]` without verifying end doesn't exceed remaining length.

### M-25: Agent default model hardcoded in multiple places
- **File:** `src/agent/agent.rs:194,270`
- **Description:** Default model "anthropic/claude-sonnet-4-20250514" hardcoded in two locations; must be updated in both if model changes.

### M-26: Agent auto-save happens before tool execution
- **File:** `src/agent/agent.rs:429-433`
- **Description:** User message auto-saved to memory before tool execution completes. If tool modifies context, memory has stale version.

### M-27: Memory context concatenation may merge messages
- **File:** `src/agent/agent.rs:445-446`
- **Description:** `format!("{context}{user_message}")` concatenates directly; missing newline separator causes messages to merge.

### M-28: Memory loader has hardcoded limit and threshold
- **File:** `src/agent/memory_loader.rs:20-21,26-31`
- **Description:** Default limit=5, min_relevance_score=0.4 hardcoded; should be configurable.

### M-29: Python unbounded message history
- **File:** `python/zeroclaw_tools/__main__.py:102-121`
- **Description:** Accumulates all messages in history list without size limit. Long sessions consume unbounded memory.

### M-30: Python API key validation too late
- **File:** `python/zeroclaw_tools/agent.py:43-52`
- **Description:** API key checked in constructor but not validated as actually usable until first LLM call.

### M-31: Benchmark payloads unrepresentative
- **File:** `benches/agent_benchmarks.rs:143-176`
- **Description:** Tool dispatch benchmarks use ~100 byte payloads; real agent responses are 10KB+.

### M-32: E2E tests have no timeout constraints
- **File:** `tests/agent_e2e.rs:200-354`
- **Description:** `tokio::test` without explicit timeouts. Long-running operations could hang CI indefinitely.

### M-33: E2E tests use weak assertions
- **File:** `tests/agent_e2e.rs:207,225,320,348`
- **Description:** Only `assert!(!response.is_empty())` without validating specific content. Silent regressions can pass.

### M-34: Clippy complexity threshold too high
- **File:** `clippy.toml:5-13`
- **Description:** `cognitive-complexity-threshold = 30` allows very complex functions. Recommended is 10-15. `array-size-threshold = 65536` allows huge stack allocations.

### M-35: deny.toml allows wildcard versions
- **File:** `deny.toml:38`
- **Description:** `wildcards = "allow"` permits `*` versions in lockfile, undermining reproducibility.

### M-36: Release workflow allows concurrent releases
- **File:** `.github/workflows/pub-release.yml:9`
- **Description:** `cancel-in-progress: false` allows multiple release builds to run concurrently for the same tag.

---

## Low Issues (27)

### L-01: Anthropic bearer token format detection is fragile
- **File:** `src/providers/anthropic.rs:178`
- **Description:** Token format `sk-ant-oat01-` is hardcoded; future formats could bypass detection.

### L-02: OpenAI Codex silently ignores timeout config errors
- **File:** `src/providers/openai_codex.rs:95-96`
- **Description:** `unwrap_or_else(|_| Client::new())` silently creates unconfigured client on error.

### L-03: Copilot duplicate permission setting
- **File:** `src/providers/copilot.rs:189-192`
- **Description:** Unix permissions set twice — once during creation and again with `set_permissions()`.

### L-04: Copilot hardcoded 120s token grace period
- **File:** `src/providers/copilot.rs:375-376`
- **Description:** Token expiry grace period not configurable; could be too aggressive for high-latency scenarios.

### L-05: CLI channel hardcoded commands
- **File:** `src/channels/cli.rs:36-37`
- **Description:** `/quit` and `/exit` commands hardcoded; don't match documented commands elsewhere.

### L-06: Discord O(n) character counting
- **File:** `src/channels/discord.rs:89`
- **Description:** `chars().count()` is O(n) for large messages; inefficient for repeated splitting checks.

### L-07: Observability OTel errors fall back to NoopObserver
- **File:** `src/observability/mod.rs:27-46`
- **Description:** OTel creation errors silently fall back to NoopObserver, swallowing configuration errors.

### L-08: Postgres excluded from onboarding
- **File:** `src/memory/backend.rs:76`
- **Description:** PostgreSQL not included in SELECTABLE_MEMORY_BACKENDS for wizard selection.

### L-09: Vector bytes_to_vec drops unaligned bytes
- **File:** `src/memory/vector.rs:312`
- **Description:** `chunks_exact()` silently drops unaligned trailing bytes, potentially producing wrong vectors.

### L-10: Response cache uses creation time, not LRU
- **File:** `src/memory/response_cache.rs:21-22`
- **Description:** TTL expiration based on `created_at`, not last access. Frequently-used entries expire too.

### L-11: Daemon state file writes every 5 seconds
- **File:** `src/daemon/mod.rs:123`
- **Description:** State file written every 5 seconds; could cause SSD write amplification.

### L-12: RAG section search is fragile
- **File:** `src/rag/mod.rs:31-56`
- **Description:** Case-insensitive section search breaks on markdown heading typos.

### L-13: Health module never prunes stale entries
- **File:** `src/health/mod.rs`
- **Description:** No pruning of stale component entries from the health table.

### L-14: Cost tracker returns 0 for invalid prices
- **File:** `src/cost/types.rs:38-39`
- **Description:** `sanitize_price()` returns 0.0 for invalid prices, silently losing cost information.

### L-15: Cron best_effort defaults to true
- **File:** `src/cron/types.rs:79`
- **Description:** `best_effort` defaults to true which could cause silent job failures.

### L-16: Migration dedup uses null byte separator
- **File:** `src/migration.rs:138-140`
- **Description:** Format string with `\u{0}` as separator could break if content contains null bytes.

### L-17: Migration key rename tries up to 10K times
- **File:** `src/migration.rs:318-327`
- **Description:** Sequential key deduplication loop; could be slow with many conflicts.

### L-18: Migration backup not atomic
- **File:** `src/migration.rs:372-421`
- **Description:** Copies files one-by-one; partial backup left if copy fails mid-operation.

### L-19: OpenAI provider accepts any non-empty credential
- **File:** `src/providers/openai.rs:387`
- **Description:** Constructor validates credential is non-empty but doesn't check format.

### L-20: Dockerignore test has incomplete glob support
- **File:** `tests/dockerignore_test.rs:46-81`
- **Description:** `pattern_matches()` has naive glob support; doesn't handle recursive patterns like `**`.

### L-21: Reply target regression test has incomplete patterns
- **File:** `tests/reply_target_field_regression.rs:10`
- **Description:** Only forbids `.reply_to` and `reply_to:` but misses variants like `reply_to(` or `"reply_to"`.

### L-22: WhatsApp security tests miss timing attack check
- **File:** `tests/whatsapp_webhook_security.rs`
- **Description:** No test validates constant-time comparison in signature verification.

### L-23: Python loose dependency version pins
- **File:** `python/pyproject.toml:33-38`
- **Description:** Dependencies like `langgraph>=0.2.0` allow any version; breaking changes in future versions.

### L-24: Python tests don't execute tools
- **File:** `python/tests/test_tools.py:8-15`
- **Description:** Tests check `hasattr(tool, "invoke")` but never actually call tools.

### L-25: Robot-kit safety monitor unmonitored
- **File:** `crates/robot-kit/src/safety.rs:76-81`
- **Description:** SafetyMonitor spawned as background task; panics silently disable safety.

### L-26: Robot-kit temp files never cleaned up
- **File:** `crates/robot-kit/src/listen.rs`, `look.rs`, `speak.rs`
- **Description:** Audio/image capture creates temp files that are never deleted.

### L-27: Robot-kit config has no validation
- **File:** `crates/robot-kit/src/config.rs:8-23`
- **Description:** Config allows invalid values like `max_speed: -1.0` without runtime validation.

---

## Info (8)

### I-01: Emoji in log messages
- **File:** `src/memory/mod.rs:124`
- **Description:** Unicode emoji in log messages could cause encoding issues in some terminals.

### I-02: Postgres unconditionally compiled
- **File:** `Cargo.toml:88`
- **Description:** postgres crate is a dependency even when not used; consider making optional.

### I-03: OpenTelemetry unconditionally compiled
- **File:** `Cargo.toml:122-125`
- **Description:** OTel export is always compiled in; should be feature-gated for minimal binary sizes.

### I-04: IdentityConfig allows dual path + inline
- **File:** `src/config/schema.rs:287-295`
- **Description:** Both `aieos_path` and `aieos_inline` can be set simultaneously.

### I-05: Hardcoded proxy service keys
- **File:** `src/config/schema.rs:12-40`
- **Description:** Adding a new provider/channel requires manually updating SUPPORTED_PROXY_SERVICE_KEYS.

### I-06: Test assertions use .unwrap() extensively
- **File:** `src/agent/tests.rs` (multiple lines)
- **Description:** Tests panic instead of failing gracefully, making failures harder to debug.

### I-07: Inconsistent module label format in templates
- **File:** `.github/workflows/scripts/pr_labeler.js:323-325`, `.github/pull_request_template.md`
- **Description:** Label format inconsistently shown as `module: component` vs `module:component`.

### I-08: GitHub workflows use pull_request_target
- **File:** `.github/workflows/pr-auto-response.yml`, `pr-intake-checks.yml`, `pr-labeler.yml`
- **Description:** `pull_request_target` has access to secrets; while only safe operations are run, this expands the attack surface.
