# QRIS ShopeePay automatic session refresh — 2 November 2026

Repository nesomn-studio-website; branch codex/qris-session-refresh, based on origin/main b1ab195 after PR27 merged. SDK vendored commit e1b1b6968c570c0cb18ccf9ce4d95694e8df48de unchanged; no dependency/runtime/schema changes.

## Implemented

- Complete SDK session JSON seed, read-only/private mode0600, bound to configured merchant/store/account.
- Periodic refresh (default1800s; configurable300–86400s) and one reactive refresh on payment token codes200020/2010000 or HTTP401.
- New cookies/token persisted atomically before polling resumes; mode0700 state directory, mode0600 state/lock, fsync+rename and Linux single-writer lock.
- Latest rotated state and exponential backoff survive restart. Changed valid seed enables reauthentication recovery; identical seed does not reset login_required.
- Dead parent session/CAPTCHA/incomplete renewal requires authorized login; no automated OTP, credential extraction or bypass.
- Readiness exposes only allowlisted session status and returns503 for login_required, even with fresh old heartbeat.
- Existing SQLite spool delivery runs before/after failed polling; payment matching, HMAC, credit/entitlement settlement and replay protection unchanged.
- Legacy SHOPEE_TOKEN_FILE mode remains when SHOPEE_SESSION_FILE is unset. Templates now recommend JSON mode.

Code: integrations/qris/session_manager.py, worker.py, health_http.py, test_session_manager.py/test_worker.py, canonical and generated QRIS Dockerfile. Env examples, secret exclusions, README and [session runbook](../qris-session.md) updated. Main Compose remains exactly app/gateway.

## Verification

| Check                                                         | Result                                                                                                                                                                                                                            |
| ------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Litepod QRIS Dockerfile build with repository root context    | PASS; [log](artifacts/qris-session-2026-11-02/build.log)                                                                                                                                                                          |
| QRIS image: python -m unittest -v test_worker, network none   | PASS, 27 tests; [log](artifacts/qris-session-2026-11-02/offline.log)                                                                                                                                                              |
| Pinned SDK auth.refresh_session with httpx.MockTransport      | PASS; account login_status, SSO token/cookie rotation and zero OTP requests                                                                                                                                                       |
| Failure cases                                                 | PASS: periodic/reactive retry, token rejection loop guard, dead account/CAPTCHA latch, restart/backoff, scope mismatch, permissions/symlink, atomic write failure, lock, new-seed recovery, health and persisted receipt delivery |
| bun run typecheck                                             | PASS, five workspaces; [log](artifacts/qris-session-2026-11-02/typecheck.log)                                                                                                                                                     |
| bun run lint                                                  | PASS, two existing Fast Refresh warnings; [log](artifacts/qris-session-2026-11-02/lint.log)                                                                                                                                       |
| node --test tests/litepod-build.test.mjs                      | PASS, two tests; [log](artifacts/qris-session-2026-11-02/build-contract.log)                                                                                                                                                      |
| node scripts/test-qris.mjs unit                               | PASS, four tests/12 assertions; [log](artifacts/qris-session-2026-11-02/qris-unit.log)                                                                                                                                            |
| node scripts/check-deployment.mjs                             | PASS; [log](artifacts/qris-session-2026-11-02/compose.log)                                                                                                                                                                        |
| Actual merchant renewal/login/OTP/feed and Litepod deployment | SKIPPED; no live credentials or transactions used                                                                                                                                                                                 |

Bun1.4.4 pinned runtime via releaseEnvironment('unit') used for JS/TS checks; no production .env loaded. Docker test uses synthetic session objects and MockTransport, with network none. The test QRIS container and image tag were removed after each run; [final cleanup](artifacts/qris-session-2026-11-02/cleanup.json). No global prune or volume/production data deletion.

## Deployment limits

Use [docs/qris-session.md](../qris-session.md) and updated deploy/litepod/qris.env.example. Provision one valid complete session via an authorized initial login. Mount seed read-only and /data writable/persistent UID10001. Preserve the HMAC key and spool. Do not send sessions through frontend/Git/log/chat. One poller per merchant/store; stop/drain before rollout.

Automatic merchant token renewal depends on the parent Shopee account session staying alive. Live contract/duration is not guaranteed by offline tests. AUTH_REQUIRED/login_required still needs an authorized login and a new private seed. QRIS remains disabled by default; no DB migration, paid status change, merchant transaction or production rollout was performed.
