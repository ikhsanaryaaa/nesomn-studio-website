# Release acceptance dan keputusan rilis

Gerbang lokal tersedia pada scripts/release-check.mjs dan scripts/release-lab.mjs. Hasil final, screenshot dan blocker ada di [laporan phase10](revision/phase-10-report.md). Lolos tes disposable tidak memberi izin merge/deploy atau transaksi merchant nyata.

## Mengulang acceptance

Gunakan Node 24.18.0, Docker Desktop/Engine + Compose dan Chrome/Chromium. Bun harus 1.4.4 di PATH; pada workspace Windows ini runner otomatis memilih .cache/runtime/bun-1.4.4/bun-windows-x64/bun.exe sehingga Bun global 1.4.0 tidak digunakan.

~~~bash
node scripts/release-check.mjs unit
~~~

Unit gate melakukan frozen install, audit online yang fail-closed, typecheck/lint/build/prerender, guards, Compose, GLB, viewer, scene, UI dan CI contract tests. Tidak membaca .env. Jika registry tidak dapat diaudit, itu gagal/blocker, bukan clean audit.

Full lab memakai data sintetis, menguji migrasi dan fixture legacy, membangun app serta worker, menyalin assets Linux dan menjalankan browser pada host. PowerShell:

~~~powershell
$env:NESOMN_DISPOSABLE_TESTS = '1'
node scripts/release-lab.mjs run
~~~

POSIX:

~~~bash
NESOMN_DISPOSABLE_TESTS=1 node scripts/release-lab.mjs run
~~~

Jangan mengganti endpoint test ke production. Script menolak namespace/container/tag yang sudah ada dan port yang terpakai. DB tetap 127.0.0.1:55432/nesomn_revision_test, Redis 56379, gateway release lab 127.0.0.1:18092. Prepare/migration/fixture hanya dijalankan pada container tmpfs baru dengan identitas test yang diverifikasi. Test namespace nesomn-revision-test dan nesomn-release-test tidak menjadi bagian deployment utama.

Network/volume lab baru diberi label ownership repository. Storage/network tidak dihapus otomatis. Main Compose tetap app/gateway, sedangkan test DB/Redis/AI/QRIS dibuat independen dengan nama dan label terbatasi. QRIS test container memakai network none; tidak login atau transaksi merchant live.

Lab memiliki finally cleanup untuk container/image testing, termasuk saat tes gagal. Jika proses terputus dan resource tersisa, inspect dahulu lalu gunakan cleanup terbatasi dengan opt-in yang sama:

~~~bash
NESOMN_DISPOSABLE_TESTS=1 node scripts/release-lab.mjs cleanup
~~~

Cleanup memeriksa working directory/labels dan ownership manifest; tag yang sudah ada sebelum run atau milik repo lain tidak diadopsi. Image yang dipakai container lain dilewati. Tidak menjalankan global prune, down -v, penghapusan volume, atau mengubah data production. Build cache global tetap ada.

## Bukti dan CI

Log unit/integration/lab ada di .cache/revision-phase-10/ dan salinan bukti final di docs/revision/artifacts/phase-10/. Browser menggunakan compiled production assets, fixture failures berlabel atau actual Docker API sesuai JSON masing-masing. Diagnostics menyimpan status/path tanpa URL query, cookie, atau isi console argument. Jangan mengartikan error401/503 fixture atau network-offline yang disengaja sebagai kegagalan tak terduga.

Workflow CI memiliki job unit/integration dan job production-browser terpisah tanpa service CI yang bentrok port. Artifact hanya logs/results/screenshots yang diizinkan, retensi tujuh hari; env file dan browser profile tidak di-upload. actions/upload-artifact v7 mengikuti [dokumentasi resmi](https://github.com/actions/upload-artifact). Eksekusi GitHub Actions remote belum dilakukan dalam sesi lokal ini.

## Gerbang production yang belum ditutup

- Restore backup DB + storage existing ke clone, preflight/journal, inventaris duplicate/legacy fulfillment/credits dan drain worker harus diverifikasi operator. [Prosedur migrasi](migrations.md).
- QRIS ShopeePay merchant/store/static QR, hak baca SDK/session, expiry/renewal dan feed yang benar harus diverifikasi dengan konfigurasi pengguna. Transaksi nyata hanya sesudah instruksi eksplisit. SDK alpha dan kapasitas nominal yang finite tetap risiko operasional. [Pembayaran](payments-qris.md).
- Google OAuth client/callback production, provider AI live/result CORS, R2/private signed URL/CORS dan jaringan managed DB/Redis belum diuji dengan credential nyata.
- DNS, TLS termination/forwarded trust, firewall, persistent storage, backup automation dan monitoring production belum dioperasikan oleh acceptance loopback ini.
- Chrome viewport/software WebGL bukan pengganti perangkat Android/iOS, Safari, GPU fisik atau audit screen-reader menyeluruh.

Keputusan: LOCAL ACCEPTANCE sesuai hasil final; production tetap NO-GO sampai gate eksternal di atas dibuktikan. [As-built](as-built.md), [deployment](deployment.md), [workers](workers.md), [dependency security](dependency-security.md).

## Landing / Works / About / Studio Kit acceptance — 3 November 2026

See [phase5 report](revision/marketing-phase5-2026-11-03.md). Run node scripts/test-portfolio-lab.mjs --acceptance for disposable legacy0008 migration, repeatable single sample import, production Docker app + real Nginx and extracted-asset browser tests. Lab containers/images are removed in finally. Main deployment Compose remains exactly app/gateway; test dependencies are isolated and not deployment services.

The Windows headless full editor export test still fails on WebM (NS-BUG-007). Preview, save, PNG/JPEG and portfolio acceptance do not close this failure. Resolve/verify on real supported browsers before promising video export. TLS/domain ingress, OAuth, storage CORS/signed renewal, AI/QRIS workers and production backup/restore still need operator verification. No production-ready claim.
