# Migrasi dan recovery data existing

Prosedur ini untuk operator pada environment yang diotorisasi. Phase10 hanya menjalankan migrasi di DB disposable; tidak mengakses atau mencadangkan DB production. Jangan mengeksekusi contoh terhadap production sebelum identitas tujuan, backup dan cutover disetujui.

## Sebelum mengubah schema

1. Catat image/app version lama, commit, migration journal aktual, PostgreSQL version, lokasi storage dan daftar worker/provider/payment writer. Pertahankan JWT_SECRET dan ENCRYPTION_KEY existing. Jangan menganggap schema sama hanya karena nama DB cocok.
2. Jadwalkan maintenance untuk financial writers, checkout, credit adjustment dan submission AI lama. Drain atau rekonsiliasi pending/processing/remote jobs. Worker QRIS harus menyimpan durable spool agar receipt tidak hilang selama API tidak tersedia; jangan menghapus spool atau session.
3. Backup DB konsisten, storage serta konfigurasi privat secara terpisah. Gunakan libpq service/PGPASSFILE privat, jangan menaruh password di command line, log atau repo. Contoh backup dengan service yang sudah disiapkan operator:

~~~bash
pg_dump --dbname "service=nesomn-production" --format custom --file nesomn-before-revision.dump
pg_restore --list nesomn-before-revision.dump
~~~

Simpan backup terenkripsi di lokasi terpisah. Daftar archive yang berhasil dibaca belum membuktikan restore. Siapkan DB clone BARU yang kosong, role dan extension yang diperlukan; restore hanya ke clone:

~~~bash
pg_restore --dbname "service=nesomn-restore-check" --no-owner --exit-on-error --single-transaction nesomn-before-revision.dump
~~~

Bandingkan schema, migration journal, jumlah/total transaksi, credit ledger, subscriptions/licenses, project JSON, receipt identity dan file hash/storage keys dengan snapshot sumber. Uji sample akun/project/download pada clone. Backup role/grants dan storage tidak digantikan oleh pg_dump database tunggal.

## Preflight dan migrasi eksplisit

Migration source ada pada api/drizzle/0000–0007 dan journal meta. Jangan menandai journal selesai secara manual atau generate migration baru untuk menutupi perbedaan schema existing.

Jalankan preflight read-only pada clone dengan env privat yang mengarah ke clone, menggunakan image release yang sudah dibangun:

~~~bash
docker run --rm --network nesomn-data-network --env-file .env.clone --entrypoint bun nesomn-app:release --no-env-file --no-install api/src/db/preflight.ts
~~~

Preflight memeriksa duplicate email/lisensi, parallel active AI jobs dan inventory legacy. Ini bukan pengganti inspeksi seluruh schema/ledger. Konflik atau schema yang tidak dikenal adalah STOP untuk operator; jangan reset/drop/deduplikasi massal. Tinjau histori dan kebutuhan rekonsiliasi per kasus.

Sesudah review/backup, jalankan migrator existing secara eksplisit pada clone:

~~~bash
docker run --rm --network nesomn-data-network --env-file .env.clone --entrypoint bun nesomn-app:release --no-env-file --no-install api/src/db/migrate.ts
~~~

Ulangi acceptance terhadap clone, catat journal/hash dan waktu migrasi. Perubahan0004–0007 menambah integrity, physical receipt identity, outbox/remote execution dan QRIS. Legacy ambiguous fulfillment/credit tidak dianggap sukses baru; rekonsiliasi required sesuai [security](security.md) dan [QRIS](payments-qris.md). Tidak ada schema baru pada phase10.

Pada cutover yang benar-benar diotorisasi, ulangi identity/backup/preflight pada target, lalu jalankan command migrator yang sama dengan env production yang sudah ditinjau. Main Compose up hanya menjalankan app/gateway dan tidak menjalankan migrasi otomatis. Jangan menjalankan drizzle push, db:seed, reset, down -v atau remove-orphans sebagai prosedur upgrade.

## Recovery

Jika validasi gagal sebelum migration commit, pertahankan log dan journal, jangan memaksa constraint. Jika app gagal setelah migration, hentikan writer baru, simpan snapshot pasca-kejadian dan rekonsiliasi receipt/job/ledger sebelum rollback. Mengganti image tidak otomatis membuat app lama kompatibel dengan schema/semantik baru.

Utamakan forward fix yang diuji pada clone. Bila restore diperlukan, operator memulihkan ke target BARU dan memverifikasi delta transaksi/receipt setelah backup; jangan menimpa DB aktif atau menghapus bukti pembayaran. Aktivasi ulang worker berurutan dan idempotent, bukan replay massal seluruh job/provider. Uji signed/private download, scene lama, saldo/entitlement dan receipt duplicate sesudah recovery.
