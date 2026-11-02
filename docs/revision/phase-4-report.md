# Hasil fase 4: keamanan dan integritas bisnis

31 Oktober 2026, Asia/Jakarta. Repository **ikhsanaryaaa/nesomn-studio-website**, origin `https://github.com/ikhsanaryaaa/nesomn-studio-website.git`. Branch **works/runtime-tooling-upgrade**, HEAD **041d225fca07ae405b440ca424a0c56f90fdac0f**. Perubahan fase1-4 masih lokal, belum commit/push/merge/deploy. Working tree awal fase4 sudah berisi pekerjaan fase sebelumnya dan dipertahankan; [input hashes](phase-4-input.json) membatasi atribusi perubahan ini.

## Yang berubah

- Production tidak dapat membayar/generate lewat stub atau fallback provider. Checkout Stripe/Pakasir legacy fail-closed503; raw Stripe HMAC/timestamp diverifikasi, Pakasir tidak ditebak kontraknya. Histori gateway/status/amount tetap. Legacy order ditahan untuk review, bukan replay manfaat.
- Payment receipt/event dan physical receipt identity idempoten; nominal/currency/gateway/ref dihitung/divalidasi server. Paid dan grant bertransaksi bersama. Error fulfillment rollback paid, receipt tetap dapat dipulihkan. Rincian QRIS/kode unik/matching tetap fase5.
- Ledger kini memakai stable user lock, account/lots/allocations dan operation key. Debit/refund/grant paralel tidak menggandakan saldo. Kuota bulanan, expiry/top-up dan refund tanpa memperpanjang expiry; legacy discrepancy ditahan tanpa koreksi otomatis. Subscription canceled berlaku sampai akhir periode; renewal kalender UTC, overlap admin dicegah dan cancel memilih periode efektif.
- Debit+job+SQL outbox satu transaksi, deterministic BullMQ ID, recovery failed entry hanya untuk SQLpending, claim/lease, cancel pending, timeout/refund dan terminal replay guard. Remote acceptance reference dan needsReview menjaga kasus ambigu. Redis outage tidak menghilangkan debit/job; worker dapat restart/drain tanpa memanggil provider terminal lagi. Free Basic tetap Free untuk model/priority AI berdasarkan capability existing.
- Session owner/expiry/role DB, HS256/claims, concurrent session limits, origin/CORS/proxy-aware bounded rate limiting. Google backend memakai one-use cookie-bound state, PKCE/nonce dan signed identity; tidak auto-link password account lewat email. UI login/OAuth tetap fase7.
- Private editor loader/download, publication/marketplace dan entitlement checks; ownership project/thumbnail. Upload memeriksa isi, bukan MIME browser, memakai UUID/owner/transaction cleanup. URL/metadata/key/path/symlink/token dan outbound provider HTTPS/DNS/TLS dibatasi. Retention default dry-run, tanpa boot deletion.
- Main Compose tetap tepat **app/gateway**; readiness memeriksa schema integrity, worker tetap independen. Tidak merombak framework, format scene atau renderer/UI. Admin hanya mendapat penyesuaian header idempotency; UI monokrom-orange dengan shape UjiHub tetap fase6, viewer/empat GLB fase8.

## File penting

| Area | File/folder |
| --- | --- |
| Data | api/drizzle/0004_business_integrity.sql,0005_receipt_identity.sql,0006_remote_execution.sql + journal; api/src/db/schema/{integrity,auth,billing,orders,ai}.ts; transaction.ts/preflight.ts/migrate.ts |
| Finance | api/src/modules/ai/credit.ts; billing/{routes,grant,settlement,gateway,gateways/*,retention}.ts; lib/{periods,entitlement,feature-access}.ts |
| Queue/provider | ai/{service,outbox,queue,provider,providers/*}.ts; worker/src/{index,process-job}.ts; shared AiJobDTO |
| Boundaries | middleware/{auth,request-security,rate-limit,error}.ts; auth/{routes,schema,google}.ts; catalog/store/project/storage/admin routes; lib/{ai-media,outbound,upload-validation,validation,storage/*,jwt}.ts |
| Ops/tests/docs | .env.example, deploy/worker.env.example, docker-compose.yml TRUST_PROXY, server readiness, admin dataProvider; tests/security/*, deployment regressions, scripts/test-security.mjs, CI; docs/security.md, testing-phase4.md, workers/deployment/testing/README/REVISION |

## Runtime dan cara menjalankan

**Bun1.4.4**, **Elysia1.4.30**, **CORS1.4.2**, **bun-types1.4.4** dipertahankan dari stable terverifikasi fase2. Tidak ada dependency baru/force install. Global Bun mesin1.4.0 tetap; executable workspace1.4.4 digunakan untuk checks dan Docker memuat Bun1.4.4 tag+digest terpin. Node tooling24.18.0. Lock SHA256 tetap `95afff69a5504197a958829f630e8f55e8fbade43a34e43e0721b330f0aaf3e8`.

Install `bun install --frozen-lockfile`; inject env dari template baru tanpa menimpa .env existing. PostgreSQL memakai DATABASE_URL eksternal; Redis/storage/AI worker juga eksternal/shared network. Setelah backup+schema review dan drain producer/worker, jalankan preflight dan migration eksplisit0004-0006, lalu build client/admin serta root Docker targets. Tidak ada migration/push/reset/seed otomatis saat boot.

Command operasional: `bun --no-env-file --no-install --cwd api src/db/preflight.ts`, kemudian `bun --no-env-file --no-install --cwd api src/db/migrate.ts`; `bun run build`; `docker build --target app ...` / `--target worker ...`; `docker compose --env-file <operator-env> up -d --wait`. Main Compose `config --services` harus app/gateway, app3000 private, gateway default127.0.0.1:8080. Client `/`, admin `/admin/`, API `/api/`, health `/health/live` dan `/health/ready`. TLS diterminasi reverse proxy operator; Origin harus cocok public HTTPS. AI worker memakai DB/Redis/key sama, lifecycle Docker run terpisah dengan grace300s. Tidak ada worker QRIS aktif sebelum fase5.

Rincian aman backup/migrasi/rekonsiliasi: [security](../security.md). Network existing DB, storage/TLS dan Compose: [deployment](../deployment.md). Worker dan recovery: [workers](../workers.md). Command test lengkap dan lab port18080: [testing fase4](../testing-phase4.md).

## Pengujian

Semua tes memakai synthetic env/disposable PostgreSQL/Redis, bukan DB/merchant production. Hasil final dirinci di [evidence](phase-4-evidence.json). Run awal RED adalah bukti regresi, bukan disembunyikan sebagai PASS. Satu fix pass menangani review dan outage nyata; lihat [review](phase-4-review.md), [progress/rulings](phase-4-progress.md).

| Command/check | Hasil | Batas bukti |
| --- | --- | --- |
| bun install --frozen-lockfile | PASS |641 installs/779packages, no changes, Bun workspace1.4.4 |
| bun run typecheck | PASS |5workspace |
| bun run lint | PASS |0errors;2Fast Refresh warnings existing |
| bun run build, NODE_ENV=production | PASS |Client/admin assets +3prerender; existing chunk-size warnings |
| node scripts/test-baseline.mjs unit | PASS22 |Termasuk3scene serialization/undo; bukan WebGL/export render |
| node scripts/test-baseline.mjs integration | PASS24 |Auth/session/project/credit/billing/retention/sample worker |
| node scripts/test-security.mjs unit | PASS9/64assertions |Signature/origin/key/period/URL/upload pure |
| node scripts/test-security.mjs integration | PASS29/122assertions |Concurrency/atomicity/expiry/OAuth/private boundary/actual BullMQ/upgrade fixtures |
| Node regression guards | PASS11 |Runtime/bundle/bootstrap/prerender/env isolation |
| node scripts/test-deployment.mjs | PASS13 |Mount/static/API404/readiness/env/Redis contracts |
| Docker app/worker build | PASS |Multi-stage/frozen/non-root existing architecture retained |
| Compose config --services/check-deployment.mjs | PASS |Exactly app,gateway; app private/external data network/storage |
| Gateway HTTP acceptance | PASS5 (parent+4) |Actual Nginx+production app, secure-cookie headers/role/proxy, upload/download, origin, fail-closed payment/provider, synthetic raw Stripe202review |
| Worker active SIGTERM drain | PASS1 |Explicit nonproduction sample worker; processing->done/log order/exit0 |
| Actual Redis outage + worker restart | PASS1 |Pending SQL/debit90/outbox/readiness503; offline shutdown0; recovered done/balance90, no extra debit |
| Storage persistence after app recreation | PASS1 |Valid uploaded bytes on same external lab volume, no volume deletion |
| Actual Linux production bootstrap | PASS1 |Module imports/browser root stub; not visual browser rendering |
| Credential-free HTTPS pinned lookup | PASSWindows/Linux |example.com200,577bytes; not vendor contract/TLS infrastructure |
| Live Google/Stripe/Pakasir/AI/QRIS/R2 and production migration | SKIPPED |No live credentials/merchant instructions; contract-specific QRIS phase5 |
| New light/dark/editor/viewer/store/admin visual QA | SKIPPED inphase4 |Redesign phases6-10; screenshots phase3 are historical only |
| Remote CI/deployment | SKIPPED |Workflow updated locally, no push/production access |

## Artifacts dan batas rilis

[Acceptance artifacts](artifacts/phase-4/) menyimpan outage/drain/health summaries dan [evidence](phase-4-evidence.json) mencatat command/exit/hash/image/container. Log lengkap lokal di `.cache/revision-phase-4/`; synthetic signed probes tetap di .cache, tidak dikomit. Tidak membuat screenshot baru untuk backend phase. [Desktop phase3](artifacts/phase-3/home-1440.jpg), [mobile phase3](artifacts/phase-3/home-390.jpg) dan screenshot store/editor/admin di folder phase3 tetap bukti historis yang sebenarnya, bukan bukti desain baru.

Risiko/gap: legacy ledger/order/job perlu rekonsiliasi sebelum cutover; backup/restore/schema production belum dibuktikan; old financial writers tidak aman dipakai setelah schema baru menulis account/lots. Google browser consent/linking UI, provider/live webhook contract, R2/CORS/managed TLS dan merchant belum diuji. Local rate limiter perlu store bersama sebelum multi-replica. Generic AI adapter defaultdisabled dan tidak menjanjikan exactly-once external execution; kasus accepted/unconfirmed harus direview sebelum retry. SVG aktif ditolak; ZIP/font/video hanya mendapat format checks, full glTF/resource/render validation phase8. Persistensi preview/admin UX dan QRIS unify checkout masih fases5/7/9. Tidak ada inquiry/SMTP source yang dapat diklaim selesai.

Deviasi sengaja:3migration aditif diperlukan untuk locking/idempotency/outbox/OAuth/accepted remote metadata; histori lama tidak diubah. Production checkout legacy dinonaktifkan sampai QRIS, daripada memberi sukses palsu. Legacy credits tanpa expiry tidak dihanguskan retroaktif; discrepancy dihentikan. Manual subscription quota0 tetap, plan change/legacy renewal/perubahan benefit perlu operator review tanpa proration tebakan. Retention tidak menghapus apa pun selama fase ini. Free Basic Pro gate mengikuti capability existing. Keputusan dan dampaknya lengkap di progress/rulings.

Fase4 memenuhi acceptance lokal dalam scope backend/security yang disepakati. Ini bukan klaim seluruh platform production-ready, bukan izin deploy, dan bukan pengakuan fase5-10 sudah dikerjakan.
