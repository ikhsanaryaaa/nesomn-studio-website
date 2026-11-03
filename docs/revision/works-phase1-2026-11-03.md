# Works phase1 — foundation and management

Repository: ikhsanaryaaa/nesomn-studio-website. Branch codex/radix-english-rounded-ui, starting commit3e51b30. This phase remains uncommitted; no GitHub push, production deployment or production database change. Existing user changes were preserved.

## Delivered

Dedicated portfolio_uploads, portfolio_works and portfolio_gallery tables, additive migration0008 and journal entry. Portfolio is isolated from paid assets/credits/orders. Explicit Draft/Published and Sample labels, ordered mixed gallery, optional client, date, cover and custom-link pair.

Admin Works list/create/edit under Website content, with real Radix controls, uploads, video poster selection, reorder/remove, repeat save, unsaved-change protection, errors/loading/disabled states. HTTP(S) link and slug validation agree with server rules. Edit conflicts409 preserve the draft and require confirmed reload; the API updates revision+gallery atomically. Audit records capture create/update/delete.

Admin CRUD and upload endpoints require server admin permission. Public read APIs expose published records only; media must be registered portfolio uploads and referenced by a published work. Draft/unreferenced/store-product media stay private. Image decoding and MP4/WebM container/track checks,20MiB image/100MiB video caps, bounded metadata, no browser-trusted paid/status flags. Stable preview endpoints issue300second signed URLs. Local media streams with single byte ranges206/416.

Public Works pages, navbar/AboutUs/footer, the one Nesomn StudioKit sample and later3D refinements are not part of this phase. No sample is auto-seeded.

## Files and operation

api/src/db/schema/portfolio.ts, api/drizzle/0008_portfolio.sql, api/src/modules/portfolio/*, admin/src/pages/works* and routes/resources/App; storage byte-range helper; tests and repeatable portfolio lab. See [portfolio runbook](../portfolio.md) for API fields, limits, private storage, retention and exact migration procedure.

Back up and inspect the actual existing schema before deploying. Run the explicit migrator from /app/api in the new image; startup never migrates/reset/seeds. Readiness requires the portfolio tables. No new environment variable or package dependency. Bun1.4.4/Elysia1.4.30/Radix Themes3.3.0 stay unchanged.

## Verification

- node scripts/release-check.mjs unit: PASS all16 gates, including frozen install/audit/typecheck/lint/build/Compose/security/scene/navigation and the new portfolio unit tests.
- bun test tests/portfolio.test.ts admin/tests/works-api.test.ts: PASS5tests/27assertions, unsafe/incomplete metadata, real raster/video containers, invalid/truncated bytes, ranges and payload projection.
- node scripts/test-portfolio-lab.mjs: PASS. Old migrations0–7 applied to disposable PostgreSQL, existing-user fixture inserted, migration8 applied and rerun, legacy user preserved. Real API suite PASS34assertions: roles, private-media isolation, publication gating, mixed gallery/order, signed-file range delivery, duplicate slug and concurrent-save409.
- Same lab: production Docker app build/start, readiness, admin Works deep links, public API and anonymous admin401 PASS. Main deployment remains exactly app+gateway.
- node admin/tests/works-browser.mjs: PASS explicit offline API/media fixture, real file bytes, create/edit/repeatedsave, upload/reorder/error, conflict retention/reload/focus,360/390/768/1024/1440 × light/dark, no overflow/exceptions.
- Actual MP4 and WebM fixture playback in Chrome156 Windows: metadata0.4s, muted test playback to0.4s/ended, posters and mixed order preserved. This is gallery playback, not the previously failing3D canvas WebM export.
- Independent source/visual review checked form control consistency, conflict behavior and selected desktop/mobile screenshots. Real public TLS/OAuth/production data were not exercised.

[Measurements and commands](artifacts/works-phase1-2026-11-03/verification.json) · [Desktop form/error state](artifacts/works-phase1-2026-11-03/admin-1793699663916/works-light-1440.png) · [Mobile gallery](artifacts/works-phase1-2026-11-03/admin-1793699663916/mixed-gallery-dark-390.png) · [Decoded video](artifacts/works-phase1-2026-11-03/admin-1793699663916/decoded-video-webm-390.png).

## Cleanup and limits

Own app/test DB/Redis containers and image tags removed; verification records zero remaining own resources. Shared pre-existing images, volumes and unrelated resources were preserved. No global prune; Docker build cache untouched.

Uploaded files intentionally survive cancellation/removal/work deletion because other works may reference them; unreferenced uploads are private. No automatic garbage collector or video transcoder. Published signed URLs may remain usable until their300second expiry after unpublishing. Use browser-compatible clips and verify live storage/CORS/TLS at deployment. This phase is not a blanket production-ready claim.
