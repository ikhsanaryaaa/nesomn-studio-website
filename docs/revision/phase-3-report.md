# Hasil fase 3: app + gateway dan layanan eksternal

31 Oktober 2026, Asia/Jakarta. Repository **ikhsanaryaaa/nesomn-studio-website**, origin `https://github.com/ikhsanaryaaa/nesomn-studio-website.git`, branch **works/runtime-tooling-upgrade**, HEAD **041d225fca07ae405b440ca424a0c56f90fdac0f**. Fase 1-2 masih belum commit; fase 3 dikerjakan kumulatif tanpa checkout/reset/commit/push/merge atau deployment production. Snapshot input fase 3: [phase-3-input.json](phase-3-input.json).

## Implementasi

- Compose utama tepat **app/gateway**. PostgreSQL, Redis, storage volume dan consumer AI memiliki lifecycle eksternal; tidak ada profile/override tambahan di repository. Port app private 3000; gateway default loopback 8080.
- Root multi-stage Dockerfile memiliki target app/worker, pinned Bun image, frozen build/prod install dengan cache, production assets client/admin, production dependency subset, USER bun, healthcheck dan direct production entry. Empat Dockerfile legacy dan admin/nginx.conf digantikan agar tidak ada build lama yang salah dipakai.
- Entry production memvalidasi env sebelum mengimpor koneksi. API existing dimount /api, admin tetap /admin/, client mendapat fallback hanya untuk route yang didukung. Unknown API JSON404; missing file/asset/private path tidak menjadi SPA. Signed /files lama tetap diverifikasi API. Dua logo authored root alias mempertahankan referensi admin.
- Gateway Nginx non-root/read-only mengarah app:3000, meresolve Docker DNS ulang, mengatur upload/timeout/Upgrade, forwarded headers dengan trust boundary, dan log tanpa query bertoken. Default trusted TLS proxy kosong. TLS production di reverse proxy operator; belum memasang certificate.
- DB connect timeout, readiness terbatasi 2s, liveness terpisah, app shutdown, shared Redis URL parser (auth/index/TLS) dan consumer heartbeat/graceful drain diimplementasikan. Local storage memakai path volume /data/storage, bukan disk container ephemeral.
- Browser smoke menemukan circular top-level await pada bootstrap Linux client. Bootstrap dipindah ke async function tanpa top-level await; regression actual image artifact RED exit13 kemudian GREEN. Referensi favicon Vite yang hilang diganti logo Nesomn authored. Tidak ada redesign halaman/editor atau perubahan scene format.
- Runbook network/DB existing, backup/schema/migrasi, storage import, TLS/forwarding, AI worker independen dan batas QRIS ditulis. CI menambahkan deployment unit/config check serta Docker build dan bootstrap check Linux; belum di-push/dijalankan remote.

File penting: Dockerfile, docker-compose.yml, nginx.conf, .env.example, .dockerignore/.gitignore, deploy/nginx/trusted-proxies.conf, deploy/worker.env.example, api/src/server.ts, api/src/web-app.ts, api/src/healthcheck.ts, api/src/lib/{runtime-env,redis,readiness}.ts, api/src/db/client.ts, api/src/modules/ai/queue.ts, api/src/lib/storage/local-fs.ts, worker/src/index.ts, client/src/main.tsx, client/index.html, eslint.config.mjs, CI, scripts/{test-deployment,check-deployment}.mjs, tests/deployment/* dan tests/browser-bootstrap.test.mjs.

## Runtime dan operasi

**Bun 1.4.4**, **Elysia 1.4.30**, **CORS 1.4.2**, **bun-types 1.4.4** dipertahankan dari versi stable terverifikasi fase 2; Node tooling lokal 24.18.0. Bun global mesin tetap 1.4.0, checks memakai executable workspace 1.4.4. Lockfile tetap SHA256 `95afff69a5504197a958829f630e8f55e8fbade43a34e43e0721b330f0aaf3e8`. Nginx aktual image **1.30.6**; tag versi + registry digest terpin di Compose. Tidak ada dependency baru atau force install.

Install/build/start, env wajib, URL dan health: [deployment.md](../deployment.md). Worker command, monitoring dan recovery: [workers.md](../workers.md). Runtime Windows dan script aktual: [runtime.md](../runtime.md). Reproduksi seluruh lab/test: [testing.md](../testing.md).

Main acceptance exact command:

```text
docker compose config --services
app
gateway
```

DB/Redis existing harus disambungkan ke external network atau menggunakan managed/private DNS; tidak dibuat/dihapus oleh main Compose. External storage harus dibackup/import/permission-check operator sebelum cutover. ENCRYPTION_KEY existing tidak boleh diganti tanpa re-encryption terencana. Tidak ada migration/seed otomatis; command migration explicit image diuji hanya pada disposable DB.

## Bukti pengujian

Log lokal `.cache/revision-phase-3/` diabaikan Git. Ringkasan terstruktur, hash log/artifact, source compatibility dan status review: [phase-3-evidence.json](phase-3-evidence.json). Semua DB/queue test menggunakan resource khusus lab dan env sintetis, tidak memakai .env existing atau merchant/provider production.

| Command / kasus | Hasil | Batas bukti |
| --- | --- | --- |
| `bun install --frozen-lockfile` | PASS | Hash lockfile tidak berubah |
| `bun run typecheck` | PASS | Lima workspace |
| `bun run lint` | PASS, 2 warnings | Node globals diberi scope script/test; Fast Refresh badge/button existing tidak dinonaktifkan |
| `NODE_ENV=production bun run build` | PASS | Client/admin production; tiga route prerender |
| Node guard/prerender/bootstrap suite | PASS: 11 | Environment/runtime, dev artifact marker, prerender exit dan root bootstrap; bukan seluruh DOM integration |
| `node scripts/test-deployment.mjs` | PASS: 13 | Env validation termasuk explicit storage, Redis URL, route/cache/HEAD/traversal, readiness timeout |
| Baseline unit/scene | PASS: 22 | Legacy state/undo tetap, bukan visual export |
| Baseline integration | PASS: 24 | Existing auth/session/project/credits/AI/billing stub/retention/worker process |
| `node scripts/check-deployment.mjs` dan exact Compose services command | PASS | app/gateway, no published app port, external network/storage, no profiles |
| Docker build target app dan worker | PASS | Linux amd64, production dependency install 107 packages; final app boot healthy |
| Invalid env Docker boot | PASS negative | Expected exit1 dengan field names, sebelum DB/Redis connection |
| Runtime image smoke | PASS | UID1000, read-only root, no host app port; .env/api.env/cache/git absent, Vite/ESLint tidak resolvable |
| `node --test tests/deployment/gateway.test.mjs` | PASS: 5 (parent + 4 subtest) | API/static/deep links, upload413, auth/admin role/cookie, spoofed forwarded IP ditolak, binary/PNG/Sharp thumbnail, signed URL invalid token, actual enqueue/consumer success/refund dengan stub eksplisit |
| Redis stop/start | PASS | live200, ready503; worker health exit1; recovery ready200 dan consumer kembali memproses job baru tanpa restart |
| PostgreSQL pause/unpause | PASS | live200, ready503 sekitar2005ms; DB dipulihkan tanpa kehilangan tmpfs |
| Storage persistence | PASS: 1 | File sintetis tetap identik setelah app container ID berganti, volume sama |
| Active worker SIGTERM drain | PASS: 1 | processing teramati, log draining -> done -> stopped, exit0; bukan provider live berdurasi panjang |
| Explicit image migration command | PASS | Empat migration existing pada DB disposable, rerun tidak mereset/seed |
| Actual Linux browser-bootstrap artifact | PASS: 1 | RED exit13 pada artifact lama, GREEN pada artifact final |
| Browser IAB smoke | PASS terbatas | Home/account/store/2D editor/admin login dirender dari gateway; console warn/error kosong pada snapshot yang dibaca |
| Home page widths | PASS terbatas | 360/390/768/1024/1440 measured scrollWidth sama dengan viewport; bukan seluruh platform responsive acceptance |
| CI YAML/steps | Validasi lokal | GitHub Actions remote SKIPPED karena belum push |

Tes upload menggunakan binary transport fixture dan PNG 2x2 yang dihasilkan lokal, bukan produk jualan atau empat GLB fase 8. Provider queue test memiliki label Demo/Sample, memakai StubProvider tanpa outbound call. Billing baseline stub yang lulus bukan bukti settlement/pembayaran aman.

## Browser artifacts

UI masih dark/indigo existing; keputusan monokrom + orange/shape UjiHub belum diterapkan. Screenshot smoke production build:

- [Home desktop 1440](artifacts/phase-3/home-1440.jpg)
- [Home mobile 390](artifacts/phase-3/home-390.jpg)
- [Store empty state 1440](artifacts/phase-3/store-1440.jpg)
- [Scene Editor 2D 1440](artifacts/phase-3/scene-editor-1440.jpg)
- [Admin login 1440](artifacts/phase-3/admin-login-1440.jpg)
- [Measured home widths](artifacts/phase-3/home-widths.json)

Tidak ada screenshot light mode, 3D/WebGL, checkout/merchant atau admin CRUD browser. Mobile navbar/keyboard, modal focus, seluruh halaman dan export belum diuji di fase ini. Full network audit tidak dilakukan; favicon hilang yang teramati diperbaiki. Link sidebar /login dan /bundle masih tidak memiliki route client, masuk backlog fase 7. Account anonymous fallback/content existing belum diperbaiki.

## Diagnosis, keputusan dan batas release

Kesalahan awal gateway berasal dari default temp path fastcgi/uwsgi/scgi pada root filesystem read-only. Semua temp path dipindah ke tmpfs; nginx -t dan gateway healthy lulus. Atomic bind-file replacement di Windows memerlukan recreate gateway test agar file baru terbaca. Tidak mengubah root menjadi writable atau menjalankan nginx sebagai root.

Typecheck awal menemukan BullMQ IRedisClient versi terkunci tidak menyediakan ping; readiness memakai queue getter resmi yang read-only, bukan any/cast. Lint sempat gagal karena global Web APIs Node test belum terdaftar; scope globals.node ditambahkan khusus script/test. URL/env regression diperketat dengan RED/GREEN untuk port0, DB hostname/database eksplisit, origin tanpa path dan absolute storage path. Tidak melonggarkan validation/role/auth.

Browser smoke memperlihatkan HTTP200/SSR saja tidak membuktikan SPA hidup: main client Linux menunggu react-dom/client, client chunk mengimpor React dari main. Async bootstrap yang tidak ditunggu di module scope memutus deadlock. CI sekarang menguji actual image artifact selain output build lokal Windows. Scene/editor state dan domain schema tidak diubah.

TLS certificate/reverse proxy production, managed PG/Redis TLS handshake, R2, Google OAuth, SMTP dan AI/merchant live **SKIPPED**. TLS URL/parser/default verification didukung, tetapi belum ada credential/private endpoint live. Health ready tidak membuktikan worker/schema/provider/entitlement; Redis lab tidak membuktikan durable recovery seluruh queue.

QRIS executable/adapter belum tersedia sampai fase 5. Runbook fase 3 menjelaskan isolasi runtime/credential/durable state dan gate aktivasi, tanpa mengarang endpoint atau worker palsu. Temuan security, atomic credits/settlement, replay/refund dan private paid asset access fase 1 tetap pekerjaan fase 4-5/9. Retry/concurrency bisnis tidak dinaikkan. Build masih memiliki warning chunk editor 3D/admin besar dan dua Fast Refresh warnings.

Review menemukan default storage validator berbeda dari selector runtime existing. Fix pass mewajibkan STORAGE_DRIVER dan, untuk local production, STORAGE_PATH absolut eksplisit. Regresi omitted-driver/path RED -> GREEN (13 deployment tests/93 assertions); app/worker image dibangun ulang dan validasi CLI dalam image lulus, missing driver startup exit1. Typecheck/lint serta 11 Node guards diulang lulus. HTTP/queue/outage suite tidak diulang setelah perubahan validasi ini karena lab sudah ditutup, config Docker yang sebelumnya diuji eksplisit sama dan tidak ada handler/queue/storage driver implementation diubah dalam fix pass.

Seluruh delapan container lab sudah berhenti, semuanya exited0 dan tidak paused. External network/volume lab dipertahankan untuk inspeksi; tidak ada volume/data existing dihapus. [Review independen akhir](phase-3-review.md) CLEAN setelah fix pass, termasuk ulang 13 deployment tests, 11 guards dan verifikasi 17 log/6 artifact hashes. Fase 3 selesai dalam scope yang disepakati; fase 4 belum dimulai. Fase ini tidak menyatakan seluruh platform production-ready.
