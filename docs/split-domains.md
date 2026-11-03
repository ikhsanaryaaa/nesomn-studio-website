# Nesomn split-domain deployment

The application image serves landing, shop, admin, and API. This keeps the main Compose lifecycle at exactly app + gateway; PostgreSQL, Dragonfly/Redis, AI and QRIS workers remain external. No production deployment is performed by this change.

## Build arguments (public, not secrets)

VITE_LANDING_URL=https://nesomn.studio
VITE_SHOP_URL=https://shop.nesomn.studio
VITE_ADMIN_URL=https://dashboard.nesomn.studio
VITE_API_URL=https://api.nesomn.studio/api

Set these as Litepod Docker build arguments. Runtime environment alone cannot replace values compiled by Vite. Rebuild after changes. Admin assets intentionally retain /admin/ URLs while dashboard router uses / on its configured hostname. Local legacy /admin/ remains supported.

## App runtime environment

LANDING_URL=https://nesomn.studio
CLIENT_URL=https://shop.nesomn.studio
ADMIN_URL=https://dashboard.nesomn.studio
API_URL=https://api.nesomn.studio
GOOGLE_REDIRECT_URI=https://api.nesomn.studio/api/auth/google/callback

Keep existing DATABASE_URL, REDIS_URL, JWT_SECRET, ENCRYPTION_KEY, storage and provider configuration. Never rotate existing encryption keys during this cutover. Four origins must be distinct HTTPS origins under LANDING_URL hostname. No cookie Domain=.nesomn.studio is added: the API issues host-only HttpOnly Secure SameSite=Lax cookies. Shop/admin share the API session identity in the same browser.

## Litepod and DNS

Route all four domains through Litepod HTTPS ingress to the same app container port3000 (or Compose gateway8080). DNS records must point to your ingress; provision TLS for every hostname. Preserve Host through the reverse proxy. Do not publish PostgreSQL or Dragonfly. App and external workers need a persistent shared private network with PostgreSQL and Dragonfly; a manual podman network connect on a release container does not survive replacement. Configure persistent network membership in deployment before cutover.

Set API_URL in the AI worker too when using local storage, so signed file URLs are absolute and point to API; external AI providers still need their approved fetch URL policy. R2 bucket CORS must allow required shop/editor fetches from shop and previews from landing. Keep private objects and expiring signed URLs.

## Routes and cutover

- Landing / serves prerendered landing HTML.
- Shop / remains store; /dashboard exposes the existing account workspace (projects/library links, subscription, credits/history). /account remains a compatibility alias.
- Dashboard /, /login, /users etc serve the admin SPA.
- API contract stays /api/_; /files/_ retains HMAC validation.
- Known legacy store/editor links on landing redirect308 to shop with query preserved.
- Legacy /admin paths redirect308 to the dashboard hostname in split mode.
- Missing assets and unknown API routes never receive SPA fallback.
- /landing is an explicit local preview route; production landing root has its own prerender.
- Without LANDING_URL/API_URL runtime variables and VITE domain build arguments, legacy single-domain deployment remains available.

Register the new exact Google callback in Google Cloud before enabling OAuth. Set QRIS_INGEST_URL=https://api.nesomn.studio/api/billing/qris/receipts in the QRIS worker; update legacy provider webhook registrations to api.nesomn.studio; retain old invoice/provider identity and old webhook secrets during reconciliation. Do not simulate merchant payments.

## Migration and rollback

Split-domain routing itself has no schema migration. The portfolio feature requires additive migration 0008_portfolio.sql; follow [the portfolio migration runbook](portfolio.md) before starting this image. Back up DB and storage before rollout. Retain previous image and existing keys. Build/review new image, configure domains/network/TLS, then verify health/live, health/ready, each frontend, login/logout/OAuth, private download, editors, checkout pending and admin authorization. Live OAuth/merchant verification requires real credentials and must not be claimed from fixture tests. Roll back image/buildargs and origin settings together; restore previous callback routing as necessary. No reset/drop/seed required.
