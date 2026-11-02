# Deploy Nesomn Studio di Litepod — per container

**Update session refresh:** mode JSON sesi lengkap kini tersedia dengan refresh otomatis, state rotasi persisten dan status login_required. Ikuti [runbook sesi ShopeePay](qris-session.md); petunjuk token teks di bawah adalah mode legacy tanpa silent refresh.

Diperiksa 2 November 2026 terhadap [dokumentasi Litepod](https://docs.litepod.sh/en/deployment-types), [networking](https://docs.litepod.sh/en/servers) dan source [rollout](https://github.com/litepodsh/litepod/blob/f6def8b106b8526a60d7da505033f370c54df0cd/apps/api/src/deployment/rollout.rs) / [Dockerfile build](https://github.com/litepodsh/litepod/blob/f6def8b106b8526a60d7da505033f370c54df0cd/apps/api/src/deployment/git.rs). Source Litepod yang diperiksa: `f6def8b106b8526a60d7da505033f370c54df0cd`; versi instalasi pengguna belum diperiksa. Dokumentasi diambil lewat HTTPS saat web reader gagal mengakses halaman. Tidak ada akses atau perubahan panel/server Litepod.

## Topologi yang disiapkan

```text
Browser HTTPS -> Caddy milik Litepod -> nesomn-web :3000
                                      API /api/*
                                      Client SPA /
                                      Admin SPA /admin/*
                                      signed storage /files/*
                                         |
                         PostgreSQL + Redis + private storage
                                         |
                    nesomn-ai-worker :3001 (health privat)
                    nesomn-qris-worker :3002 (health privat)
```

Satu aplikasi Litepod = satu container. Jangan memakai Static upload atau Railpack untuk memecah client/admin/API: aplikasi web menggunakan Dockerfile root dengan asset production hasil build. Jangan menambahkan proses worker, Nginx, PostgreSQL atau Redis ke container web.

Gateway untuk jalur ini adalah Caddy milik platform. Nginx repository tidak diperlukan pada jalur Litepod langsung; konfigurasinya memakai resolver Docker `127.0.0.11` dan upstream `app:3000`, sehingga jangan menjalankannya tanpa adaptasi di Podman. `docker-compose.yml` existing tetap tepat dua service `app` + `gateway` untuk jalur Docker Compose terpisah; tidak ditumpuk dengan deployment Litepod ini.

## Pilihan aplikasi pada panel

| Aplikasi | Tipe / metode | Dockerfile (context root repository) | Port container | Domain / mount |
| --- | --- | --- | --- | --- |
| nesomn-web | Git repository / Dockerfile | `Dockerfile` | 3000 | `studio.example.com`; local storage memerlukan /data/storage |
| nesomn-ai-worker | Git repository / Dockerfile | `deploy/litepod/worker.Dockerfile` | 3001 | Tidak ada domain publik |
| nesomn-qris-worker | Git repository / Dockerfile | `deploy/litepod/qris.Dockerfile` | 3002 | Tidak ada domain publik; volume /data dan secret files |
| PostgreSQL | Database template atau layanan existing | Sesuai operator | 5432 privat | Volume DB persisten terpisah |
| Redis | Image Redis existing/terverifikasi | Sesuai operator | 6379 privat | Persistence dan noeviction untuk BullMQ |

Repository untuk ketiga Git app: `https://github.com/ikhsanaryaaa/nesomn-studio-website`. Pilih branch/commit release yang benar-benar memuat perubahan ini. Working tree lokal yang belum di-commit/push **tidak ikut** ketika Litepod clone GitHub. Pekerjaan ini tidak melakukan commit/push otomatis.

Dockerfile worker dan QRIS merupakan turunan otomatis source canonical. Tidak membutuhkan fitur pemilihan `--target` di panel. Semua COPY relatif root repository; jangan set context ke `worker/` atau `integrations/qris/`. File QRIS existing pada `integrations/qris/Dockerfile` tetap mendukung build lama dengan context `integrations/qris`.

Jika panel menggunakan Registry image, build/publish melalui CI/operator terlebih dahulu dan pilih referensi digest immutable:
```sh
podman build -f Dockerfile -t REGISTRY/nesomn-web:RELEASE .
podman build -f deploy/litepod/worker.Dockerfile -t REGISTRY/nesomn-ai-worker:RELEASE .
podman build -f deploy/litepod/qris.Dockerfile -t REGISTRY/nesomn-qris-worker:RELEASE .
```
Command contoh ini **tidak dijalankan ke registry** oleh pekerjaan ini. Pin digest setelah publish, masukkan credentials registry di panel, dan gunakan port sama seperti tabel. Tidak ada override start command yang dibutuhkan: CMD/USER/HEALTHCHECK sudah ada pada image.

## Env runtime dan secrets

Masukkan runtime variables ke masing-masing aplikasi di Litepod; jangan memakai build variables untuk kredensial. Template aman:
- [app.env.example](../deploy/litepod/app.env.example)
- [worker.env.example](../deploy/litepod/worker.env.example)
- [qris.env.example](../deploy/litepod/qris.env.example)

Template sengaja gagal sebelum nilai placeholder diganti. `NODE_ENV=production`; app `PORT=3000`; worker `WORKER_HEALTH_PORT=3001`; QRIS `QRIS_HEALTH_PORT=3002`. Health listener worker opsional untuk deployment lama, aktif hanya bila env port diberikan.

`CLIENT_URL` dan `ADMIN_URL` sama-sama origin HTTPS, misalnya `https://studio.example.com`, **bukan** `/admin` atau `/api`. URL admin browser adalah `https://studio.example.com/admin/`. API frontend tetap same-origin `/api`, tanpa build per domain.

Pertahankan `ENCRYPTION_KEY` existing persis: key baru membuat kredensial provider terenkripsi existing tidak dapat dibaca. App dan AI worker memakai DATABASE_URL, REDIS_URL, index Redis, dan ENCRYPTION_KEY sama. Jangan menyalin JWT/OAuth/merchant session ke AI worker. Jangan menaruh secrets pada VITE_* atau repository.

Set `GOOGLE_REDIRECT_URI=https://studio.example.com/api/auth/google/callback` dan daftarkan URI tepat itu pada Google. Secure cookie tetap aktif di production; domain/callback harus HTTPS. Konfigurasi OAuth/provider/payment harus diverifikasi di staging dengan kredensial yang memang diotorisasi.

### Proxy dan IP

Default template `TRUST_PROXY=0` mengabaikan X-Forwarded-For caller. Caddy masih menangani HTTPS dan cookie secure tidak bergantung header tersebut. Namun rate limiting bisa mengelompokkan pengguna berdasarkan IP proxy.

Hanya gunakan `TRUST_PROXY=1` setelah membuktikan app port tidak dapat diakses publik, seluruh caller privat dipercaya, dan Caddy menimpa XFF menjadi satu IP valid. Implementasi app sengaja menolak trust untuk list comma-separated. Jangan mengaktifkannya hanya karena platform memiliki proxy; uji header spoofing dan perilaku rate limiting pada instalasi sebenarnya. Network bersama Litepod dapat berisi app lain; private tidak otomatis berarti trusted. Tidak ada patch yang mempercayai seluruh network secara otomatis.

## Network dan layanan data

Di server yang sama, app yang saling mengakses memerlukan network Podman bersama. Dokumentasi menyebut `litepod-network`; periksa network aktual di panel atau `podman inspect`. Rootless Podman milik user lain dan Docker daemon Windows/Linux **bukan network yang sama**.

Gunakan alias DNS layanan yang stabil dari Litepod dan verifikasi alias bertahan setelah redeploy. Jangan memakai nama container candidate berakhiran release sebagai DATABASE_URL/REDIS_URL permanen. Source rollout Litepod menyediakan stable alias; cari alias aktual dari container/platform Anda, jangan menebak nama `db` atau `redis`.

Contoh inspeksi read-only pada host Litepod, sebagai user Podman yang benar:
```sh
podman ps --format '{{.Names}} {{.Image}}'
podman network ls
podman inspect ACTUAL_DB_CONTAINER
podman inspect ACTUAL_REDIS_CONTAINER
podman inspect ACTUAL_WEB_CONTAINER
```
Jangan membagikan output lengkap inspect karena dapat memuat env rahasia. Bila perlu sambungan network manual, operator harus memeriksa ownership dan memastikan konfigurasi koneksi diterapkan kembali pada setiap release; sambungan ad-hoc ke satu container tidak menjamin redeploy berikutnya.

Untuk DB/Redis managed/private DNS, tidak perlu network Docker external, tetapi endpoint wajib routable dari host/container. URL-encode password. Gunakan TLS sesuai provider; jangan mematikan validasi sertifikat. Redis harus kompatibel BullMQ, memakai persistence yang sesuai dan `maxmemory-policy noeviction`. Template database lain di Litepod (misalnya Dragonfly/KeyDB) tidak dianggap kompatibel otomatis tanpa tes BullMQ.

App dan worker tidak menggunakan `localhost` untuk menghubungi DB/Redis container lain. Jangan publish 5432/6379 ke internet. Litepod public edge hanya memerlukan port publik 80/443; port app yang diterbitkan platform harus loopback/private.

## Storage

Pilihan template app adalah R2 private: isi R2_ENDPOINT, R2_BUCKET, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY. Konfigurasi CORS bucket untuk domain web dan akses texture/model; jangan membuat bucket berbayar menjadi public. R2 live belum diuji pada pekerjaan ini.

Jika existing memakai local storage, gunakan `STORAGE_DRIVER=local`, `STORAGE_PATH=/data/storage` dan mount volume existing/hasil restore pada `/data/storage`, dapat ditulis UID container **1000**. Rootless Podman memetakan UID container ke host subordinate UID; jangan melakukan chown rekursif ke 1000 pada host tanpa memeriksa pemetaan. Gunakan pengelolaan volume Litepod/Podman yang sesuai, backup dulu, dan uji write permission sebagai USER image.

Jangan memakai filesystem container ephemeral untuk upload, database, atau spool QRIS. Sebelum cutover, identifikasi lokasi file existing, backup DB dan file bersama, restore ke target yang benar, lalu bandingkan count/hash. Lihat [deployment existing](deployment.md) untuk inspeksi storage lama.

QRIS memerlukan /data persisten, writable UID **10001**, serta dua secret file read-only:
- /run/secrets/shopee-session.json: JSON sesi lengkap untuk refresh otomatis, mode **0600**, readable UID10001; hasil rotasi disimpan pada /data/shopee-session (writable, persisten). Mode legacy tanpa refresh memakai /run/secrets/shopee-token dan unset SHOPEE_SESSION_FILE.
- /run/secrets/qris-receipt: nilai sama dengan QRIS_RECEIPT_SECRET app; random terpisah dari JWT/encryption key.

Gunakan fasilitas mount/secrets atau volume files yang tersedia pada versi panel Anda. Jangan mengasumsikan env otomatis menjadi file. Bila panel tidak menyediakan mount file/read-only/mode yang diperlukan, siapkan melalui operator atau deploy image QRIS dengan kontrol Podman yang memenuhi kontrak tersebut; **jangan mengubah worker agar menerima token browser atau membuat secrets world-readable**.

## Urutan rollout dan migrasi

1. Backup DB dan storage existing; buktikan restore di clone disposable. Inventaris invoice/provider/job lama dan verifikasi schema/jurnal dengan [runbook migrasi](migrations.md).
2. Siapkan PostgreSQL/Redis, DNS privat dan volume. Verifikasi network dari image aplikasi, tanpa mencetak URL/credential.
3. Build release images. Matikan auto-deploy sementara agar code baru tidak boot sebelum migrasi eksplisit selesai.
4. Jalankan migrasi **sekali secara manual**, memakai image app dan env runtime yang sudah diverifikasi. Jangan jadikan migration sebagai CMD, build step, atau startup worker.
5. Deploy web port3000, tunggu health readiness, sambungkan domain HTTPS lewat Caddy Litepod. Uji API, SPA deep link dan admin.
6. Deploy AI worker port3001 tanpa public domain setelah schema siap. Verifikasi heartbeat, queue/SQL outbox, debit/refund dan konfigurasi provider.
7. Aktifkan QRIS hanya setelah merchant/store/static payload diverifikasi. Deploy QRIS port3002 dengan spool dan secret file benar. Tidak ada transaksi merchant nyata yang dilakukan pekerjaan ini.
8. Uji staging dan cek release-readiness sebelum mengalihkan traffic production.

Contoh one-off migrasi POSIX di host Podman (placeholder wajib diganti target terverifikasi):
```sh
podman run --rm --network VERIFIED_DATA_NETWORK \
  --env-file /secure/nesomn-app.env --workdir /app/api \
  --entrypoint bun REGISTRY/nesomn-web@sha256:VERIFIED_DIGEST \
  --no-env-file --no-install src/db/preflight.ts
podman run --rm --network VERIFIED_DATA_NETWORK \
  --env-file /secure/nesomn-app.env --workdir /app/api \
  --entrypoint bun REGISTRY/nesomn-web@sha256:VERIFIED_DIGEST \
  --no-env-file --no-install src/db/migrate.ts
```
Preflight existing menuntut schema lama yang tersedia; database benar-benar baru dapat belum memiliki tabel. Periksa identitas/schema dahulu; jangan menganggap error berarti boleh reset. File env di host harus privat dan tidak disimpan di Git. Command ini tidak mengotorisasi migrasi production tanpa pemeriksaan/backup.

## Health, restart, resource dan recovery

| Container | Liveness | Readiness | Bukti |
| --- | --- | --- | --- |
| Web | /health/live | /health/ready | DB/schema integrity + Redis, bukan provider live |
| AI worker | :3001/health/live | :3001/health/ready | Worker running + heartbeat Redis terbaru; tidak membuktikan provider/job/DB sehat |
| QRIS worker | :3002/health/live | :3002/health/ready | Polling + delivery cycle berhasil dalam <120s; tidak membuktikan semua transaksi cocok |

Healthcheck image existing tetap dipertahankan. Endpoint worker tidak menampilkan job, token, feed atau connection string. Jangan memasang public domain pada health ports. Restart policy `Unless stopped` atau setara; unhealthy sendiri tidak selalu menyebabkan restart. Pantau backlog, lease, unmatched/late receipts dan disk, bukan hanya status container.

Litepod melakukan candidate rollout berdampingan. Source versi yang diperiksa menunggu container/image health dan dapat tetap mempromosikan container bila port listener tidak cocok, sambil memberi warning. Karena itu status deploy hijau bukan pengganti GET readiness dan tes bisnis.

Source rollout tersebut menghentikan release lama dengan grace **30 detik**. AI worker normal memerlukan drain hingga **300 detik** pada runbook existing. Jangan mengandalkan default Litepod untuk job provider panjang: hentikan/drain worker lama terencana dengan grace yang sesuai sebelum deploy worker, atau verifikasi konfigurasi grace versi platform yang digunakan. Jangan replay job processing/needsReview ke provider secara buta. App dan worker memakai protokol SQL lease/outbox/idempotency existing; itu tidak menghilangkan kebutuhan rekonsiliasi setelah hard kill.

Untuk QRIS, hindari dua poller merchant yang aktif saat rollout; lakukan stop terencana sebelum kandidat pengganti, tunggu exit, gunakan spool sama dan pertahankan backfill checkpoint. SDK/feed dapat rate-limit; receipt replay tetap idempotent di API. Jangan menghapus SQLite spool untuk memperbaiki deploy.

Gunakan satu replica untuk rollout awal, khususnya local storage dan QRIS. R2 mendukung file lintas host, tetapi scaling lintas host perlu tes lease/queue/storage dan akses DB yang benar. Beri build memory cukup untuk Vite client/admin dan batasi build concurrency; angka resource harus diukur pada server Anda, bukan dianggap jaminan.

Jika deploy gagal, periksa health, private DNS, secret file permissions dan env tanpa menampilkan nilainya. Rollback image tidak membalikkan schema secara otomatis. Jangan drop/reset/seed, menghapus volume atau mengubah ENCRYPTION_KEY sebagai recovery.

## Acceptance operator

- HTTPS domain, redirect/cookie, OAuth callback, CSRF/CORS dan IP/rate limiting.
- /, /admin/login, /editor/scene, /editor/3d serta asset hashed terbuka.
- Unknown /api/* menghasilkan JSON404; missing asset tetap404.
- Upload limit app tetap110MiB request (maks file existing100MiB); uji Caddy/CDN di depan agar tidak menolak lebih awal. Timeout dan body limit ingress Litepod/CDN harus cocok job/upload; tidak ada Nginx repository pada jalur ini.
- Save/load/export 2D/3D, pemulihan signed image, model GLB, private downloads dan role/ownership.
- Worker health, job completion/credit idempotency, drain/recovery; QRIS expiry/duplicate/late/unmatched pada test doubles/staging.
- File lokal/spool tetap ada sesudah recreate dan restore backup teruji.
- Worker/DB/Redis/secret files tidak memiliki domain/port internet publik.

[Hasil pengujian lokal](revision/litepod-2026-11-02.md) memisahkan PASS lokal dari hal yang belum diuji di Litepod. Tidak ada deployment production pada pekerjaan ini.

## Menjaga Dockerfile tetap sinkron

```sh
node scripts/generate-litepod-dockerfiles.mjs
node scripts/generate-litepod-dockerfiles.mjs --check
node --test tests/litepod-build.test.mjs
# Pinned Bun + synthetic env melalui runner release existing:
bun --no-env-file --no-install test tests/litepod.test.ts
node scripts/test-litepod-docker.mjs
```

Command lab Docker terakhir membangun tiga image, menyalakan app/worker + DB/Redis disposable pada network tes, menjalankan migration manual khusus DB tes, lalu unit QRIS offline tanpa network. Finally membersihkan container, tag image dan network miliknya saja, tanpa global prune/volume deletion. DB tes memakai tmpfs, bukan production. Lab menolak namespace/tag yang sudah dipakai. Build cache Docker tidak di-prune global; base image existing milik workload lain dipertahankan.
