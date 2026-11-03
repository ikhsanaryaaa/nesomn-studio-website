# Landing, domains and Radix admin — 3 November 2026

Repository: https://github.com/ikhsanaryaaa/nesomn-studio-website
Branch: codex/radix-english-rounded-ui
Starting local commit: 3e51b30. Changes remain uncommitted; no push/merge/deployment. Existing phase9 screenshots and graphify-out were preserved.

## Implementation

UjiHub-inspired landing: generous spacing, large left-aligned heading with rounded highlight, pill actions, original sample posters, tools/workflow/pricing-link/FAQ/footer. Monochrome/orange, Bricolage headings and Poppins body/UI. All UI remains English. Real published catalogue has loading/error/retry/empty states and validates item data. No dummy products or fabricated clients/statistics.

Host dispatch serves landing at nesomn.studio, shop at shop.nesomn.studio, account workspace at /dashboard, admin at dashboard.nesomn.studio root, and API at api.nesomn.studio/api/*. /account and legacy single-domain /admin remain compatible. Missing assets/unknown API never receive HTML. Legacy redirects preserve queries and fixed origins, including double-slash protection.

API-base configuration reaches OAuth, QR images, catalogue media and persisted scene loading. Host-only HttpOnly Secure cookies remain; no parent-domain cookie. Shop/admin share API identity. Marketing CORS permits reading public catalogue only; mutation origins stay shop/admin.

Admin Ant Design was replaced with actual Radix Themes. Refine core/data/auth contracts remain. New sidebar/mobile drawer/header/login/tables/forms/upload/dialogs preserve server sorting/pagination, role checks, nested editorAccess and hidden upload fields. Only registered fields are saved; failed edit loads show retry and disable Save. Unsaved-change warnings and error states remain. One documented heterogeneous Refine record typealias uses any; validation remains on API and required fields.

Docker public build arguments support four domains. Main Compose still has exactly app and gateway. DB, Dragonfly, AI and QRIS workers remain external. No schema, billing model or scene/export format change.

## Files

client/src/pages/landing.tsx + landing.css; lib/site-config.ts and api-media.ts; App.tsx and use-scene-images.ts; packages/shared/src/theme.css; admin/src/App.tsx, components/ui.tsx, pages/*, style.css and providers/*; api/src/web-app.ts, runtime-env.ts, request-security.ts and storage helpers; Dockerfile, docker-compose.yml, Litepod config; tests/domains-ui-browser.mjs and existing browser assertions; README and docs/split-domains.md.

## Versions and setup

Bun1.4.4, Elysia1.4.30, cors1.4.2 unchanged. Radix Themes3.3.0; Poppins5.3.0 verified through npm registry and pinned; Bricolage5.3.0 retained. Lock regenerated with repository Bun1.4.4; frozen install verified. Test orchestration uses Node; actual Bun is .cache/runtime/bun-1.4.4/bun-windows-x64/bun.exe.

Use README install/build scripts and [domain deployment runbook](../split-domains.md) for exact VITE buildargs, runtime origins, DNS/TLS, app3000/gateway8080, DB/Dragonfly private network, storage, OAuth/QRIS cutover and rollback. No new migration required. Preserve existing JWT/encryption keys. Litepod network membership must survive release-container replacement.

## Verification

Exact commands/outcomes are in artifacts/domains-ui-2026-11-03/verification.json.

- Unit release: frozen/audit/typecheck/lint/build/deployment/Compose/security/QRIS/viewer/GLB/scene/navigation; all16 gates PASS on the final source.
- Dedicated domain/media/origin/redirect suite:20tests/140assertions PASS.
- Production landing/admin-login browser:360/390/768/1024/1440, light/dark, Poppins,44px CTA, menu Escape, catalogue error/empty/success/invalid PASS. Separate local two-origin compiled build PASS.
- Docker: migration/business/security/QRIS/upload integration, app/worker/QRIS build, two-service Compose/startup/image hygiene PASS.
- Real disposable gateway browser: auth/roles/ownership, scene undo/save, admin credit-pack+bundle create/edit and all lists, store→register→server quote→QRIS signed receipt/replay→library/private download PASS.
- Full lab FAIL: existing Windows headless WebM export reproduces Recording failed / missing webm. Assertion stays enabled; all exports are not proven.
- Windows file locks interrupted earlier reports; lab now writes cumulative result once and isolates browser artifacts per run.

## Artifacts

[Desktop landing](artifacts/domains-ui-2026-11-03/split-local/landing-light-1440.png) · [Mobile dark landing](artifacts/domains-ui-2026-11-03/split-local/landing-dark-390.png) · [Admin desktop](artifacts/domains-ui-2026-11-03/admin/credit-packs-light-1440.png) · [Admin mobile](artifacts/domains-ui-2026-11-03/admin/credit-packs-dark-390.png) · [Admin login](artifacts/domains-ui-2026-11-03/split-local/admin-login-light-1440.png).

Cleanup evidence covers own test containers/image tags; shared images used elsewhere are preserved. No volume deletion/global prune; build cache untouched.

## Remaining checks and decisions

No live DNS/TLS, Google OAuth, production database or merchant transaction was used. Configure Litepod domains/buildargs/runtime/network and verify cross-subdomain sessions on real HTTPS before release. Reproduce/fix WebM on intended CI/browser. Vite large editor/admin chunks remain. Landing is served by the same image as shop/admin/API to keep deployment simple; it can be routed to the same app rather than adding a lifecycle service. No production-ready claim.
