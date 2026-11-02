# Phase 10 execution ledger

Repository nesomn-studio-website, branch works/runtime-tooling-upgrade, baseline phase-10-input.json. All pre-existing changes preserved; no production data or deployment.

Audit: phase9 regressions are absent from CI; browser harnesses hardcode Windows Chrome and historical lab ports/artifact directories. Existing suites cover integrity but no single repeatable release gate records their results and cleans Docker test images/containers on failure. Deployment docs contain historical limitations that need an explicit current as-built/release decision.

Safe changes: release check runner/guard tests, portable isolated browser harness configuration, synthetic production lab with bounded cleanup, CI phase9 gates/artifacts, acceptance evidence and release/backup/cutover runbook. No framework/domain/schema migration. Bun/Elysia remains pinned; supporting dependency changes are justified by the audit. Historical signed media references remain a manual reconciliation task.

Plan: unit/install/build baseline; isolated DB and existing integration suites; app/gateway + independent AI/QRIS images; production browser flows across surfaces and responsive themes; fix reproducible findings; final scoped cleanup and documented GO/NO-GO. Every untested live dependency is SKIPPED/BLOCKED, not PASS.

Security audit: initial 66 advisories (1 critical/40 high/23 moderate/2 low). Reviewed within-range audit-fix plan resolved 55; explicit Drizzle/Sharp/Zod/tooling upgrades and three compatibility-tested transitive overrides resolved the rest. Native Refine REST adapter removes unsafe query-string/decode chain. No force/peer bypass/advisory ignore. See dependency-security.md.

Concrete fixes: Zod4 PATCH defaults preserve omitted fields through parsePatch; bundle picker points to guarded cross-editor options; bundle metadata/membership and PUT replace-set are transactional with locks, existing-asset validation and bounded deduplication. Tests cover rollback/concurrent replacement and actual UI create/edit. Admin favicon references the original logo.

Final checks/logs/limitations: phase-10-report.md. Intermediate harness expectation failures (422 validation and computed searchVector) were corrected; no production data was changed.

Final visual inspection fixed clipped mobile 2D inspector: scrollable workspace under fixed toolbar. Browser390x720 checks opacity input bounds660–704,44px height and pointer hit-test, with screenshot. No scene/state/export change.
