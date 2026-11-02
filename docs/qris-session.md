# ShopeePay session refresh otomatis

Worker memakai `auth.refresh_session(session)` dari SDK vendored yang sama (commit `e1b1b6968c570c0cb18ccf9ce4d95694e8df48de`); dependency dan kontrak provider tidak diganti. Metode ini mencetak ulang token merchant melalui sesi akun/SSO yang masih hidup. Ia bukan login tanpa autentikasi dan tidak menjamin sesi akun dapat diperpanjang selamanya.

## Konfigurasi Litepod

Gunakan image QRIS dari `deploy/litepod/qris.Dockerfile`, context root repository, port health privat3002. Isi env berikut bersama merchant/store, ingest URL, HMAC receipt key dan backfill existing:

```dotenv
SHOPEE_SESSION_FILE=/run/secrets/shopee-session.json
SHOPEE_SESSION_STATE_DIR=/data/shopee-session
SHOPEE_SESSION_REFRESH_SECONDS=1800
```

- **Seed JSON read-only:** session lengkap SDK, bukan JSON HAR/cookie export arbitrer, bukan string token saja. Gunakan object hasil `complete_login(..., merchant_id=..., store_id=...)` atau field `session` dari hasil `login_with_otp(...)` berstatus complete.
- Seed harus berisi version1, token `B:...`, merchant yang dipilih, store_id/stores yang cocok, cookies, merchants dan switch_credential dengan toc_nonce/spc_clientid/device_fingerprint. Tidak ada material SSO yang dikarang/diekstrak otomatis oleh worker.
- **Satu login awal** dilakukan operator melalui alur yang sah. Simpan JSON privat; jangan kirim sesi, cookie atau OTP ke chat, Git, frontend atau log.
- Mount seed pada /run/secrets/shopee-session.json secara read-only, permission0600, readable oleh UID container10001. Secret HMAC receipt tetap file read-only terpisah.
- Mount /data secara persisten, writable UID10001. Worker membuat subdirektori session mode0700, file session/lock mode0600. Jangan mount direktori session ini read-only: hasil rotasi harus dapat disimpan.
- Rootless Podman memerlukan mapping ownership yang benar. Jangan chown volume existing secara rekursif. Verifikasi backup dan permission melalui operator.
- Interval default1800detik (30menit), rentang300–86400detik. Ini jadwal operasional worker, **bukan TTL yang dijamin Shopee**. JWT cookie expiry tidak dijadikan bukti sesi akun masih hidup.

Template: [Litepod](../deploy/litepod/qris.env.example) dan [worker standalone](../integrations/qris/worker.env.example).

## Alur runtime

```text
read private seed → validate merchant/store → acquire session lock
    → load latest rotated session from persistent state
    → refresh at first use / scheduled interval
    → persist new token+cookies atomically
    → poll transactions
       token rejected (200020 / 2010000 / HTTP401)
          → refresh once → retry poll once
       parent account expired / CAPTCHA / incomplete renewal material
          → login_required; stop provider polling
       transport/server failure
          → persistent exponential backoff
```

Refresh terjadwal atau reaktif hanya memakai metode SDK yang sudah ada, tanpa request OTP/login/password otomatis. SDK memeriksa account login_status dan mengikat token ke merchant yang dipilih. Worker memvalidasi kembali merchant/store hasil refresh sebelum dipakai; store aktual juga diperiksa saat polling existing.

State rotasi disimpan dengan tempfile0600, fsync, atomic rename dan fsync directory. File lama tidak ditimpa sebagian bila penulisan gagal. Lock Linux antarproses mencegah dua writer melakukan refresh bersamaan pada state yang sama. Tetap jalankan **satu poller per merchant/store** dan lakukan drain/stop terencana sebelum rollout QRIS.

Setelah restart, worker menggunakan sesi hasil rotasi terakhir dan jadwal yang tersimpan; seed lama tidak menimpa sesi baru. Seed yang diganti dengan session lengkap baru memiliki fingerprint berbeda dan secara otomatis mengawali state sesi baru setelah validasi. Menyentuh file atau menulis ulang JSON identik tidak menghapus login_required/backoff.

## Error dan recovery

- Account session mati (SDK code48500102), CAPTCHA atau token yang tetap ditolak setelah refresh menghasilkan **login_required**. Tidak ada retry login/OTP tanpa batas.
- Network/server gagal memakai backoff30detik,60detik,120detik hingga maksimal1800detik. Backoff disimpan agar restart tidak memicu refresh storm.
- Status privat `/health/ready` menampilkan enum session (ready/refreshing/backoff/login_required/session_invalid/busy) tanpa token, cookie, phone, account ID atau provider payload. login_required menghasilkan503 walaupun heartbeat lama masih baru. Main worker menghapus heartbeat saat cycle gagal.
- Receipt yang sudah berada dalam SQLite spool **tetap dikirim sebelum/sesudah polling** ketika sesi memerlukan login ulang; ledger/settlement/idempotency tidak diubah.
- Saat login_required, login ulang melalui alur yang diotorisasi lalu ganti seed dengan session JSON baru. Worker membaca seed lagi pada cycle berikutnya. Untuk bind mount file tunggal, penggantian inode host bisa memerlukan recreate; mount direktori secret read-only atau fasilitas secret versioning platform lebih mudah diperbarui.
- Jangan menghapus spool receipt, reservation invoice, ledger atau session state untuk menyembunyikan error. Tidak ada perubahan status paid dari sesi/browser.
- Jika respons refresh hilang setelah provider merotasi kredensial, atau kontrak provider berubah, recovery masih mungkin memerlukan login ulang. Live renewal, durasi sesi dan merchant feed belum dibuktikan dengan akun nyata.

## Kompatibilitas token-only

Konfigurasi lama masih dapat menggunakan `SHOPEE_TOKEN_FILE` dengan file teks token privat. Untuk mode itu, **unset SHOPEE_SESSION_FILE**. Worker membaca ulang token tiap cycle seperti sebelumnya; silent refresh tidak tersedia karena token saja tidak membawa material SSO. Jika kedua env diisi, mode JSON diprioritaskan.

Kredensial ini hanya berada pada container QRIS. App tetap menggunakan QRIS_RECEIPT_SECRET untuk memverifikasi receipt; AI worker/client/admin tidak menerima sesi merchant. QRIS_ENABLED tetap false pada template app sampai operator menyelesaikan verifikasi merchant dan aktivasi terencana.

## Pengujian offline

```sh
docker build -t nesomn-qris-session:test integrations/qris
docker run --rm --network none nesomn-qris-session:test python -m unittest -v test_worker
docker image rm nesomn-qris-session:test
```

Suite mencakup SDK refresh nyata dengan MockTransport, periodic/reactive refresh, restart, expiry/CAPTCHA, backoff, merchant/store mismatch, atomic failure, permission/symlink, writer lock, status health dan delivery spool ketika login_required. Tidak login atau transaksi ke merchant nyata. Jangan memasukkan kredensial asli ke environment tes.
