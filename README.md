# Nesomn Studio

**Create. Customize. Publish.**

Platform kreatif berbasis web untuk menyusun scene 2D, mengedit mockup 3D, mengelola aset, serta menjalankan workflow subscription, credits dan AI generation.

Repository ini adalah **[ikhsanaryaaa/nesomn-studio-website](https://github.com/ikhsanaryaaa/nesomn-studio-website)**, berbeda dari `ikhsanaryaaa/nesomn-studio`.

## Status project

Modernisasi platform, perbaikan bug editor dan konfigurasi deployment per container telah diterapkan. Pengujian lokal menggunakan production assets, test doubles dan layanan disposable; hasilnya **belum merupakan bukti seluruh platform siap production**.

Deployment aktual di Litepod, TLS/domain, restore data existing, OAuth, storage R2, provider AI dan merchant QRIS dengan kredensial nyata masih perlu diverifikasi operator. Lihat [release readiness](docs/release-readiness.md), [bug tracker](BUGS.md), serta [laporan Litepod](docs/revision/litepod-2026-11-02.md).

## Modul yang tersedia

| Modul                  | Implementasi                                                                                                                       |
| ---------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| Scene Editor 2D        | Canvas Konva, layer/properties, image/text, transform, undo/redo, save/load project dan export PNG/JPEG                            |
| 3D Editor              | Three.js/React Three Fiber, model katalog, decal/target mesh, material/background, camera preset, export image dan turntable video |
| Preview 3D             | Preview read-only GLB/GLTF, framing, orbit/zoom/reset, fullscreen, loading/error; terpisah dari editor                             |
| Asset Store            | Katalog, pencarian/filter, detail/preview, bundle builder, library dan download berlisensi                                         |
| Account & auth         | Login/register, Google OAuth bila dikonfigurasi, session, project dan riwayat transaksi                                            |
| Subscription & credits | Plan/top-up, quote server, ledger, charging/refund job dan entitlement                                                             |
| AI jobs                | Provider registry, BullMQ/Redis, durable SQL outbox, claim/recovery dan worker independen                                          |
| Pembayaran QRIS        | Invoice pending, kode unik terpisah, receipt terverifikasi dan fulfillment idempotent                                              |
| Admin                  | Pengelolaan katalog, bundle, provider, plan/credit pack, user/session serta tampilan subscription/ledger                           |

QRIS ShopeePay **disabled secara default** sampai konfigurasi merchant diverifikasi. Stripe/Pakasir tetap menjadi bagian histori dan rekonsiliasi legacy; keduanya bukan gateway checkout baru. Browser tidak dapat menetapkan transaksi menjadi paid.

UI memakai monokrom + orange, Bricolage Grotesque/Manrope, logo asli, tema light/dark/system, serta layout editor yang mengutamakan canvas. Empat model lokal orisinal tersedia pada **`/demo/3d`**, berlabel **Demo / Sample** dan tidak dimasukkan sebagai produk jualan.

## Stack dan struktur

| Bagian         | Teknologi                                                              |
| -------------- | ---------------------------------------------------------------------- |
| Runtime/API    | Bun **1.4.4**, Elysia **1.4.30**, @elysiajs/cors **1.4.2**, TypeScript |
| Client         | React 19, Vite, React Router, Tailwind CSS v4, Radix UI                |
| State          | Zustand dan TanStack Query                                             |
| Editor         | Konva, Three.js, React Three Fiber/Drei                                |
| Admin          | Refine, Ant Design                                                     |
| Data           | PostgreSQL dan Drizzle ORM                                             |
| Queue          | BullMQ dan Redis                                                       |
| Storage        | Local private storage atau Cloudflare R2                               |
| Payment worker | Adapter Python untuk SDK QRIS terpin/vendored                          |
| Deployment     | OCI images; Litepod/Podman/Caddy atau Docker Compose app + gateway     |

Versi tersebut adalah **pin repository**, bukan klaim versi terbaru upstream. Node.js **24.18.0** digunakan untuk tooling/runner. Detail dependency dan alasan perubahan ada di [runtime](docs/runtime.md) dan [dependency security](docs/dependency-security.md).

```text
nesomn-studio-website/
├── client/                 # Public/store/account dan editor React
├── admin/                  # Admin SPA, base /admin/
├── api/                    # Elysia, auth, billing, storage, Drizzle/migrations
├── worker/                 # AI consumer dan recovery BullMQ
├── packages/shared/        # Tipe, kontrak dan theme tokens bersama
├── integrations/qris/      # Adapter receipt, durable spool dan SDK QRIS
├── deploy/litepod/         # Dockerfile worker/QRIS dan env runtime examples
├── scripts/                # Runtime/build guards, generator dan test runners
├── tests/                  # Fixtures, unit/integration/browser tests
├── docs/                   # Runbook, as-built dan bukti pengujian
├── Dockerfile              # Multi-stage app dan worker
├── docker-compose.yml      # Tepat app + gateway; lifecycle data terpisah
└── bun.lock                # Lockfile Bun Workspaces
```

## Instalasi dan development

Prasyarat: Bun **1.4.4**, Node.js **24.18.0**, PostgreSQL dan Redis development. Docker diperlukan untuk pengujian container/disposable. Chrome/Chromium diperlukan untuk tes browser.

Jalankan dari root repository:

```sh
bun --version
bun install --frozen-lockfile
bun run check:runtime
```

Salin `.env.example` menjadi file environment baru dan isi konfigurasi layanan Anda. Template itu ditujukan untuk **production**; untuk development gunakan `NODE_ENV=development`, `CLIENT_URL=http://localhost:5173`, dan `ADMIN_URL=http://localhost:5174`. Pastikan env tersedia untuk workspace API/worker yang dijalankan, sesuai [panduan runtime](docs/runtime.md).

Gunakan database development terpisah dengan schema yang sudah disiapkan melalui [prosedur migrasi](docs/migrations.md). Untuk database existing, periksa schema/jurnal dan backup dahulu. **Install/build/start tidak menjalankan migrasi atau seed otomatis.**

```sh
bun run dev
```

Script tersebut menjalankan dev scripts workspace client, admin, API dan AI worker. Ia dapat mengakses DB/provider dari environment; jangan mengarahkannya ke production untuk mencoba fitur. Worker QRIS Python dijalankan terpisah dan tidak dimulai oleh command ini.

| Service development | URL                          |
| ------------------- | ---------------------------- |
| Client              | http://localhost:5173        |
| Admin               | http://localhost:5174/admin/ |
| API langsung        | http://localhost:3000        |

Vite development mem-proxy `/api` ke API port3000. Server API development berbeda dari entry production gabungan: produksi memakai `api/src/server.ts`, yang sudah menjadi CMD image app.

```sh
bun run typecheck
bun run lint
bun run build
```

Root build menghasilkan production assets client/admin; source API/worker dijalankan dengan Bun. Tidak ada Vite development server pada production image.

## Deployment utama: Litepod per container

Ikuti [runbook Litepod](docs/litepod.md) untuk konfigurasi panel, env, network, volume, secrets, backup, migrasi dan rollout.

```text
Browser HTTPS → Caddy Litepod → Web container :3000
                               ├─ /api/* API
                               ├─ /admin/* Admin SPA
                               └─ /* Client SPA
                                      │
                         PostgreSQL, Redis, private storage
                                      │
                         AI worker dan QRIS worker terpisah
```

Buat aplikasi Litepod terpisah, pilih **Git repository → Dockerfile**, dan gunakan **build context root repository**:

| Aplikasi             | Dockerfile                         | Port container      | Domain               |
| -------------------- | ---------------------------------- | ------------------- | -------------------- |
| Web/API/client/admin | `Dockerfile`                       | 3000                | Domain web HTTPS     |
| AI worker            | `deploy/litepod/worker.Dockerfile` | 3001, health privat | Tidak dipublikasikan |
| QRIS worker          | `deploy/litepod/qris.Dockerfile`   | 3002, health privat | Tidak dipublikasikan |

Pilih branch/commit release yang memuat perubahan; branch modernisasi saat dokumentasi ini diperbarui adalah `works/runtime-tooling-upgrade`. Litepod mengambil source yang sudah di-push, bukan working tree lokal.

Caddy platform menangani HTTPS; Nginx repository tidak diperlukan pada jalur Litepod langsung. PostgreSQL dan Redis dikelola sebagai layanan terpisah atau endpoint managed/private. Gunakan DNS/alias yang stabil dan network Podman bersama bila berada di server yang sama; jangan menggunakan `localhost` untuk container lain.

Template runtime:

- [Web app](deploy/litepod/app.env.example)
- [AI worker](deploy/litepod/worker.env.example)
- [QRIS worker](deploy/litepod/qris.env.example)

App dan AI worker memakai DATABASE_URL, REDIS_URL dan ENCRYPTION_KEY yang sama. Pertahankan ENCRYPTION_KEY existing agar kredensial provider terenkripsi tetap terbaca. `CLIENT_URL` dan `ADMIN_URL` adalah origin yang sama, misalnya `https://studio.example.com`, tanpa path `/admin`.

Gunakan R2 private atau mount upload volume persisten di `/data/storage` untuk local storage. QRIS membutuhkan volume spool persisten dan secret files read-only; env tidak otomatis menjadi file. Jangan memasukkan secrets ke Git, build variables atau bundle frontend.

Dockerfile worker/QRIS diturunkan dari konfigurasi canonical. Sesudah mengubah Dockerfile canonical:

```sh
node scripts/generate-litepod-dockerfiles.mjs
node scripts/generate-litepod-dockerfiles.mjs --check
```

**Perhatian rollout:** source Litepod yang diperiksa menggunakan stop grace30s, sedangkan AI worker dapat memerlukan drain hingga300s. Lakukan drain terencana sebelum mengganti worker; lihat [workers](docs/workers.md). Jangan replay job provider yang belum terkonfirmasi.

### URL dan health production

| Path                        | Fungsi                                        |
| --------------------------- | --------------------------------------------- |
| `/`                         | Client                                        |
| `/admin/`, `/admin/login`   | Admin                                         |
| `/api/*`                    | API; route tidak dikenal menghasilkan JSON404 |
| `/health/live`              | Liveness proses web                           |
| `/health/ready`             | Readiness schema/DB dan Redis                 |
| `/demo/3d`                  | Showcase Demo / Sample                        |
| Worker `:3001/health/ready` | Heartbeat/running AI worker; privat           |
| QRIS `:3002/health/ready`   | Heartbeat polling/delivery; privat            |

Readiness tidak membuktikan provider AI, merchant atau seluruh alur bisnis sehat. Port database/Redis/worker tidak boleh dibuka ke internet.

## Alternatif: Docker Compose

Compose utama tetap memiliki tepat **app** dan **gateway**. Data, storage dan worker tidak ditambahkan sebagai service/profile tersembunyi.

```sh
docker build --target app -t nesomn-app:release .
docker build --target worker -t nesomn-ai-worker:release .
node scripts/check-deployment.mjs
```

Sebelum startup, siapkan env production baru, image reference, external network/storage, backup dan migrasi eksplisit sesuai [runbook deployment](docs/deployment.md). Setelah seluruh prasyarat terpenuhi:

```sh
docker compose --env-file .env.production config --services
# Expected: app, gateway
docker compose --env-file .env.production up -d --no-build --wait
```

File env tersebut harus mengatur `APP_IMAGE` ke image release yang dibangun dan `APP_ENV_FILE` ke file runtime yang benar. Default gateway adalah **127.0.0.1:8080**; terminasi TLS berada pada reverse proxy di depannya. App port3000 tidak dipublish langsung.

Jangan mengimpor Compose utama sebagai tambahan aplikasi Litepod per container. Pilih satu jalur deployment dan ikuti kontrak network/proxy jalur itu.

## Pembayaran, worker dan data existing

- Harga, diskon, kode unik Rp1–999 dan jumlah bayar dihitung server. Kode unik ditampilkan terpisah sebelum pembayaran.
- Order awal pending; hanya receipt/konfirmasi terverifikasi yang dapat memicu paid dan entitlement/credit grant.
- QRIS default OFF. Jangan mengaktifkannya sebelum merchant/store/static QR, sesi SDK dan feed diverifikasi. Tidak ada transaksi nyata yang dilakukan oleh tes lokal.
- Legacy Stripe/Pakasir tidak ditulis ulang sebagai transaksi QRIS; pertahankan konfigurasi rekonsiliasi yang masih diperlukan.
- AI worker dan QRIS memiliki lifecycle independen; menghentikan app tidak otomatis menghentikan keduanya.
- Tidak ada reset/drop/seed otomatis. Upgrade schema memerlukan backup, pemeriksaan jurnal dan migrasi eksplisit.

Detail: [pembayaran QRIS](docs/payments-qris.md), [worker/recovery](docs/workers.md), [migrasi](docs/migrations.md), dan [security](docs/security.md).

## Pengujian dan bukti

Gunakan Bun terpin di PATH. Runner berikut memakai environment sintetis; jangan menggantinya dengan database atau merchant production.

```sh
# Frozen install, audit, typecheck, lint, build dan kumpulan checks lokal
node scripts/release-check.mjs unit

# Regresi scene/editor dan deployment
node scripts/test-phase9.mjs unit
node scripts/test-deployment.mjs

# Kontrak dan health listener Litepod
node --test tests/litepod-build.test.mjs
bun --no-env-file --no-install test tests/litepod.test.ts

# Build/run app + worker dengan data disposable dan QRIS offline
node scripts/test-litepod-docker.mjs
```

Lab Litepod membersihkan container, image tes dan network miliknya dalam finally. Image yang dipakai workload lain dipertahankan; tidak ada global prune atau penghapusan volume. Build cache tidak di-prune global.

Bukti yang sudah dijalankan:

| Area                  | Hasil lokal                                                                                                               |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| Litepod packaging     | Tiga image dibangun, app/worker readiness dengan DB/Redis disposable, migrasi manual DB tes, deep links dan JSON404 lulus |
| QRIS offline          | Sepuluh tes lulus, tanpa merchant/network eksternal                                                                       |
| Worker health         | Dua tes/17 assertions lulus                                                                                               |
| Deployment regression | 13 tes/99 assertions lulus                                                                                                |
| Editor regression     | 15 tes/84 assertions lulus; pergantian akun, save3D saat mengedit dan pemulihan gambar diuji                              |
| Tooling               | Frozen install, typecheck lima workspace dan lint lulus; dua warning Fast Refresh existing                                |

Lihat [laporan Litepod](docs/revision/litepod-2026-11-02.md), [perbaikan bug](docs/revision/bug-fixes-2026-11-01.md), [acceptance fase10](docs/revision/phase-10-report.md), [testing](docs/testing.md), dan [release readiness](docs/release-readiness.md). Bukti historis mencatat kondisi pada saat pengujian, bukan status otomatis deployment terbaru. Chrome viewport/SwiftShader belum menggantikan tes perangkat mobile/Safari/GPU nyata.

## Dokumentasi

| Dokumen                                 | Isi                                                 |
| --------------------------------------- | --------------------------------------------------- |
| [REVISION.md](REVISION.md)              | Rencana dan catatan fase modernisasi                |
| [As-built](docs/as-built.md)            | Arsitektur dan kontrak implementasi                 |
| [Litepod](docs/litepod.md)              | Deployment per container                            |
| [Deployment Docker](docs/deployment.md) | App + gateway, TLS dan external services            |
| [Migrations](docs/migrations.md)        | Backup, schema existing dan migrasi eksplisit       |
| [Design system](docs/design-system.md)  | Monokrom/orange, typography, tema dan accessibility |
| [Viewer 3D](docs/viewer-3d.md)          | Model loader, demo GLB, generator dan acceptance    |
| [Editor/admin](docs/editor-admin.md)    | Workflow dan batas fitur                            |
| [BUGS.md](BUGS.md)                      | Temuan, perbaikan dan batas verifikasi              |

## Lisensi

Proprietary — © 2026 Nesomn Studio. All rights reserved. Komponen pihak ketiga tetap mengikuti lisensi masing-masing, termasuk SDK vendored pada `integrations/qris/`.
