# Execution ledger: REVISION.md, fase 3

Mulai 31 Oktober 2026. Repository origin benar, branch works/runtime-tooling-upgrade, HEAD 041d225fca07ae405b440ca424a0c56f90fdac0f. Semua perubahan fase 1-2 dipertahankan. Tidak ada AGENTS.md ditemukan pada repository/parent yang diperiksa.

## Rulings

1. Tetap pada branch kerja existing karena fase 2 belum commit; jangan melakukan checkout/reset/commit otomatis. Biaya: diff fase 3 bersifat kumulatif; snapshot hash input memisahkan bukti fase 3.
2. Pertahankan raw API export untuk unit/integration dan Vite proxy development. Entry production baru memvalidasi env sebelum dynamic import dependency, mount API di /api serta static client/admin. Biaya: entry development dan production berbeda; acceptance menguji entry production nyata.
3. Gunakan API/storage/queue existing, tanpa library static/viewer baru. Alias /files mempertahankan URL lokal lama dan tetap melewati verifikasi HMAC API. Readiness tidak menguji provider/merchant/storage live atau membuktikan worker tersedia.
4. Worker QRIS belum ada sampai fase 5. Fase 3 harus memberikan boundary dan prosedur operator yang konkret, tetapi tidak membuat dummy consumer atau endpoint receipt palsu. Tidak mengklaim pembayaran QRIS sudah berjalan.
5. Default gateway port 8080 (konfigurabel), app 3000 private. Produksi membutuhkan TLS reverse proxy di depan gateway atau konfigurasi TLS gateway sendiri; secure cookie production dipertahankan. Tidak memakai Vite server pada production.
6. Root Dockerfile target app/worker menggantikan empat Dockerfile legacy dan admin/nginx.conf yang sudah tidak kompatibel dengan gateway baru. Source/workspace tetap terpisah. Biaya: command build lama harus mengikuti runbook baru; laporan fase 2 tetap historis.
7. Worker hanya memerlukan DB/Redis/ENCRYPTION_KEY; credential R2/JWT/payment tidak diwajibkan pada worker yang saat ini mengembalikan provider result URL. Tidak menduplikasi secret app ke worker env. Parser Redis menolak port 0 daripada diam-diam mengganti ke 6379.
8. Browser smoke menemukan bootstrap client Linux tertahan pada circular dynamic import: main await react-dom/client, sedangkan client chunk mengimpor React dari main. Local Windows build memiliki chunk berbeda sehingga tes fase 2 tidak mendeteksinya. Pindahkan bootstrap ke async function tanpa top-level await, tetap lazy untuk SSR. Biaya: satu penyesuaian source client wajib untuk SPA deployment, bukan perubahan UI. Regression test actual Linux artifact RED (unsettled TLA exit13), CI juga memeriksa artifact image.
9. Review menemukan default validator storage r2 berbeda dari runtime default local, dan default path berbeda. Wajibkan driver app dan absolute local path secara eksplisit; jangan menormalisasi/merotasi credential atau memindahkan data. Biaya: direct production entry harus mengisi field tersebut; image/Compose dan template sudah eksplisit.

## Pre-flight interfaces

- API raw /admin vs SPA /admin: mount raw API di /api agar tidak bertabrakan.
- Root-relative /files dari signed storage vs SPA: dispatch namespace tersebut ke API sebelum static.
- URL /nesomn-logo-*.svg admin: alias dua logo authored dari admin build ke root untuk kompatibilitas.
- Redis API/worker: satu parser URL yang sama, producer finite retries, consumer reconnect; tidak mengubah attempts/refund/idempotency bisnis pada fase ini.
- Storage local: mount volume external existing secara eksplisit dan path stabil; jangan membuat storage ephemeral atau menganggap lifecycle Compose memiliki data.

## Progress

Implementasi app/gateway, root multi-stage targets, production validation, static routing, readiness/liveness, Redis auth/index/TLS, local external storage dan worker lifecycle selesai. Frozen install/hash, typecheck, lint (dua existing warnings), production build, 11 Node guards, 13 deployment unit, 22 baseline unit dan 24 integration PASS. Dua image target build PASS; actual Linux bootstrap artifact RED exit13 -> GREEN. Tidak ada schema/migration/domain model perubahan.

Acceptance gateway5 tests PASS termasuk API404/assets/deep links/cookie/admin role/anti-spoof IP/upload413/PNG-Sharp/signed file/real queue consumer success/refund. Redis outage readiness503/live200/worker health1 -> recovery200 dan job consumption. DB pause readiness503 sekitar2005ms -> unpause. Storage persistence1 PASS setelah app recreate. Active sample job SIGTERM drain1 PASS: processing -> draining -> done -> stopped/exit0. Explicit image migration hanya DB disposable, tanpa reset/seed.

Browser smoke menemukan dan mengonfirmasi perbaikan bootstrap; screenshot dark existing home desktop/mobile, store empty, Scene2D, admin login disimpan. Home5 widths tanpa page overflow; bukan acceptance UI/3D/export penuh. Referensi favicon Vite hilang diperbaiki ke logo authored. Node scope globals diperbaiki setelah lint test WebAPI gagal; tidak ada disable rule menyeluruh.

Runbook deployment/workers/testing dan report disusun. Runtime Bun/Elysia/lockfile tetap fase2. Delapan container lab sudah exited0/tidak paused, tanpa penghapusan volume/network. Review fix storage RED tercatat storage-default-red.log; GREEN13/93, typecheck/lint/11Node guards serta image rebuild/CLI validation lulus. Full HTTP/queue/outage tidak diulang setelah config-only fix; backend handler dan config lab eksplisit tetap sama. Reviewer akhir CLEAN; ia mengulang 13 deployment tests dan 11 Node guards, memeriksa 17 hash log/6 artifacts. Fase3 COMPLETE dalam scope deployment/lifecycle, bukan production readiness seluruh platform. Fase4 belum dimulai. Semua aktivitas memakai lab terpisah, bukan deployment/DB/merchant production. Tidak ada commit/push/merge; branch/workspace dipertahankan.
