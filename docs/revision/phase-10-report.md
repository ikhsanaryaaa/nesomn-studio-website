# Phase10 — acceptance dan release readiness

Repository: https://github.com/ikhsanaryaaa/nesomn-studio-website. Branch works/runtime-tooling-upgrade; HEAD lokal 041d225fca07ae405b440ca424a0c56f90fdac0f. Baseline input: phase-10-input.json; dirty changes fase1–9 dipertahankan. Tidak commit, push, merge, deploy atau mengakses DB/merchant production. Tanggal 31 Oktober 2026.

## Keputusan

LOCAL ACCEPTANCE sesuai bukti final. Production tetap NO-GO sampai backup/restore data existing, merchant/AI/OAuth/R2 live, TLS/network dan verifikasi operator diselesaikan. Phase10 selesai sebagai gerbang pengujian dan laporan, bukan izin mengeksekusi cutover.

## Perubahan nyata

- Gerbang scripts/release-check.mjs unit/integration mengisolasi env, memilih runtime pin, merekam setiap command/exit/log, dan menolak audit dependency yang gagal. scripts/release-lab.mjs menyiapkan tmpfs test DB, schema/fixture sintetis, tepat dua service utama, worker independen, production Linux assets, browser acceptance dan cleanup dalam finally. Guard mencegah namespace/tag/port asing diadopsi dan mencegah cleanup repo lain atau tag pre-existing.
- CI memakai gate yang sama dan job production-browser terpisah tanpa port service yang bentrok; regression phase9/10, artifact terbatasi dan cleanup tersedia. Remote GitHub Actions belum dieksekusi. Browser harness mendeteksi Chrome Windows/Linux/macOS, memisahkan artifact phase10 dan merekam diagnostics tanpa query token/cookie/console argument values.
- Audit awal 66 advisory menjadi nol pada 723 paket yang diperiksa. Fix dalam range didahulukan, lalu upgrade runtime pendukung/tooling serta override yang ditinjau. Tidak --force, ignore advisory atau bypass peer dependencies. [Keputusan dependency](../dependency-security.md).
- Drizzle ORM 0.45.4, Sharp 0.35.5, Zod 4.6.7 dipin; Zod record signature disesuaikan. parsePatch menjaga agar optional defaults Zod4 tidak mereset field PATCH yang tidak dikirim. Dua Hooks lint rules existing tetap aktif.
- Admin tetap Refine/Ant Design dengan Axios ber-cookie; adapter native URLSearchParams mempertahankan pagination/sort/count, PATCH, error/status dan idempotency headers, menghapus chain query-string/decode-uri-component yang tidak aman.
- Bug bundle diperbaiki: picker memakai endpoint admin bundle-assets untuk kedua domain, tanpa file keys. POST/PATCH bundle menyimpan metadata dan membership atomik; PUT replace-set mempunyai lock, validasi aset, batas200 dan dedup. Insert gagal tidak lagi menghapus isi lama. Format scene, harga, histori provider dan schema SQL tidak diubah. Favicon admin merujuk logo asli. Scroll area kerja 2D pada layar pendek diperbaiki; inspector properties tetap dapat dijangkau tanpa menghilangkan toolbar, dengan regresi390x720 dan kontrol44px.

## File/folder penting

scripts/release-{check,lab}.mjs; .github/workflows/ci.yml; tests/lib/browser-runtime.mjs; enam harness browser; tests/{release-runner,release-ci,patch-validation,admin-rest}; tests/security/{admin-workflows,bundle-integrity}; scoped admin fixture.

package.json, bun.lock, api/worker/admin manifests dan eslint.config.mjs. api/src/lib/validation.ts, modules/{project,ai}/routes.ts, modules/admin/{bundles,index,assets-3d,assets-scene,plans,credit-packs,ai-providers}; admin/src/providers/{dataProvider,rest}.ts, pages/bundles.tsx dan index.html; client/src/pages/scene-editor.tsx. README/REVISION serta [as-built](../as-built.md), [release runbook](../release-readiness.md), [migration/recovery](../migrations.md), deployment/testing/workers docs.

## Versi dan cara menjalankan

Bun aktual host-test dan Docker 1.4.4; Bun global mesin1.4.0 tidak dipakai. Elysia1.4.30/CORS1.4.2 diverifikasi npm latest stable dan diukur ulang di image. Bun official latest release bun-v1.4.4 bukan prerelease/draft. Runtime/digest Docker tetap pinned. Drizzle0.45.4/Sharp0.35.5/Zod4.6.7, Kit0.31.11; Axios1.20.0, React Router7.18.2 dan Vite7.3.7 melalui lockfile; ESLint10.14.0 dengan peer-compatible plugins. Snapshot registry/release dan log image hygiene ada di artifacts/phase-10.

Install/type/build via node scripts/release-check.mjs unit (memakai Bun pin dan frozen lockfile). Setup production: isi file env BARU dari .env.example, pertahankan secret existing, PostgreSQL via DATABASE_URL dan Redis via REDIS_URL eksternal. Siapkan network/storage eksternal dan worker menurut [deployment](../deployment.md)/[workers](../workers.md). Backup/preflight/explicit migration mengikuti [migrations](../migrations.md). Tidak migrasi/seed saat boot.

Build bun run build; docker compose build dan docker compose up -d hanya pada environment yang diotorisasi dan sudah disiapkan. Main services tepat app/gateway, app:3000 private, gateway default127.0.0.1:8080 dengan TLS di reverse proxy depan. /health/live dan /health/ready. Lab18092 hanya sementara dan dihentikan sesudah tes. Tidak ada data service/worker/profile/override tambahan pada main Compose.

## Command, hasil dan batas bukti

| Command/check | Status | Bukti |
| --- | --- | --- |
| node scripts/release-check.mjs unit | PASS | frozen install, online audit, lima workspace typecheck, lint, build/prerender dan seluruh group di bawah |
| bun install --no-env-file --frozen-lockfile | PASS | lockfile hasil remediasi reproducible, tanpa force |
| bun audit awal | FAIL, diremediasi | 66 advisory ditemukan; log awal dipertahankan |
| bun audit final | PASS | nol advisory pada 723 paket; awal66 disimpan sebagai temuan yang diperbaiki |
| bun run lint | PASS | 0 error, 2 warning Refresh existing |
| Node guards/contrast/bootstrap/CI safety | PASS | 19 Node tests; tidak mewariskan secrets atau mengadopsi port/tag/repo asing |
| Baseline unit / deployment / security unit | PASS | 24/55, 13/99, 9/64 (tests/assertions) |
| QRIS pure / viewer / scene | PASS | 4/12, 5/21, 9/47 |
| Theme/navigation/CI/PATCH/REST | PASS | 9 tests,57 assertions, termasuk header idempotency |
| node scripts/release-check.mjs integration | PASS | 63 executions,405 assertions pada fixed disposable DB: baseline24/65, security29/122, QRIS5/25, viewer2/8, admin/upload/bundle3/185 |
| Drizzle Kit check metadata | PASS | bun --no-env-file --no-install node_modules/drizzle-kit/bin.cjs check, cwd api; tidak generate/apply schema |
| Docker build app + worker + integrations/qris | PASS | tiga image production/offline dari lock/requirements pin |
| QRIS worker python -m unittest -v test_worker | PASS | 8 tes, Docker network none; spool/restart/ack/backfill/scope/replay |
| Main compose config --services | PASS | tepat app lalu gateway; no public app port, data/storage eksternal |
| Compose up --wait, HTTP dan independent AI worker health | PASS | /health live/ready, API JSON404, client/admin deep links, missing assets404; worker terpisah |
| Image hygiene | PASS | UID1000, Bun/Elysia/CORS/Drizzle/Sharp/Zod sesuai pin, tanpa .env dan Vite/ESLint runtime |
| Enam browser suites | PASS | actual Docker Linux assets; detail pemisahan fixture/real API di bawah |
| Cleanup container/image test | PASS | finally berjalan pada sukses/failure; image shared dipertahankan, volume tidak dihapus |
| GitHub Actions remote | SKIPPED | workflow diperbarui dan YAML/gate contract diuji lokal; tidak push/trigger remote |
| Merchant/AI/OAuth/R2/TLS/restore production | BLOCKED | konfigurasi/credential/clone/operator live tidak tersedia; tidak transaksi merchant nyata |
| Android/iOS/Safari/GPU fisik/screen-reader menyeluruh | SKIPPED | hanya Chrome host dan emulated viewport/software WebGL yang tersedia |

Log final dan results JSON: artifacts/phase-10/logs. Hasil group tidak boleh dijumlah sebagai coverage unik karena sebagian scene checks overlap. Audit nol bukan pentest. Perubahan SQL/journal dibanding baseline hash, tidak generate migration baru. Snapshot schema legacy di fixture tidak membuktikan kondisi DB production.

## Browser dan artifacts

Chrome156.0.8078.74 pada Windows menjalankan assets yang di-copy dari image Linux. Ini bukan bukti browser Linux CI atau perangkat fisik.

- theme/browser.json: lima viewport360/390/768/1024/1440, dua tema, persistensi/client-admin sync, font, reduced motion, drawer20Tab trap/Escape recovery dan API-failure fixture.
- public/browser.json: actual gateway browse/register/server quote/QRIS pending/unique code/QR/verified receipt/replay/Library/private download/account dan offline retry. Tidak menghubungi merchant.
- editor-gateway/gateway-browser.json: actual auth/API/DB, scene lama/baru, AddText/Undo/save, ownership404 dan regular-user admin403.
- editor-admin/browser.json: production assets dengan fixture eksplisit, 2D legacy/duplicate/undo, PNG/JPEG960x600, lima lebar x dua tema, AI pending/cancel/history/saldo outage, admin read-only; viewport390x720 memastikan field opacity terlihat/hit-testable44px setelah scroll.
- viewer/browser.json: empat GLB desktop/mobile, 12 repeated switches, satu Canvas, controls/fullscreen/reduced-motion, invalid/retry/no-WebGL, editor save dan PNG/JPEG/WebM yang didecode. Fixture API eksplisit.
- admin/browser.json: actual API/session/admin, create/edit credit pack dan bundle membership, seluruh resource list, lima lebar x dua tema.

JSON diagnostics menyimpan HTTP401 anonymous,503 failure fixtures, intentional offline/abort dan status lainnya secara eksplisit tanpa query tokens. Tidak ada Runtime.exception pada suite yang selesai. Screenshot per surface ada pada folder yang sama; screenshot dipilih di release-readiness.md/laporan, bukan klaim seluruh kombinasi halaman telah diuji.

Screenshot terpilih: [home light desktop](artifacts/phase-10/public/home-light-1440.png), [store dark desktop](artifacts/phase-10/public/store-dark-1440.png), [2D light mobile](artifacts/phase-10/editor-admin/scene-light-390.png), [properties pada layar pendek](artifacts/phase-10/editor-admin/scene-properties-short-mobile.png), [3D editor desktop](artifacts/phase-10/viewer/editor3d-1440.png), [room GLB mobile](artifacts/phase-10/viewer/nesomn-lowpoly-room-390.png), [admin dark mobile](artifacts/phase-10/admin/credit-packs-dark-390.png). Semua data bertanda Sample pada test fixture, bukan katalog/harga live.

## Risiko, sisa pekerjaan dan deviasi

1. Live merchant ShopeePay/session/feed, provider AI, Google callback, R2/private CORS dan DNS/TLS production tidak diuji. Credentials tidak tersedia, tidak disalin ke repo/image dan tidak diminta sebagai teks chat. Transaksi nyata memerlukan instruksi eksplisit terpisah.
2. Restore backup clone production, schema drift, histori fulfillment/credit ambiguity, drain dan rekonsiliasi operator belum dibuktikan. Tes upgrade fixture tidak menggantikan itu. URL signed historis pada katalog/scene perlu pemetaan/manual refresh, tanpa mass rewrite.
3. Tidak ada dashboard manual paid/receipt reconciliation baru. Subscription/ledger UI read-only; API financial mutations yang sudah tersedia tetap role guarded dan diuji pada suite existing. Tidak membuat halaman studio/services/works/contact/inquiry yang belum didukung source.
4. Browser host Chrome/software WebGL dan viewport emulasi tidak membuktikan Android/iOS/Safari/GPU fisik atau heap/GPU stability jangka panjang. Semua resource list admin dibuka, tetapi seluruh kombinasi form/keyboard/tool editor/Motion live tidak diklaim diuji exhaustively.
5. Lingkup fase10 melebar ke remediation dependency karena audit nyata menemukan66 advisory. Override transitive dan perubahan Zod dijelaskan di dependency-security.md; aplikasi tetap Bun Workspaces/React/Refine/Elysia/Drizzle, tidak ada migrasi framework/domain.
6. Scope juga memperbaiki bundle picker/membership yang ditemukan tidak tersambung/atomik. Perubahan API backward compatible: assetIds opsional pada POST/PATCH; endpoint PUT existing tetap ada dan lebih aman. Tidak mengubah harga/quote/lisensi atau format scene/export.
7. GitHub CI sudah disiapkan, belum dijalankan remote. Tidak ada review independen/pentest baru. Workflow plugin lama yang disebut master plan tidak tersedia pada host; tidak mengarang hasil review CLEAN.

## Cleanup dan release gate

Putaran final menghapus tujuh container lab (app/gateway, DB/dua Redis, AI worker dan QRIS offline) serta lima referensi image app/AI/QRIS/nginx/redis yang tidak digunakan container lain. Image PostgreSQL dipertahankan karena dipakai container lain. Keberadaan tag/image yang diuji dicek lagi setelah cleanup. Riwayat cleanup per putaran tersimpan; tidak ada volume, network, credential, global build cache atau resource proyek lain yang dihapus.

Bukti: [cleanup](artifacts/phase-10/docker-cleanup.json), [lab summary](artifacts/phase-10/lab-summary.json), [gateway/image](artifacts/phase-10/gateway.json), [evidence terstruktur](phase-10-evidence.json). Gate production/operator: [release-readiness.md](../release-readiness.md). Tidak ada klaim platform production-ready.
