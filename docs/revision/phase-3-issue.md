# App dan gateway dengan layanan data eksternal

## Summary

Laksanakan fase 3 REVISION.md pada repository nesomn-studio-website, base HEAD 041d225fca07ae405b440ca424a0c56f90fdac0f. Pertahankan seluruh perubahan fase 1-2 yang belum commit.

## Audit dan scope

Compose existing memiliki db/redis/api/worker/admin/client, API route internal tanpa prefix, client memanggil /api dan admin menggunakan base /admin/. Signed URL lokal existing menggunakan /files. API/worker mengabaikan credential, db index dan TLS Redis. Belum ada startup env validation, readiness atau graceful worker shutdown. Migration existing terpisah dan harus tetap eksplisit.

Gunakan Elysia mount untuk mempertahankan API internal dan menyajikannya di /api. Serve production assets client/admin melalui Bun, dengan fallback navigasi terbatas, missing assets 404, API JSON404 dan alias signed files yang tetap terproteksi. Pisahkan liveness/readiness. App dan worker non-root, frozen multi-stage image. Gateway hanya proxy app:3000. Tidak ada perubahan domain model/payment/UI/schema.

## Steps

- [x] Snapshot input fase 3, env/Redis/static/readiness tests RED.
- [x] Implementasi hosting, startup validation, lifecycle dan koneksi eksternal; tests GREEN.
- [x] Docker multi-stage app/worker, Compose tepat app/gateway, gateway config, safe env examples.
- [x] Docker build dan acceptance gateway pada DB/Redis disposable; worker independen enqueue/consume/reconnect/shutdown.
- [x] Frozen install/typecheck/lint/build/baseline; dokumentasi migration/network/TLS/AI-worker/QRIS boundary.
- [x] Review independen, perbaikan yang diperlukan, evidence dan master checklist.

## Files/folders

Dockerfile, docker-compose.yml, nginx.conf, .env.example, worker/Dockerfile, api/src/server.ts, api/src/web-app.ts, api/src/lib/runtime-env.ts, api/src/lib/redis.ts, api/src/lib/readiness.ts, api/src/modules/ai/queue.ts, api/src/db/client.ts, api/src/lib/storage/local-fs.ts, worker/src/index.ts, tests/deployment/*, scripts/check-deployment.mjs, docs/deployment.md, docs/workers.md, docs/testing.md, README.md, REVISION.md, docs/revision/phase-3-*, CI bila relevan. Daftar dapat disesuaikan dengan source; setiap perluasan dicatat ledger.

## Acceptance

`docker compose config --services` tepat app/gateway; tidak ada app host port. Build client/admin production. Unknown API JSON404, missing assets 404, deep links benar. Readiness 503 saat dependency tidak tersedia, tanpa kebocoran config. External PostgreSQL/Redis dengan shared network/private DNS. Tidak ada migration otomatis/seed/drop, tidak mengubah .env existing. Worker independen memiliki run command, health, shutdown dan bukti consume/recovery isolated. QRIS worker hanya runbook boundary karena adapter baru fase 5; tidak mengarang endpoint SDK.

## Constraints

Tidak melakukan deployment production, transaksi merchant, push/merge/reset atau menghapus volume/data existing. Gunakan Docker project/test network terpisah dan env sintetis. Jangan memakai .env existing untuk test. UI, auth hardening, billing atomicity dan QRIS tetap fase selanjutnya. Dokumentasi menyebut keterbatasan secara eksplisit.

Status COMPLETE dalam scope fase 3. Review independen CLEAN sesudah fix storage validation. [Laporan](phase-3-report.md), [evidence](phase-3-evidence.json), [review](phase-3-review.md). Fase 4 belum dimulai.
