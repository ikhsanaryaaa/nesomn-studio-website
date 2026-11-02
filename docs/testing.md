# Pengujian terisolasi dan release gate

**Entry point current (phase10):** [release-readiness.md](release-readiness.md). Jalankan node scripts/release-check.mjs unit dan lab disposable dengan opt-in; runner mencakup seluruh suite sampai phase10 serta cleanup container/image. Bagian baseline berikut menjelaskan pengujian historis dan prosedur suite individual, bukan status release terkini.

Disiapkan pada fase 1 dan diperbarui pada fase 2, 31 Oktober 2026. Jalankan dari root repository dengan Bun 1.4.4 aktif pada PATH sesuai [runbook runtime](runtime.md). Tidak memerlukan perubahan .env atau credential merchant.

## Pengujian tanpa database

```bash
bun run build
node --test tests/baseline-runner.test.mjs tests/runtime-pin.test.mjs tests/prerender-exit.test.mjs tests/browser-bootstrap.test.mjs
node scripts/test-deployment.mjs
node scripts/check-deployment.mjs
node scripts/test-baseline.mjs unit
```

Build menyiapkan bundle untuk tes prerender. Node test memeriksa pengaman runner, pin runtime, serta prerender tiga route yang harus keluar tanpa open handle. Command unit menjalankan empat file unit existing serta kontrak scene legacy. Runner hanya mewariskan environment OS yang diperlukan, memasang nilai sintetis, serta memanggil Bun dengan `--no-env-file --no-install`. Credential shell/provider tidak diwariskan. Tidak ada install dependency otomatis.

Jangan memakai `bun test` tanpa isolasi untuk baseline ini: test existing dapat insert/delete user, subscriptions, orders, ledger, provider dan job pada DB dari environment. Runner memakai daftar file eksplisit agar test baru tidak otomatis mendapat akses DB.

## PostgreSQL dan Redis disposable

Konfigurasi test terpisah: `tests/compose.test.yml`. Tidak di-include oleh Compose utama atau profile/override deployment. Gunakan project `nesomn-revision-test` dan pastikan belum ada project dengan nama itu yang berisi data penting.

```bash
docker compose -p nesomn-revision-test -f tests/compose.test.yml config --services
docker ps -a --filter label=com.docker.compose.project=nesomn-revision-test
docker compose -p nesomn-revision-test -f tests/compose.test.yml up -d --wait --wait-timeout 90
```

Expected services: `test-db`, `test-redis`. DB berada di `127.0.0.1:55432/nesomn_revision_test`, Redis di `127.0.0.1:56379/0`. Credential DB adalah fixture publik `nesomn_test`, bukan credential production. Data memakai tmpfs; tidak ada named volume. Stop/recreate container menghilangkan data test. Jangan memakai endpoint ini untuk data berharga.

Runner integration sengaja tidak menerima URL database/Redis alternatif. Port tetap dan flag opt-in mengurangi salah target, tetapi tidak membuktikan identitas server secara kriptografis. Operator tetap harus memastikan port tersebut milik container disposable di atas; jangan mengarahkan port itu ke DB existing.

## Migration dan fixture test

Periksa terlebih dahulu identitas container test:

```bash
docker compose -p nesomn-revision-test -f tests/compose.test.yml exec -T test-db psql -U nesomn_test -d nesomn_revision_test -Atc "SELECT current_database(), current_user;"
```

Expected: `nesomn_revision_test|nesomn_test`. Migration berikut hanya untuk DB test tersebut. Ia memanggil entry script migration existing secara langsung agar tidak membuat nested Bun yang memuat .env lagi:

```bash
node --input-type=module -e "import { spawnSync } from 'node:child_process'; import { createTestInvocation } from './scripts/test-baseline.mjs'; const env = createTestInvocation('unit', process.env).env; const r = spawnSync('bun', ['--no-env-file', '--no-install', '--cwd', 'api', 'src/db/migrate.ts'], { env, stdio: 'inherit' }); process.exit(r.status ?? 1);"
```

Isi satu plan sintetis setelah migration, menggunakan PowerShell:

```powershell
Get-Content -LiteralPath tests/fixtures/baseline-plans.sql -Raw | docker compose -p nesomn-revision-test -f tests/compose.test.yml exec -T test-db psql -v ON_ERROR_STOP=1 -U nesomn_test -d nesomn_revision_test
```

Atau pada shell POSIX:

```bash
docker compose -p nesomn-revision-test -f tests/compose.test.yml exec -T test-db psql -v ON_ERROR_STOP=1 -U nesomn_test -d nesomn_revision_test < tests/fixtures/baseline-plans.sql
```

SQL fixture memeriksa nama DB dan role serta hanya menambah plan yang dibutuhkan test existing. Tidak menjalankan seed aplikasi, membuat akun admin, atau mengubah katalog produk.

## Integration baseline

PowerShell:

```powershell
$env:NESOMN_DISPOSABLE_TESTS = '1'
node scripts/test-baseline.mjs integration
```

POSIX:

```bash
NESOMN_DISPOSABLE_TESTS=1 node scripts/test-baseline.mjs integration
```

Runner memeriksa ketersediaan dua port sebelum memuat test. Exit 2 berarti BLOCKED oleh guard/dependency yang belum tersedia; exit 1 berarti test/runtime gagal; exit 0 berarti file test yang dipilih lulus. Kode exit 2 tidak dihitung sebagai PASS integrasi.

Test integration memiliki setup/cleanup data dan belum semuanya membersihkan setiap record. Jangan menjalankan instance suite paralel pada DB yang sama. Recreate DB disposable untuk baseline bersih setelah run yang gagal. Keterbatasan fixture cleanup existing dicatat pada audit.

## Penutupan environment

Hentikan hanya project test yang dibuat untuk run ini:

```bash
docker compose -p nesomn-revision-test -f tests/compose.test.yml stop
```

Tidak ada perintah reset/drop atau penghapusan volume dalam prosedur ini. Karena tmpfs, setelah start ulang migration dan fixture harus diterapkan kembali. Jangan memakai Compose utama untuk shutdown test.

## Baseline dan batas pembuktian

Lihat `docs/revision/phase-1-audit.md` dan `docs/revision/phase-1-baseline.json`. Log lengkap lokal berada di `.cache/revision-phase-1/2026-10-30/`, yang diabaikan git. JSON baseline menyimpan identitas, scripts/dependency manifests, hasil command, hash migration dan hash source aplikasi; tidak menyimpan isi .env atau credential nyata.

Hasil ulang fase 2: 10 Node guard/regression, 22 unit/scene dan 24 integration lulus. Build artifact memakai NODE_ENV=production, sementara runner test tetap test. Empat migration existing berhasil pada DB disposable, bukan production. Lihat [laporan fase 2](revision/phase-2-report.md) dan `docs/revision/phase-2-evidence.json`; log lokal berada di `.cache/revision-phase-2/`. Hasil fase 1 tetap disimpan sebagai baseline historis.

- Unit scene hanya membuktikan serialisasi state dan undo, bukan WebGL, ukuran export, CORS atau hasil visual.
- Worker stub test memanggil processJob langsung. Itu bukan bukti BullMQ consumer/retry berjalan end-to-end.
- Redis PONG bukan bukti transaksi queue/credit atomik.
- Migration pada DB kosong tidak membuktikan upgrade aman atas data/schema production yang telah berubah.
- Catatan historis baseline fase1: QRIS saat itu baru fixture. Receipt endpoint/settlement sekarang tersedia dan diuji ulang pada phase5/10.
- Test guard dijalankan RED sebelum runner ada, lalu GREEN setelah implementasi. Baseline aplikasi yang gagal tidak diperbaiki pada fase audit.

## Acceptance deployment fase 3

`node scripts/test-deployment.mjs` menjalankan 13 tes tanpa DB: startup env/Redis URL, driver/path storage production eksplisit, mount API, static/SPA/HEAD/cache/traversal dan readiness timeout. `node scripts/check-deployment.mjs` menggunakan hanya .env.example, tidak .env existing, untuk memeriksa app/gateway, app port private serta external network/storage. Tidak menghubungi DB/provider.

Untuk HTTP/worker acceptance, gunakan lab lokal berikut. **Jangan mengganti URL/env test dengan production**. Mulai PostgreSQL/Redis baseline, migration dan fixture plan sesuai bagian di atas. Lalu periksa bahwa nama resource berikut belum digunakan untuk data penting; buat/connect hanya jika belum ada dan sudah terverifikasi milik lab:

```bash
docker network create --label nesomn.revision-test=phase3 nesomn-revision-data-test
docker network connect --alias revision-db nesomn-revision-data-test nesomn-revision-test-test-db-1
docker volume create --label nesomn.revision-test=phase3 nesomn-revision-storage-test
docker run -d --name nesomn-revision-redis-private --label nesomn.revision-test=phase3 --network nesomn-revision-data-test --network-alias revision-redis redis:7-alpine redis-server --requirepass synthetic-redis-password --appendonly no --maxmemory-policy noeviction
```

Redis ini tidak mempublish port dan sengaja berbeda dari Redis baseline 56379. Authentication serta database index 4 diuji; TLS config diperiksa unit, handshake managed Redis TLS belum diuji. Redis lab tidak persisten; outage test membuktikan reconnect dan pemrosesan job baru, bukan durability seluruh antrean.

Buat env khusus lab di .cache (semua nilai di bawah sintetis/public fixture), PowerShell:

```powershell
New-Item -ItemType Directory -Force .cache/revision-phase-3 | Out-Null
@'
NODE_ENV=production
DATABASE_URL=postgresql://nesomn_test:nesomn_test@revision-db:5432/nesomn_revision_test
REDIS_URL=redis://:synthetic-redis-password@revision-redis:6379/4
JWT_SECRET=synthetic-deployment-jwt-secret-never-production
ENCRYPTION_KEY=synthetic-deployment-encryption-secret-never-production
CLIENT_URL=http://127.0.0.1:18080
ADMIN_URL=http://127.0.0.1:18080
STORAGE_DRIVER=local
STORAGE_PATH=/data/storage
DATA_NETWORK=nesomn-revision-data-test
STORAGE_VOLUME=nesomn-revision-storage-test
APP_IMAGE=nesomn-app:revision-test
APP_ENV_FILE=.cache/revision-phase-3/deployment.env
GATEWAY_BIND=127.0.0.1
GATEWAY_PORT=18080
'@ | Set-Content .cache/revision-phase-3/deployment.env -Encoding utf8
@'
NODE_ENV=production
DATABASE_URL=postgresql://nesomn_test:nesomn_test@revision-db:5432/nesomn_revision_test
REDIS_URL=redis://:synthetic-redis-password@revision-redis:6379/4
ENCRYPTION_KEY=synthetic-deployment-encryption-secret-never-production
'@ | Set-Content .cache/revision-phase-3/worker.env -Encoding utf8
```

Build/start (command docker run satu baris agar kompatibel PowerShell):

```bash
docker build --target app -t nesomn-app:revision-test .
docker build --target worker -t nesomn-ai-worker:revision-test .
docker compose -p nesomn-revision-deployment --env-file .cache/revision-phase-3/deployment.env -f docker-compose.yml up -d --no-build --wait --wait-timeout 120
docker run -d --name nesomn-revision-ai-worker-final --label nesomn.revision-test=phase3 --network nesomn-revision-data-test --env-file .cache/revision-phase-3/worker.env --read-only --tmpfs /tmp:rw,noexec,nosuid,size=64m --cap-drop ALL --security-opt no-new-privileges:true --init --stop-timeout 300 nesomn-ai-worker:revision-test
```

Set Bun 1.4.4 pada PATH dan flag disposable. Jalankan dari PowerShell:

```powershell
$env:NESOMN_DISPOSABLE_TESTS = '1'
node --test tests/deployment/gateway.test.mjs
```

Lima test (parent + empat subtest) meliputi API404/deep links/assets/HEAD/cache, limit upload 413, secure/httpOnly cookie, auth/admin role, forwarded IP spoof ditolak, upload binary transport dan PNG/thumbnail Sharp nyata, signed download/token invalid, API enqueue -> Redis auth/db4 -> worker consumer -> DB done/failed/refund. Tidak memanggil merchant/provider eksternal: provider fixture eksplisit Demo/Sample stub, bukan bukti AI live atau settlement.

data-fixture.ts me-reset env prosesnya ke URL baseline loopback 55432 dan memeriksa DB/role/user prefix; hanya user `revision-phase3-*@deployment.invalid` dapat dipromosikan/dihapus. Tidak menjalankan aplikasi seed. Fixture upload bukan produk jualan/GLB demo. Satu signed URL sintetis disimpan sementara di .cache untuk tes persistensi dan tidak dicetak ke log.

Untuk persistensi, jalankan gateway test dahulu, recreate HANYA app dengan volume yang sama, tunggu readiness/gateway DNS pulih, lalu:

```bash
docker compose -p nesomn-revision-deployment --env-file .cache/revision-phase-3/deployment.env -f docker-compose.yml up -d --no-deps --no-build --force-recreate --wait app
```

```powershell
node --test tests/deployment/storage-persistence.test.mjs
```

Untuk drain aktif, jalankan **setelah** tes gateway/recovery karena consumer akan dihentikan:

```powershell
node --test tests/deployment/worker-drain.test.mjs
```

Test memeriksa label/network container khusus `nesomn-revision-ai-worker-final` sebelum SIGTERM; menuntut status processing teramati, kemudian done dan exit0. Untuk mengulang setelah drain, start container test tersebut dahulu. Jangan mengubah nama/guard untuk menargetkan worker production.

## Outage, image dan browser smoke fase 3

Hentikan hanya Redis privat lab (`docker stop nesomn-revision-redis-private`), periksa /health/live tetap 200 dan /health/ready 503, serta worker healthcheck exit1. Start Redis itu lagi; readiness harus kembali 200 dan gateway job test harus kembali memproses job tanpa restart consumer. Untuk DB, gunakan **pause/unpause** container `nesomn-revision-test-test-db-1`, bukan stop (tmpfs hilang saat stop); readiness 503 harus terbatasi sekitar 2 detik, live 200. Selalu unpause setelah probe. Jangan menjalankan baseline tests bersamaan dengan outage.

Bootstrap browser juga diuji terhadap artifact Linux nyata, karena bentuk chunk Windows/Node dan Linux/Bun bisa berbeda:

```bash
docker create --name nesomn-revision-assets nesomn-app:revision-test
docker cp nesomn-revision-assets:/app/client/dist .cache/client-production
docker rm nesomn-revision-assets
```

Container artifact tidak pernah dijalankan dan tidak memiliki DB/env/volume. Node check PowerShell:

```powershell
$env:NESOMN_CLIENT_DIST = '.cache/client-production'
node --test tests/browser-bootstrap.test.mjs
Remove-Item Env:NESOMN_CLIENT_DIST
```

Child probe menggunakan DOM minimal untuk memastikan entry/module imports mencapai root; bukan pengganti browser render penuh. RED actual Linux artifact exit13 karena cyclic top-level await; GREEN sesudah bootstrap async tanpa top-level await. Prerender tiga route dan production artifact guard tetap diuji terpisah.

Browser IAB smoke pada gateway lab: home/account/store/Scene Editor 2D/admin login; screenshot dark UI existing di `docs/revision/artifacts/phase-3/`. Home width/scrollWidth diukur 360,390,768,1024,1440 tanpa horizontal page overflow. Ini bukan acceptance seluruh halaman, mobile navigation, light theme, keyboard, scene export, WebGL/empat GLB atau admin CRUD browser. Console warn/error kosong pada snapshot yang diperiksa; audit seluruh network belum dilakukan. Favicon Vite yang tidak tersedia diganti referensi logo authored. Source UI/desain lain tetap existing.

Setelah selesai, stop hanya resource lab yang sudah diverifikasi (tidak memakai --remove-orphans atau penghapusan volume):

```bash
docker compose -p nesomn-revision-deployment --env-file .cache/revision-phase-3/deployment.env -f docker-compose.yml stop
docker stop nesomn-revision-ai-worker-final nesomn-revision-redis-private
docker compose -p nesomn-revision-test -f tests/compose.test.yml stop
```

External volume/network lab dibiarkan untuk inspeksi, tidak dihapus otomatis. Jangan meninggalkan PostgreSQL test dalam paused state. Bukti/check status akhir: [laporan fase 3](revision/phase-3-report.md) dan phase-3-evidence.json. Managed TLS, R2/OAuth/AI/merchant live, QRIS adapter dan CI remote ditandai SKIPPED sampai benar-benar diuji.

## Current phase4 verification

Phase3 acceptance above is historical. Production now rejects stub payment/provider and unvalidated binary upload; use [testing-phase4.md](testing-phase4.md) for the current commands, env, exact test counts, external explicit-test worker and real Redis outage recovery. Security/migration as-built is [security.md](security.md). Phase3 screenshots still describe its actual UI; this backend phase does not assert new visual QA.

## Current phase5 verification

QRIS tests/SDK wrapper, production checkout browser artifacts dan ACK-loss restart acceptance ada di [laporan fase5](revision/phase-5-report.md). Command unit/integration dan Docker offline serta runbook ada di [payments-qris.md](payments-qris.md). Fase3/4 di atas adalah hasil historis; tidak ada merchant live diuji.
