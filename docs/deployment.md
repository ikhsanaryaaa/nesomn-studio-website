# Deployment app + gateway

Untuk deployment per container di Litepod, gunakan [runbook Litepod](litepod.md): Caddy platform langsung ke app3000, AI/QRIS terpisah. Compose dua service di dokumen ini adalah jalur Docker existing, bukan konfigurasi yang perlu diimpor ke Litepod.

As-built deployment app/gateway dengan kontrak keamanan, QRIS dan acceptance phase10. Mulai dari [release readiness](release-readiness.md), [as-built](as-built.md) dan [migrasi existing](migrations.md); bagian berlabel fase lama adalah riwayat. Main Compose hanya memiliki **app** dan **gateway**. PostgreSQL, Redis, storage volume dan worker memiliki lifecycle terpisah. Bukti lokal bukan pernyataan seluruh platform siap production.

```text
Browser HTTPS -> TLS reverse proxy -> gateway Nginx :8080 -> app Bun :3000
                                                         /api/* API existing
                                                         /admin/* admin SPA
                                                         client SPA/assets
                                                         /files/* signed local download
                                                           |
                                            external PostgreSQL, Redis, storage
                                            independent AI worker / QRIS receipt worker
```

## Build dan konfigurasi

Gunakan Bun 1.4.4 sesuai [runtime.md](runtime.md). Root Dockerfile adalah entry build yang didukung, dengan target `app` dan `worker`. Empat Dockerfile legacy dan admin/nginx.conf telah digantikan. Workspace/source tetap terpisah.

```bash
bun install --frozen-lockfile
docker build --target app -t nesomn-app:release .
docker build --target worker -t nesomn-ai-worker:release .
```

Image Bun 1.4.4 menggunakan digest terverifikasi fase 2. Gateway memakai Nginx **1.30.6-alpine**, multi-platform index `sha256:0e52bd054126cdc040b1276c0af347aeb02a41b9cfe305d6094767ac30e97949`, diverifikasi melalui registry resmi `docker buildx imagetools inspect nginx:stable-alpine` pada fase ini. [Official Nginx image](https://hub.docker.com/_/nginx). Runtime app/worker hanya dependency production (mengikuti frozen lockfile hasil remediasi phase10), tanpa Vite/ESLint. Client/admin dibangun dengan NODE_ENV=production dan VITE_API_URL=/api. Tidak ada secret build argument.

Salin template ke file BARU; jangan overwrite `.env` existing:

```powershell
Copy-Item .env.example .env.production
```

Isi file secara lokal/secret manager, batasi permission baca, jangan commit atau kirim ke chat. Wajib: DATABASE_URL, REDIS_URL, JWT_SECRET dan ENCRYPTION_KEY minimal 32 karakter, CLIENT_URL dan ADMIN_URL berupa origin HTTPS tanpa path. HTTP hanya diterima untuk localhost smoke. STORAGE_DRIVER wajib dipilih eksplisit local atau r2; local juga memerlukan STORAGE_PATH absolut eksplisit (image/Compose menetapkan /data/storage). Tidak ada pemilihan backend/path diam-diam pada entry production. R2 memerlukan endpoint HTTPS/bucket/access key/secret. Env tidak valid membuat startup exit 1 dengan nama field, tanpa nilai credential.

**Pertahankan ENCRYPTION_KEY existing** untuk membaca credential provider terenkripsi. Jangan menggantinya sebagai bagian upgrade. Jika key legacy terlalu pendek/tidak lolos validation, deployment perlu rencana re-encryption yang disetujui; jangan mengubah key secara diam-diam. Mengganti JWT_SECRET memutus sesi existing dan juga bukan langkah otomatis fase ini.

Set pengaturan Compose dalam file yang sama:

```dotenv
APP_IMAGE=nesomn-app:release
APP_ENV_FILE=.env.production
DATA_NETWORK=nesomn-data-network
STORAGE_VOLUME=nesomn-storage
GATEWAY_BIND=127.0.0.1
GATEWAY_PORT=8080
```

App selalu port internal 3000 dan storage mount /data/storage. Hanya gateway dipublish, default loopback `127.0.0.1:8080`; ubah GATEWAY_BIND hanya sesuai arsitektur reverse proxy/firewall yang ditinjau. Tidak ada Vite development server, migrate service, override atau profile tersembunyi.

## Network dan layanan existing

Periksa dahulu network dan identitas container. Buat network hanya bila belum ada:

```bash
docker network inspect nesomn-data-network
docker network create nesomn-data-network
docker ps --format '{{.ID}} {{.Names}} {{.Image}}'
docker inspect EXISTING_POSTGRES_CONTAINER --format '{{json .NetworkSettings.Networks}}'
docker inspect EXISTING_REDIS_CONTAINER --format '{{json .NetworkSettings.Networks}}'
```

Jika container existing yang benar belum terhubung, sambungkan tanpa membuat/menghapus DB/Redis:

```bash
docker network connect --alias nesomn-postgres nesomn-data-network EXISTING_POSTGRES_CONTAINER
docker network connect --alias nesomn-redis nesomn-data-network EXISTING_REDIS_CONTAINER
```

Contoh URL (ganti role/password/database yang benar, URL-encode password):

```text
postgresql://ROLE:PASSWORD@nesomn-postgres:5432/DATABASE
redis://USER:PASSWORD@nesomn-redis:6379/0
rediss://USER:PASSWORD@redis.private.example:6380/4
postgresql://ROLE:PASSWORD@postgres.private.example:5432/DATABASE?sslmode=verify-full
```

Managed/private DNS didukung selama routable dari host Docker/network dan sertifikat dipercaya. Jangan mematikan verifikasi sertifikat. Redis username/password, index, dan TLS dipakai sama oleh API/worker. URL query Redis ditolak; pilih index lewat path. Redis untuk BullMQ memerlukan persistence yang sesuai serta `maxmemory-policy noeviction`. Main Compose tidak mengubah konfigurasi Redis external.

Gateway hanya bergabung network web; app bergabung web dan data. Worker AI bergabung data secara independen. Default Docker DNS gateway meresolve app:3000 ulang tiap 10 detik agar recreate app tidak meninggalkan upstream IP lama.

## Storage dan integritas file existing

STORAGE_DRIVER=local membutuhkan volume EXTERNAL yang dipersiapkan operator:

```bash
docker volume inspect nesomn-storage
docker volume create nesomn-storage
```

Buat volume baru hanya untuk instalasi baru/restore terencana. App menggunakan UID/GID 1000 (bun); verifikasi permission tanpa menulis data:

```bash
docker run --rm --mount type=volume,source=nesomn-storage,target=/data/storage --entrypoint sh nesomn-app:release -c 'id; test -w /data/storage'
```

Sebelum cutover existing, hentikan perubahan/upload pada aplikasi lama secara terencana, backup DB dan file, lalu verifikasi lokasi storage AKTUAL. Dockerfile lama WORKDIR=/app biasanya menyimpan ke **/app/.storage**; development dengan cwd api biasanya api/.storage. Jangan menganggap hanya folder repository yang berisi data.

```bash
docker inspect OLD_API_CONTAINER --format '{{.Config.WorkingDir}} {{json .Mounts}}'
docker cp OLD_API_CONTAINER:/app/.storage BACKUP_DIRECTORY/storage
```

Sesuaikan path berdasarkan hasil inspeksi. Restore backup ke volume baru dengan tool backup/operator, pertahankan struktur key `assets/...`, sesuaikan ownership secara terencana untuk UID 1000, dan bandingkan jumlah/hash file sebelum beralih. Jangan menjalankan chown/delete rekursif pada volume existing tanpa pemeriksaan dan backup. Fase ini tidak mengimpor, memindahkan atau menghapus storage production.

Signed URL lama `/files/:key` tetap masuk API/HMAC, dan `/api/files/:key` juga tersedia. Storage tidak pernah menjadi static directory publik. R2 tetap private dan memakai presigned URL existing; upload/download/CORS R2 live belum dibuktikan. External volume tetap dideklarasikan pada Compose bahkan saat memilih r2, agar konfigurasi service tetap sederhana dan perubahan driver tidak membuang data lokal.

## Migrasi eksplisit

Tidak ada push/reset/seed/migration saat image build atau boot. Tidak ada schema change pada fase 3. Sebelum migration production:

1. Identifikasi DB/role/schema sebenarnya; hentikan writer/worker pada maintenance window yang disetujui.
2. Ambil backup DB dan storage, verifikasi backup dapat direstore pada DB disposable. Gunakan pg_dump/pg_restore versi kompatibel dan koneksi TLS/secret file yang sudah disetup operator. Jangan menaruh password pada command/history/log.
3. Inspect schema dan jurnal. Bandingkan SQL di api/drizzle serta jurnal dengan existing. Schema populated tanpa jurnal yang sesuai harus direkonsiliasi DBA; jangan menganggapnya DB kosong atau menjalankan semua migration ulang.
4. Jalankan migration di clone disposable dahulu, review diff schema/data, baru jalankan command explicit pada target yang telah diotorisasi.

Contoh backup lewat PostgreSQL service file lokal yang menyimpan koneksi secara aman:

```bash
pg_dump --dbname=service=nesomn --format=custom --file=/secure/backups/nesomn-before-upgrade.dump
pg_restore --list /secure/backups/nesomn-before-upgrade.dump
psql service=nesomn -c 'SELECT current_database(), current_user, version();'
psql service=nesomn -c "SELECT schemaname, tablename FROM pg_tables WHERE schemaname IN ('public','drizzle') ORDER BY 1,2;"
psql service=nesomn -c 'SELECT id, hash, created_at FROM drizzle.__drizzle_migrations ORDER BY id;'
```

`service=nesomn` adalah konfigurasi operator, bukan credential/template yang disediakan repository. Untuk Docker DB existing, pg_dump/psql dapat dijalankan di container DB yang telah diverifikasi dan backup disalin keluar; jangan menjalankan perintah terhadap nama container tebakan.

Setelah backup/schema disetujui, migrasi manual memakai image app yang sama (tetap hanya service app/gateway):

```bash
docker compose --env-file .env.production run --rm --no-deps --workdir /app/api app bun --no-env-file --no-install src/db/migrate.ts
```

Command ini telah diuji dua kali pada DB disposable dengan empat migration existing; bukan bukti aman atas setiap schema production. Tidak ada seed massal. Jika migration gagal, hentikan rollout dan investigasi; rollback/restore production memerlukan keputusan operator, bukan reset otomatis.

## Startup dan health

Jalankan setelah persiapan network/storage, pemeriksaan schema, konfigurasi dan acceptance yang sesuai:

```bash
docker compose --env-file .env.production config --services
# Expected tepat: app, gateway
docker compose --env-file .env.production up -d --no-build --wait --wait-timeout 120
docker compose --env-file .env.production ps
```

`docker compose config --services` default juga menghasilkan tepat app/gateway; ia menggunakan file env yang dipilih operator. Check aman tanpa `.env` existing: `node scripts/check-deployment.mjs`.

| URL gateway                                     | Fungsi                                                              |
| ----------------------------------------------- | ------------------------------------------------------------------- |
| /                                               | Client production SPA                                               |
| /admin/ dan /admin/login                        | Admin production SPA, base /admin/ tetap                            |
| /api/health                                     | Health API kompatibel existing                                      |
| /health/live                                    | Liveness proses, tanpa menunggu DB/Redis                            |
| /health/ready                                   | Readiness DB SELECT1 + BullMQ queue read; 503 saat gagal/timeout 2s |
| /api/unknown                                    | JSON404, tidak pernah index.html                                    |
| /assets/missing.js dan /admin/assets/missing.js | File404, tidak pernah SPA                                           |

Readiness tidak membuktikan schema/entitlement/provider/storage/worker siap. Container app healthcheck memakai readiness; gateway healthcheck memakai liveness upstream. Health tidak otomatis merestart container yang masih running tetapi unhealthy; restart policy berlaku untuk process exit. Alert/operator menangani outage dependency. App tetap melayani static/liveness saat dependency down.

Static HTML no-cache, Vite asset hashed immutable, logo authored kompatibel di root. Deep links client dibatasi pada route aktual; route public `/login` dan `/bundle` belum ada pada router existing (sidebar masih memiliki link tersebut), dicatat untuk fase 7. Halaman admin resources existing tetap dilayani; unknown file/API tidak menjadi HTML.

## TLS, forwarding, upload dan shutdown

Terminasi TLS default berada pada reverse proxy host di depan gateway loopback. Contoh Nginx host (path sertifikat operator):

```nginx
server {
    listen 443 ssl;
    server_name studio.example.com;
    ssl_certificate /secure/tls/fullchain.pem;
    ssl_certificate_key /secure/tls/privkey.pem;
    client_max_body_size 110m;
    location / {
        proxy_pass http://127.0.0.1:8080;
        proxy_set_header Host $http_host;
        proxy_set_header X-Forwarded-For $remote_addr;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection $connection_upgrade;
        proxy_read_timeout 300s;
    }
}
```

Tambahkan `map $http_upgrade $connection_upgrade { default upgrade; '' close; }` pada http context Nginx host untuk contoh di atas. Sertifikat, DNS, renewal dan redirect HTTP->HTTPS dikelola operator. Tidak ada TLS certificate production dibuat/dipasang oleh fase ini. Secure cookie tetap aktif pada NODE_ENV=production; acceptance HTTP memakai cookie header eksplisit dan tidak membuktikan login browser melalui TLS.

Secara default gateway **mengabaikan** X-Forwarded-For/Proto dari caller dan menggantinya dengan source/scheme koneksi. Untuk host TLS proxy, masukkan hanya CIDR SOURCE proxy yang benar-benar dilihat gateway ke `deploy/nginx/trusted-proxies.conf` (format `IP/32 1;`). Proxy tersebut wajib menimpa X-Forwarded-For menjadi SATU client IP terverifikasi dan X-Forwarded-Proto. Jangan trust 0.0.0.0/0 atau meneruskan header caller mentah. Multi-hop CDN memerlukan trust-chain di proxy depan; gateway menolak chain IP comma-separated dan kembali ke source proxy.

Validasi lalu reload/recreate gateway setelah perubahan config; bind mount file yang diganti atomik di Windows mungkin memerlukan recreate agar inode baru dipakai:

```bash
docker compose --env-file .env.production run --rm --no-deps --entrypoint nginx gateway -t
docker compose --env-file .env.production up -d --no-deps --no-build --force-recreate gateway
```

Gateway proxy ke app:3000, mempertahankan path/query/Host, menyediakan forwarded headers dan WebSocket Upgrade. Tidak ada route WebSocket existing; handshake WS belum diuji. Batas request gateway/app 110 MiB untuk file existing maksimal 100 MiB plus multipart; preview existing 25 MiB. Timeout connect 5s, read/send 300s, client body 120s. Root FS read-only, temp Nginx seluruhnya di tmpfs, user nginx non-root, cap_drop ALL, no-new-privileges. Access log hanya method/path/status tanpa query agar signed token tidak tercetak; error log level crit.

App SIGTERM berhenti menerima request lalu menutup queue/DB, Compose memberi 30s. Worker memiliki drain terpisah; lihat [workers.md](workers.md). Main Compose stop tidak menghentikan DB/Redis/worker atau menghapus external storage. Jangan memakai `--remove-orphans`, `down -v`, reset atau seed untuk upgrade dari stack lama.

## Verifikasi dan batas release

Lihat [testing.md](testing.md) dan [laporan fase 3](revision/phase-3-report.md). Acceptance lokal mencakup route/static, auth/RBAC, upload + Sharp thumbnail, signed download, queue consumer terpisah dengan Redis auth/db4, outage Redis/DB, serta file yang bertahan setelah recreate app. Browser smoke tidak menggantikan pengujian seluruh editor/export/theme/mobile pada fase UI. Keamanan/integrity/QRIS sudah diimplementasikan; batas live dan keputusan NO-GO production tercatat pada laporan phase10.

## Current security/integrity contract (phase4)

Apply reviewed additive migrations0004-0006 explicitly after backup/schema/preflight and draining old financial writers/AI jobs. App readiness checks required integrity tables/columns; successful SELECT1 alone is insufficient. See [security and migration](security.md) and [current disposable acceptance](testing-phase4.md). Never run push/reset/seed at container boot. Main Compose remains exactly app/gateway; worker/DB/Redis remain external. Production missing adapters/stubs fail closed and old payment history requires reconciliation; QRIS activation follows phase5.

## Current phase5 payment contract

Adapter QRIS ShopeePay tersedia, default disabled; schema0007 wajib dimigrasikan eksplisit sesudah backup/preflight, termasuk bila QRIS belum aktif. Ikuti [payments-qris.md](payments-qris.md) untuk konfigurasi static QR/merchant/store, key transport terpisah, worker Docker independen, session renewal, durable SQLite spool, cutover dan rekonsiliasi. Tidak ada token/live transaksi yang diuji. SDK alpha tidak menjamin live feed. Jangan rollback/drop schema atau reuse nominal; kapasitas finite999 per base price sepanjang histori. Main Compose tetap app/gateway dan TLS di reverse proxy depan gateway8080; app3000 private. Bagian fase3/4 di atas adalah riwayat, bukan indikasi adapter masih belum ada.
