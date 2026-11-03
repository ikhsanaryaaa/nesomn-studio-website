# Marketing / portfolio phase 5 — final local acceptance

Date: 3 November 2026. Repository: https://github.com/ikhsanaryaaa/nesomn-studio-website (not nesomn-studio). Branch: codex/radix-english-rounded-ui. Local base commit: 3e51b30. Existing working changes preserved; this work is uncommitted, unpushed and undeployed.

## Result and changes

The five-phase landing/Works/About/Studio Kit implementation has completed its local acceptance work. Production release remains conditional: live integrations and physical-device testing are unverified, and Windows headless WebM export still fails (NS-BUG-007). This is not a blanket production-ready verdict.

Phase 5 fixed duplicate Works navigation and restored the Log in destination in mobile marketing menus. Shared marketing switches at 700px; Landing at 800px. Browser assertions cover nav order, login reachability, 44px targets, Escape/focus recovery and the requested About introduction in Poppins 700. No business model, price, transaction history, editor format or payment-provider logic changed.

The existing portfolio lab now supports --acceptance: disposable legacy migration, one sample imported twice, Docker production build, real Nginx, extracted Linux assets and browser suites. The real admin browser test now creates/publishes a work with image/video uploads, checks the public response and media, and captures five widths/two themes. The release browser lab includes Works and Studio Kit; deployment unit gate now includes split-origin and signed-media identity tests. Artifact directories are separate to avoid overwriting each other's browser.json.

Important changed files:
- client/src/pages/landing.tsx and components/marketing/marketing-shell.tsx/.css.
- scripts/test-portfolio-lab.mjs, scripts/test-deployment.mjs, scripts/release-lab.mjs.
- tests/admin-browser.mjs, domains-ui-browser.mjs, works-public-browser.mjs, studio-kit-viewer-browser.mjs.
- README.md, REVISION.md, BUGS.md, docs/release-readiness.md, docs/split-domains.md and this report.

## Runtime and infrastructure

No dependency/runtime upgrade in this phase. Pinned local Bun 1.4.4 (.cache/runtime/bun-1.4.4/bun-windows-x64/bun.exe), Elysia 1.4.30, @elysiajs/cors 1.4.2 and Radix Themes 3.3.0 remain. Node runner is 24.18.0. These are existing pinned versions, not a new claim about latest upstream releases.

Main Compose remains exactly app + gateway; app port3000 stays private, gateway8080 defaults to loopback. PostgreSQL and Redis-compatible service/Dragonfly, AI worker and QRIS worker remain external. Phase 5 lab uses disposable PostgreSQL/Redis, never the user's production databases/merchant. The lab gateway is loopback18092, DB55432 and Redis56379.

## Repeat tests

Run from repository root with Docker Engine/Compose and Chrome available:

~~~sh
node scripts/release-check.mjs unit
node scripts/test-portfolio-lab.mjs --acceptance
~~~

The second command refuses an occupied fixed test namespace, creates a fresh tmpfs DB/Redis, runs explicit migrations, builds the app, starts Nginx, tests browser assets and removes its own containers/images in finally. It does not delete persistent volumes or run global prune. Docker build cache and images already present before testing are preserved.

For the full existing editor export fixture, keep the WebM assertion enabled:

~~~sh
node tests/viewer-browser.mjs
~~~

Use NESOMN_VIEWER_ARTIFACTS to direct output into a fresh evidence folder. The default standalone script expects production client/dist; the acceptance lab extracts client/admin assets from the production image.

## Evidence and limits

| Command/check | Status | Evidence boundary |
| --- | --- | --- |
| node scripts/release-check.mjs unit | PASS | Frozen install, online dependency audit, workspace typecheck/lint/build, UI/guards, deployment/Compose, security/QRIS/viewer/GLB/scene/navigation; 16 gates |
| node scripts/test-portfolio-lab.mjs --acceptance | PASS | Fresh disposable schema0–7 + legacy user, additive0008 twice, existing user preserved, portfolio auth/permissions/media/publication tests, exactly one sample despite repeated import |
| Docker app build and Nginx gateway | PASS | Actual production image; readiness/live, marketing/admin deep links, public API, unauthenticated admin401, unknown API JSON404, missing assets404 |
| Production-image browser suites | PASS | Landing/admin login, Works list/detail/About at360/390/768/1024/1440 light/dark; Studio Kit390/768/1440 light/dark and ten model switches; real API admin create/edit/publish/mixed media and lists |
| Keyboard/media/error states | PASS within tested scope | Menu Escape/recovery, mobile Log in, lightbox Escape/recovery, native video metadata, honest API failure/empty/missing states, no JavaScript exceptions in successful suites |
| node tests/viewer-browser.mjs | FAIL | Four original GLBs/render controls/save and PNG/JPEG pass before WebM recording fails; assertion missing webm, UI Recording failed |
| Independent UI review | Findings fixed | Separate reviewer found two nav defects; source recheck accepted both fixes and final breakpoints; not an exhaustive accessibility/contrast audit |
| Live TLS/DNS/OAuth/R2/AI/QRIS, existing production migration, backup restore, physical mobile/Safari/GPU | SKIPPED | Needs deployment/operator setup; no production credentials or merchant transactions used |

Screenshots/JSON/logs: [phase5 artifacts](artifacts/marketing-phase5-2026-11-03). See integration.json, gateway.json, release-checks.json, compose-services.txt, cleanup.json and browser subfolders. Browser tests use real API only for admin; public/preview fixtures deliberately control success/error/empty states. Gateway checks independently hit the actual app/API. Host-based split-origin routing is tested in deployment tests; actual four-domain HTTPS ingress is not simulated.

WebM: encoder-probe.json shows zero recorded bytes from a separate 2D headless VP8/VP9 probe. This supports an environment capture limitation, not proof of successful real-device export. See NS-BUG-007 in BUGS.md. No export workaround or assertion suppression was introduced.

## Deployment checklist

Follow [Litepod](../litepod.md), [split domains](../split-domains.md), [portfolio migration/sample](../portfolio.md) and [viewer](../viewer-3d.md).

1. Back up the existing database and storage; inspect schema/migration history. Preserve encryption keys and existing provider identities.
2. Build root Dockerfile target app with public VITE_LANDING_URL, VITE_SHOP_URL, VITE_ADMIN_URL and VITE_API_URL. Runtime env alone cannot replace Vite build arguments.
3. Set LANDING_URL=https://nesomn.studio, CLIENT_URL=https://shop.nesomn.studio, ADMIN_URL=https://dashboard.nesomn.studio, API_URL=https://api.nesomn.studio, plus existing DATABASE_URL/REDIS_URL, JWT/encryption keys and private storage configuration. Never expose credentials as VITE variables.
4. Configure persistent private network membership between app, external PostgreSQL and Dragonfly; workers need the same permitted service endpoints. A manual connection to an old release container will not survive replacement.
5. After backup/schema inspection, run explicit migration in the new image: podman exec -w /app/api APP_CONTAINER bun --no-env-file --no-install src/db/migrate.ts. No push/reset/drop/automatic boot migration.
6. Configure Litepod ingress for all four hostnames to app3000, or Compose gateway8080 with TLS at ingress. Preserve Host. Main Compose users prepare external network/storage before docker compose up -d --build; Litepod per-container users use the app image directly.
7. Check /health/live and /health/ready, root landing, shop/dashboard, dashboard/works and API404. Then verify login/logout/OAuth, permissions/private downloads, publishing, signed preview renewal and actual device editor exports.
8. Optional one-record sample import is explicit only; see portfolio.md. Never bulk-seed or use test admin credentials in production. Keep the previous image/config for rollback without dropping additive portfolio tables.

No force push, merge, deployment, production migration, volume deletion, secret rotation or live merchant action occurred.
