# Portfolio / Works foundation

Phase1 introduces portfolio management, separate from assets, orders, licences and credits. Public Works pages and the single StudioKit sample are implemented in phase2; no portfolio record is seeded automatically.

## Migration and deployment

Migration: api/drizzle/0008_portfolio.sql (append-only journal entry8). It adds portfolio_uploads, portfolio_works and portfolio_gallery with FK/check/unique constraints. Existing tables and rows are untouched. Do not run drizzle push/reset/seed.

1. Back up the database identified by the app DATABASE_URL and verify the backup. Inspect whether portfolio_* tables or a manually applied migration already exist; stop on unexpected schema rather than dropping/recreating tables.
2. Build the app normally (bun install --frozen-lockfile; bun run typecheck; bun run build). For Litepod use the existing root Dockerfile/app target and persistent DB/Redis network.
3. Run the explicit migration using the new image and existing DATABASE_URL. From SSH: podman exec -w /app/api APP_CONTAINER bun --no-env-file --no-install src/db/migrate.ts.
4. App /health/ready now verifies the portfolio tables too. Verify readiness before routing traffic and log in as an admin.
5. Open /admin/works on legacy deployment, or /works at dashboard.nesomn.studio with split domains configured. Published content APIs live on API_URL/api/works.

Migration was tested against schema0–7 with an existing user record and rerun idempotently. No migration was run against production. Keep a backup and prior image. Roll back application image without dropping the new tables; do not edit migration history to force a rollback.

No new environment variables or dependencies are required. Existing API_URL/VITE_API_URL, private storage, JWT/encryption keys and upload limit110MB remain. PostgreSQL, Dragonfly/Redis and workers remain external; main Compose still has app and gateway only.

## API

All admin endpoints require server-side admin authentication and existing origin/rate-limit protections:
- GET /api/admin/works: paginated Refine dialect _start/_end/_sort/_order, x-total-count.
- GET /api/admin/works/:id.
- POST /api/admin/works: create,201.
- PUT /api/admin/works/:id: full editable snapshot plus expectedRevision. Concurrent stale writes return409 WORK_CONFLICT; duplicate slugs409 SLUG_TAKEN.
- DELETE /api/admin/works/:id: delete work+gallery rows; retain uploaded files which may be shared.
- POST /api/admin/works/media: multipart file; returns stable admin-preview media URL.
- GET /api/admin/works/media/:id: admin-only fresh signed redirect.

Public GET /api/works and /api/works/:slug expose Published only. /api/works/media/:id serves a fresh signed redirect only if currently referenced by a Published cover/gallery/poster. Draft/unreferenced/marketplace media cannot be published through a guessed media ID. Marketing CORS permits only public GET routes, not account/admin responses.

Fields: slug/title, description, projectDate YYYY-MM-DD or null, client optional, coverMediaId, status Draft/Published, isSample, linkLabel/linkUrl pair, gallery[{mediaId,alt,posterMediaId}]. Gallery array order is persisted transactionally. Title/client160characters, description20000, gallery40, alt500, linklabel80, URL2048. Custom links use HTTP(S) with no embedded credentials. Text is plain text, not HTML.

Published requires a cover image, description and projectDate; gallery images require alternative text. Video posters must be portfolio images. The API only accepts media registered by the portfolio uploader, never private store product IDs.

## Media and retention

PNG/JPEG/WebP up to20MiB; MP4/WebM up to100MiB. Image decode and video-container bounds/track checks run server-side; filename or browser MIME alone is insufficient. Codec transcoding is not provided: use MP4 H.264/yuv420p or compatible VP8/VP9 WebM, test target browsers. FFmpeg is only used to regenerate tiny original test clips, not required in the application image.

Preview URLs are stable API references, not saved expiring signatures. Signed redirects expire after300seconds. A previously issued URL can remain valid until expiry after unpublishing. Local file delivery streams and supports single-byte ranges206/416 so video seeking does not buffer the entire object. R2 provides its own signed range delivery.

Removing gallery items, cancelling edits or deleting a work intentionally retains uploads to avoid deleting shared media. Unreferenced uploads stay private. There is no automatic garbage collector in this phase: storage cleanup must inspect cover/gallery/poster references and preserve shared media; no bulk purge or volume deletion is included.

## Tests

See docs/revision/works-phase1-2026-11-03.md and its artifacts. Test fixtures are explicitly synthetic and isolated. Regenerate original0.4s clips with node scripts/generate-portfolio-test-video.mjs (FFmpeg installed locally). They are not portfolio products or client work.

## Phase2 public pages and optional sample

Works list/detail and explicit /demo/works/nesomn-studio-kit are implemented. See [phase2 report](revision/works-phase2-2026-11-03.md) for optional one-record import and test evidence. No sample imports automatically.
