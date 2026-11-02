# Laporan phase 9 — Scene 2D, AI workflow dan admin

Tanggal: 31 Oktober 2026. Repository: https://github.com/ikhsanaryaaa/nesomn-studio-website. Branch works/runtime-tooling-upgrade; HEAD lokal 041d225fca07ae405b440ca424a0c56f90fdac0f. Seluruh fase sebelumnya tetap working changes; tidak commit/push/merge/deploy. Snapshot input: phase-9-input.json.

## Perubahan

- Workspace 2D responsif dari area aktual, stage Konva menggunakan ukuran tampilan berskala tanpa mengubah logical document. Inspector layers/properties, label input, shortcut yang mengabaikan input/modal, touch deselection. Monokrom/orange dan font existing tetap.
- Export memakai logical dimensions, maksimum 1080px, tanpa selection controls. Ukuran/scale/visibility dipulihkan pada sukses maupun kegagalan. Error CORS ditampilkan.
- Load menolak project 3D, mengosongkan state lama dan menampilkan gagal load. Save tidak menandai edit selama request sebagai tersimpan; respons lama dan image callback dibatasi lifecycle dokumen. Tidak mengubah format scene 2D/3D atau schema.
- AI Scene/Motion menampilkan model/balance/status error dan Retry; saldo gagal bukan nol, status belum diketahui tetap pending, terminal memperbarui saldo. Prompt/job 2D bertahan antar-tab, recovery membaca riwayat server. Pembatalan hanya pending sesuai API; processing/provider tidak dibatalkan. needsReview tampak, gagal tidak otomatis diklaim refunded.
- Default admin memperbaiki resource assets menjadi assets-scene. Subscription dan credit ledger read-only memakai API existing. Guard server tetap wajib.
- Preview upload baru menyimpan referensi UUID stabil. Resolver memeriksa public reference/published atau admin dan MIME gambar sebelum signed redirect 300 detik. Tidak membuka private product files. Data signed URL lama tidak diubah massal.

## File penting

client/src/pages/scene-editor.tsx; components/editor/{scene-canvas,scene-inspector,canvas-object,editor-toolbar}.tsx; stores/scene-editor-store.ts; lib/{export-image,scene-viewport,api}.ts; hooks/use-ai-job.ts; components/ai/{scene-panel,motion-panel,credit-badge,job-recovery,pending-job-actions}.tsx.

admin/src/{App,resources,routes}.tsx; pages/{billing-records,assets-3d,assets-scene}.tsx. api/src/modules/{admin/uploads.routes,catalog/routes}.ts; api/src/web-app.ts. Tests scene-export, security/previews, editor-admin-browser, editor-gateway-browser; scripts/test-phase9.mjs. [Runbook/as-built](../editor-admin.md).

## Runtime dan deployment

Tidak ada upgrade dependency pada phase 9. Bun 1.4.4 lokal .cache/runtime/bun-1.4.4/bun-windows-x64/bun.exe (global mesin 1.4.0 tidak dipakai). Elysia 1.4.30 dan @elysiajs/cors 1.4.2 dipertahankan dari verifikasi stable phase 2; tidak mengklaim melakukan verifikasi npm latest ulang di phase 9. Docker Bun 1.4.4-alpine tetap pinned digest dalam Dockerfile.

Install: Bun 1.4.4, bun install --frozen-lockfile. Siapkan env dari .env.example, DATABASE_URL PostgreSQL eksternal, REDIS_URL dan storage. Network eksternal, migrasi eksplisit/backup, TLS serta worker mengikuti [deployment](../deployment.md), [runtime](../runtime.md), [workers](../workers.md) dan [QRIS](../payments-qris.md). Tidak ada migrasi phase 9; tidak ada boot migration.

Build bun run build. Main deployment docker compose config --services menghasilkan app lalu gateway. docker compose build dan docker compose up -d hanya setelah external dependencies disiapkan. Gateway default 127.0.0.1:8080; TLS di reverse proxy eksternal sesuai runbook. /health/live dan /health/ready; app tidak dipublish. Port lab 18091 hanya test lokal dan akan ditutup setelah acceptance.

## Pengujian dan batas bukti

Semua command memakai runtime pin dan environment test yang tidak memuat .env. DB hanya PostgreSQL disposable 127.0.0.1:55432/nesomn_revision_test; Redis test lokal atau private Docker.

| Command | Hasil | Bukti/batas |
| --- | --- | --- |
| bun install --no-env-file --frozen-lockfile | PASS | Bun 1.4.4, lock tidak berubah di fase ini |
| bun run typecheck | PASS | 5 workspace |
| bun run lint | PASS | 0 error; 2 warning React fast-refresh existing |
| bun run build | PASS | client/admin production + prerender; chunk-size warning existing |
| node scripts/test-phase9.mjs unit | PASS | 9 tests, 47 assertions: scene compatibility, fit, export restore/success/error, concurrent-save dirty |
| node scripts/test-phase9.mjs integration | PASS | 1 upload/preview test, 17 assertions + 29 security tests, 122 assertions |
| node scripts/test-baseline.mjs unit | PASS | 24 tests, 55 assertions |
| node scripts/test-qris.mjs unit | PASS | 4 tests, 12 assertions; tidak transaksi merchant |
| node scripts/test-deployment.mjs | PASS | 13 tests, 99 assertions |
| node tests/editor-admin-browser.mjs | PASS | compiled production assets + explicit HTTP fixtures; 5 viewport x 2 tema, pixel check, PNG/JPEG, polling/pending cancel/history/credit error, admin |
| node scripts/test-phase9.mjs gateway | PASS | actual Nginx/app Docker + real disposable auth/project persistence; own/foreign access, admin403 |
| docker build --target app -t nesomn-app:revision-phase9 . | PASS | final production image |
| docker build --target worker -t nesomn-ai-worker:revision-phase9 . | PASS | independent worker container health tested |
| docker compose --env-file .cache/revision-phase-9/deployment.env -p nesomn-revision-phase9 config --services | PASS | tepat app dan gateway |
| compose up -d --no-build --wait + HTTP checks | PASS | API/client/admin deep links, readiness, unknown API JSON404, missing JS404, sample GLB |
| Physical mobile/Safari, live AI/merchant/storage CORS | SKIPPED | tidak ada perangkat/kredensial live; bukan klaim production-ready |

Runner integration/gateway mewajibkan NESOMN_DISPOSABLE_TESTS=1. Persiapan isolated DB: docker compose -p nesomn-revision-test -f tests/compose.test.yml up -d --wait; migrasi memakai env fixed dari createTestInvocation, tidak memakai .env. Lihat docs/testing.md dan docs/testing-phase4.md. Browser fixture dapat diulang setelah build; gateway test memerlukan lab port 18091 dan DB disposable. Jangan mengganti URL test ke production.

[Browser fixture evidence](artifacts/phase-9/browser.json), [actual gateway browser](artifacts/phase-9/gateway-browser.json), [HTTP/worker health](artifacts/phase-9/gateway.json). Screenshot: scene-light-390.png, scene-dark-1440.png serta admin-{subscriptions,credit-ledger}-{light,dark}-{390,1440}.png di artifacts/phase-9. Browser Chrome 156.0.8078.74 headless, emulated viewport, bukan perangkat fisik. Store/viewer tidak direkam ulang pada phase 9; bukti phase 7/8 tetap terpisah.

## Risiko, perbedaan scope dan pekerjaan lanjut

1. Preview stable berlaku untuk upload baru; URL signed lama pada DB maupun image source scene lama perlu pemetaan/refresh terkontrol. Tidak migrasi massal atau mengubah authored source. Test legacy memakai fixture gambar lokal/data, bukan membuktikan semua URL historis masih aktif.
2. Admin subscription/ledger sengaja read-only; operasi attach/status/adjust API tetap ada dengan guard dan audit, tetapi UI mutasi finansial dan receipt reconciliation tidak dibuat. Tidak ada endpoint reconciliation list yang dapat digunakan tanpa menambah domain baru. Gunakan runbook QRIS untuk late/unmatched/needsReview.
3. CRUD admin existing, Motion input semua variasi, live signed CORS, keyboard/screen-reader seluruh aplikasi dan perangkat fisik belum acceptance menyeluruh. Phase 10 harus menguji matriks lintas modul ini. Tidak ada review independen baru; plugin workflow lama yang dirujuk REVISION tidak tersedia, tidak dianggap review CLEAN.
4. AI history hanya 50 job sesuai API; processing provider tidak dapat dibatalkan. Retry status berbeda dari mengirim job baru. Tidak ada perubahan harga, ledger, entitlement atau receipt trust boundary pada fase ini.
5. Tidak menambah halaman studio/services/works/contact atau klaim pemasaran yang tidak didukung sistem. Tidak migrasi framework/renderer atau dependency.

## Cleanup

Total 18 penghapusan container testing dalam dua putaran (12 awal, 6 setelah verifikasi lifecycle final). Pada setiap putaran, 4 referensi image app/worker/nginx/redis yang tidak dipakai container lain dihapus. Tag app/worker phase9 serta image yang diuji sudah diverifikasi tidak tersedia lagi. PostgreSQL image dipertahankan karena dipakai container lain. Hasil penghapusan dicatat di artifacts/phase-9/docker-cleanup.json setelah semua acceptance. Volume/data production, container/image proyek lain dan build cache global tidak dihapus.

Log command final tersimpan di [artifacts/phase-9/logs](artifacts/phase-9/logs). Snapshot hasil terstruktur: [phase-9-evidence.json](phase-9-evidence.json). Snapshot source input memisahkan perubahan phase9 dari dirty changes fase sebelumnya.
