# Phase 5 issue / execution ledger

Plan: REVISION.md phase5. Identity verified nesomn-studio-website / works/runtime-tooling-upgrade / HEAD041d225. All earlier dirty changes retained. executing-plans inline, TDD; one fresh final reviewer at end. No production DB/credentials/merchant calls/login/OTP/deployment.

Upstream read-only snapshot commit e1b1b6968c570c0cb18ccf9ce4d95694e8df48de, pyproject0.2.0 (alpha, not a production verification claim). ShopeePayPartner.transactions.list_recent(store_id,merchant_id,start_time,end_time,max_pages), completed iff status3, amount_idr whole rupiah. SDK lacks Shopee QR creation/signed invoice callbacks. Wrapper must not use watcher seed/seen-before-ACK worker. Scope+completed mandatory, durable SQLite spool/checkpoint, authenticated ingestion, replay-safe SQL fulfillment. Manual B-token renewal supported; no automated merchant login or token extraction.

Safe order / tasks:

- [x] Pure QR TLV/CRC, unique amount selection, receipt signature/schema RED->GREEN.
- [x] Additive invoice/receipt schema; atomic checkout/snapshots/idempotency, merchant/store amount reservation, expiry/late/unmatched/replay/settlement.
- [x] Actual checkout status/QR routes and minimal honest checkout UI (full redesign later), shared types and marketplace/plan/top-up callers.
- [x] Pinned upstream SDK external wrapper with durable delivery/backfill/restart, offline tests and independent Docker/runbook; no main Compose service.
- [x] Concurrency/receipt/HTTP/worker tests, frozen/type/lint/build/Docker/Compose, review and as-built report.

Ruling: require operator's static QR payload, merchant/store identity and explicit enabled flag; no invented Shopee QR endpoint. Verify CRC/currency/country/amount and disallow convenience fees. Activation fails closed without config. No live calls in tests.
Ruling: payable amounts never reused within merchant/store across invoice history. Feed has no trustworthy Nesomn invoice reference, so a late payment otherwise could satisfy a newer invoice. Cost: finite999 codes per identical base price (cross-price collisions also reserved); exhaustion503/manual review, no silent reuse. Revisit only with verifiable provider invoice references, not a guessed time window.
Ruling: legacy Stripe/Pakasir history stays quarantined, no relabel/replay. QRIS receipt settlement must use the existing same-transaction fulfillment under stable locks. No success from browser. Static QR issuer/store mapping must be checked by operator; payload alone cannot prove its link to portal IDs.
Ruling: core baseline tests unchanged; Python unavailable globally, use isolated Docker Python for wrapper tests. No install to global machine.

## Progress

Pure RED missing module -> GREEN3 tests after correcting malformed synthetic TLV fixture. Additive0007 applied only disposable DB. First QRIS integration3 passed (parallel reservation/replay, scope/completed, late/unmatched); checking HTTP/QR/UI and worker next. Quote read moved before merchant-locked transaction to avoid pool starvation under10+ concurrent requests; recheck idempotency under lock. Non-PII reservations have no cascading FK, so amount tombstones survive user-data lifecycle. Actual new store checkout routes to same QRIS flow; no history relabel.
SDK source vendored with MIT license/commit+file hashes; upstream worker.py not copied. External Python image pinned official digest, httpx + transitive stable versions exact. Python unavailable host; Docker offline wrapper5tests passed, test resource cleanup improved. No live merchant/provider call.

## Review and fix pass

Fresh reviewer phase5_final_review:0Critical,4Important,1Minor. All4Important reproduced with RED tests, then fixed: isolate receipt failures, deliver persisted spool independently of provider, separate forward checkpoint/unresolved backfill with30day review and round-robin, reject incompatible subscription pre-invoice + classify settlement business conflict using savepoint while transient DB errors remain retryable. Minor status refresh regraded Important because timely payment may settle after expiry; explicit refresh is now available for expired/reconciliation invoice. No live claims waived; no deferred minor.
API regression8passed35assertions; Python8offline tests passed after fix (including SDK scope/whole rupiah, ACK loss/restart, provider outage, poison first receipt, old unresolved). Extra16KiB bounded raw-reader added, tested separately. Quote locked transaction uses pre-read server quote to avoid pooled-connection starvation; invoice/receipt effects stay atomic.
Production HTTP+Chrome390/1440 passed with ephemeral browser profile/cookie for synthetic user only. Actual SDK normalizer -> SQLite -> raw HMAC -> app settlement tested with ACK deliberately lost aftercommit; second container restart delivered replay, final10credits once. No merchant calls. Screenshot inspection batch1 showed no horizontal overflow; minor visual fix negative zero discount/nested landmark/QR error feedback and bottom mobile screenshot, one confirmation batch next. Incumbent theme retained; monokrom-orange redesign phase6.

## Final acceptance

Frozen no-env install, typecheck5, lint0errors2existingwarnings, build, QRIS9/37assertions, security38/186assertions, baseline22unit+24integration, deployment13/93assertions, Node11, Docker app/AI/QRIS images and Python8offline PASS. Main Compose app/gateway exactly. Gateway7HTTP PASS; final compiled Chrome checkout360/390/768/1024/1440 no horizontal overflow, QR and paid states. SDKnormalizer->durableSQLite->HMAC->app with ACK lost aftercommit and container restart:10credits once. Final visual confirmation mobile bottom/desktop accepted; existing theme maintained for phase6. Vendor25hashes and seven prior SQL unchanged. Runbook, report/evidence/review complete. QRIS defaultdisabled; no merchant/wallet/TLS/production/remoteCI claims. No deferred minor findings; no further reviewer pass claimed.
