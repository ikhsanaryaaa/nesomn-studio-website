# Phase 9 execution ledger

Baseline: phase-9-input.json; existing changes preserved.

Audit: 2D viewport uses fixed window deductions; export does not restore on exception and includes selection tools; AI polling allows a second job before first response, tab changes lose local job selection, failed balance becomes zero; admin default resource is invalid and subscription/ledger APIs lack UI.

Safe order: export and viewport regressions; responsive 2D and layer inspector; honest AI recovery; read-only billing administration; checks and browser/deployment verification.

Scope: client/src/{pages/scene-editor,components/editor,components/ai,hooks/use-ai-job,lib/export-image}, admin/src/{App,resources,routes,pages}, api/src/web-app.ts, tests, docs. No schema changes, payment mutations or production credentials.

Verification pending; no PASS inferred from earlier phases. Docker test containers/images must be removed afterward.

Implemented and verified: responsive 2D, export restoration/logical dimensions, save lifecycle, AI recovery/pending cancel, admin lists/default resource, stable preview publication guard. No schema/dependency changes. Tests and limitations: phase-9-report.md. Cleanup complete: 18 task container removals across two passes, app/worker/nginx/redis image references removed each time; shared PostgreSQL and all volumes untouched.
