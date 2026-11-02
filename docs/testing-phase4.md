# Phase 4 verification runbook

Use pinned Bun1.4.4 on PATH. This machine used `C:/Users/ikhsan/Desktop/nesomn-studio-website/.cache/runtime/bun-1.4.4/bun-windows-x64/bun.exe`; global Bun1.4.0 was not upgraded. Run from the repository root. Do not use a production DB/merchant. No checkout/reset/seed/drop/volume deletion is needed.

## Host checks

```powershell
bun install --frozen-lockfile
bun run typecheck
bun run lint
node --test tests/baseline-runner.test.mjs tests/runtime-pin.test.mjs tests/prerender-exit.test.mjs tests/browser-bootstrap.test.mjs
node scripts/test-deployment.mjs
node scripts/check-deployment.mjs
node scripts/test-baseline.mjs unit
node scripts/test-security.mjs unit
```

Build with NODE_ENV=production; runtime/deployment checks intentionally reject prerelease/global-old Bun. Security scripts create a sanitized environment and disable Bun .env loading/auto-install. They inherit only OS variables plus synthetic fixtures. On Windows Docker Compose needs ProgramFiles/ProgramData to discover its plugin: run check-deployment.mjs directly, since it preserves those OS paths; do not wrap it in another sanitizer that strips them.

```powershell
$env:NODE_ENV='production'
bun --no-env-file --no-install run build
```

## Disposable SQL/Redis and integration

```powershell
docker compose --env-file .env.example -p nesomn-revision-test -f tests/compose.test.yml up -d --wait
docker compose -p nesomn-revision-test -f tests/compose.test.yml exec -T test-db psql -U nesomn_test -d nesomn_revision_test -Atc "select current_database(),current_user"
```

Expect `nesomn_revision_test|nesomn_test`, ports55432/56379 loopback only. Apply all reviewed migrations via the sanitized runner, without application seeds:

```powershell
node --input-type=module -e "import {spawnSync} from 'node:child_process';import{createTestInvocation}from'./scripts/test-baseline.mjs';const{env}=createTestInvocation('unit',process.env);const r=spawnSync('bun',['--no-env-file','--no-install','--cwd','api','src/db/migrate.ts'],{env,stdio:'inherit'});process.exit(r.status??1)"
Get-Content tests/fixtures/baseline-plans.sql -Raw | docker compose -p nesomn-revision-test -f tests/compose.test.yml exec -T test-db psql -v ON_ERROR_STOP=1 -U nesomn_test -d nesomn_revision_test
$env:NESOMN_DISPOSABLE_TESTS='1'
node scripts/test-baseline.mjs integration
node scripts/test-security.mjs integration
```

Security integration requires exact fixed URL, DB and role before fixtures mutate. Migration upgrade tests additionally create uniquely named `nesomn_revision_upgrade_<uuid>` databases inside THIS disposable PostgreSQL. They preserve legacy records and test abort on conflicts. No DROP/reset is used; tmpfs disappears when the test DB container is stopped. The disposable role must be able to create these fixture databases; do not grant this privilege to a production app role. CI uses its isolated PostgreSQL service.

Expected final groups:22baseline unit/scene;24baseline integration;9security pure +29security integration;13deployment unit;11Node guards. None proves browser render/live Google/vendor/payment. Opt-in credential-free Bun HTTPS test:

```powershell
$env:NESOMN_OUTBOUND_PROBE='1'
# Use the same sanitized invocation pattern above, running:
# bun --no-env-file --no-install test tests/deployment/outbound-runtime.test.ts
```

## Docker gateway and external worker lab

The older phase3 lab instructions in testing.md are historical. In particular, production stub generation and arbitrary .bin upload are now denied. Use the following isolated names/config, not developer `.env`.

Build root Dockerfile targets:

```powershell
docker build --target app -t nesomn-app:revision-phase4 .
docker build --target worker -t nesomn-ai-worker:revision-phase4 .
```

Create/verify `nesomn-revision-data-test` network and `nesomn-revision-storage-test` volume (reuse only verified synthetic lab resources). Attach the disposable test DB with alias `revision-db`. Independently create Redis if not already the known labeled lab container:

```powershell
docker network create --label nesomn.revision-test=phase3 nesomn-revision-data-test
docker network connect --alias revision-db nesomn-revision-data-test nesomn-revision-test-test-db-1
docker volume create --label nesomn.revision-test=phase3 nesomn-revision-storage-test
docker run -d --name nesomn-revision-redis-private --label nesomn.revision-test=phase3 --network nesomn-revision-data-test --network-alias revision-redis redis:7-alpine redis-server --requirepass synthetic-redis-password --appendonly no
```

Run create/connect only when absent; do not delete a resource to clear a name conflict. Redis has no public port; producer/consumer use authentication and DB4. This lab is intentionally nonpersistent; real external Redis requires persistence/noeviction/backup/monitoring.

Write `.cache/revision-phase-4/deployment.env` using synthetic values:

```dotenv
NODE_ENV=production
DATABASE_URL=postgresql://nesomn_test:nesomn_test@revision-db:5432/nesomn_revision_test
REDIS_URL=redis://:synthetic-redis-password@revision-redis:6379/4
JWT_SECRET=synthetic-deployment-jwt-secret-never-production
ENCRYPTION_KEY=synthetic-deployment-encryption-secret-never-production
STRIPE_WEBHOOK_SECRET=synthetic-deployment-stripe-webhook-secret
CLIENT_URL=http://127.0.0.1:18080
ADMIN_URL=http://127.0.0.1:18080
STORAGE_DRIVER=local
STORAGE_PATH=/data/storage
DATA_NETWORK=nesomn-revision-data-test
STORAGE_VOLUME=nesomn-revision-storage-test
APP_IMAGE=nesomn-app:revision-phase4
APP_ENV_FILE=.cache/revision-phase-4/deployment.env
GATEWAY_BIND=127.0.0.1
GATEWAY_PORT=18080
```

```powershell
docker compose --env-file .cache/revision-phase-4/deployment.env config --services
docker compose --env-file .cache/revision-phase-4/deployment.env -p nesomn-revision-phase4 up -d --no-build --wait
```

Expect exactly app/gateway and ready at `http://127.0.0.1:18080/health/ready`. Run `node --test tests/deployment/gateway.test.mjs` with pinned Bun on PATH and NESOMN_DISPOSABLE_TESTS=1. It uses only synthetic prefixed users and a test-only fixture, never merchant/provider calls. Tests cover secure cookies, role/proxy, raw verified Stripe ingestion returning202 review_required (pending order unchanged), invalid signature, production stub503, origin403, malformed upload400, PNG/Sharp and private signed download, API404/static/deep links.

External worker for **explicit sample tests only**; main app stays production and rejects samples:

```powershell
docker run -d --name nesomn-revision-ai-worker-phase4 --label nesomn.revision-test=phase4 --network nesomn-revision-data-test --env-file .cache/revision-phase-4/deployment.env -e NODE_ENV=test -e ALLOW_AI_STUB=true --read-only --tmpfs /tmp:rw,noexec,nosuid,size=64m --cap-drop ALL --security-opt no-new-privileges:true nesomn-ai-worker:revision-phase4
node --test tests/deployment/worker-drain.test.mjs
node --test tests/deployment/outbox-outage.test.mjs
```

The drain test observes an active processor then sends SIGTERM and verifies done/log order/exit0. The outage test validates resource labels, stops ONLY the private Redis lab, confirms SQL pending/debit/outbox failure and readiness503, stops the disconnected worker exit0, restores Redis/restarts worker, and proves done without a second debit. Finally it restores Redis and stops the sample worker. Test fixture calls the real service in explicit test mode; it does not bypass the production API's provider restriction. Do not run sample worker concurrently with host security fixtures on the same SQL database. Production worker uses NODE_ENV=production and no sample flags; its startup/heartbeat/shutdown was checked separately, without provider jobs.

After gateway test, recreate ONLY app on the SAME volume, then `node --test tests/deployment/storage-persistence.test.mjs`. This checks valid uploaded thumbnail bytes. Gateway test writes the transient signed probe to `.cache/revision-phase-3/storage-probe.json` for compatibility; it expires after1hour. It contains only synthetic data and is not committed.

For Linux client regression copy `/app/client/dist` from the running app into `.cache/revision-phase-4/client-production`, set NESOMN_CLIENT_DIST to that absolute path, and run `node --test tests/browser-bootstrap.test.mjs`. This is module/bootstrap validation, not visual browser QA.

At completion stop only named lab app/gateway, sample/production test workers, private Redis and tests/compose.test.yml. Do not use `down -v`, prune, or remove existing database/storage volumes. Actual final statuses and image IDs are recorded in the phase4 evidence. Browser screenshots remain the historical phase3 artifacts; new themes/editor/GLB visual tests belong to phases6-10.
