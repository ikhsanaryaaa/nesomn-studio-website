# Nesomn Studio Revision Plan

## Update 3 November 2026 — landing / portfolio, five phases

This is the subsequent five-phase scope, separate from the original ten modernization phases below. Phase1 portfolio schema/admin; phase2 public Works/sample; phase3 About/navigation/footer; phase4 Studio Kit hero/registered 3D sources; phase5 final local acceptance and deployment documentation have been implemented. Local production-image browser/API tests pass, including two navigation fixes. WebM export on Windows headless remains OPEN (NS-BUG-007); live integrations/physical devices remain unverified. No push/deploy or production database change. [Phase5 evidence and runbook](docs/revision/marketing-phase5-2026-11-03.md).

> Untuk pelaksana: baca dokumen ini bersama source dan issue fase terkait. Gunakan workflow `superpowers:executing-plans` atau `superpowers:subagent-driven-development` sesuai metode eksekusi yang dipilih pengguna. Checklist menunjukkan pekerjaan yang harus dibuktikan, bukan klaim bahwa pekerjaan sudah selesai.

**Goal:** Memodernisasi Nesomn Studio sebagai creative studio platform dengan deployment dua service, pembayaran QRIS ShopeePay, UI monokrom + orange, dan editor yang tetap kompatibel dengan data existing.

**Architecture:** Pertahankan Bun Workspaces, Elysia API, client React, admin Refine, worker AI, dan shared contracts. Satu container app melayani API serta build client/admin melalui gateway Nginx. PostgreSQL, Redis, storage, worker AI, dan worker QRIS memiliki lifecycle di luar Compose utama.

**Tech Stack:** Bun, Elysia, TypeScript, React, Vite, Tailwind CSS, shadcn/Radix, Refine/Ant Design, Zustand, TanStack Query, Konva, Three.js/React Three Fiber/Drei, Drizzle/PostgreSQL, BullMQ/Redis, storage local/R2. SDK Python QRIS hanya digunakan pada integrasi/worker eksternal, bukan mengganti runtime aplikasi.

**Spec:** Instruksi modernisasi pengguna dalam chat ini, hasil analisis source, dan keputusan visual UjiHub sebagai referensi bentuk. Dokumen ini adalah rangkuman master; rincian implementasi dan test per perubahan diturunkan menjadi issue fase sebelum dikerjakan.

**Tanggal:** 30 Oktober 2026, Asia/Jakarta.

**Status (31 Oktober 2026):** Fase1–10 diimplementasikan dan diverifikasi dalam acceptance lokal masing-masing. Phase10 menambah release gate/CI, memperbaiki bundle picker dan transaksi membership, serta meremediasi audit66 advisory menjadi nol pada723 paket yang diperiksa. Main Compose tetap app/gateway. Production tetap NO-GO sampai merchant/AI/OAuth/R2 live, backup/restore clone existing, TLS/network dan verifikasi operator/perangkat ditutup. Tidak commit/push/deploy atau transaksi merchant nyata. [Laporan phase10](docs/revision/phase-10-report.md), [release gate](docs/release-readiness.md), [as-built](docs/as-built.md).

Rincian phase9: [laporan](docs/revision/phase-9-report.md), [runbook/as-built](docs/editor-admin.md). Pembatasan dan tes SKIPPED tetap berlaku; tidak ada klaim production-ready.

## 1. Identitas dan baseline repository

| Item                              | Hasil verifikasi                                                                |
| --------------------------------- | ------------------------------------------------------------------------------- |
| Repository target                 | https://github.com/ikhsanaryaaa/nesomn-studio-website                           |
| Working directory                 | `C:/Users/ikhsan/Desktop/nesomn-studio-website`                                 |
| Remote origin                     | `https://github.com/ikhsanaryaaa/nesomn-studio-website.git`                     |
| Branch saat perencanaan           | `main`                                                                          |
| Commit baseline                   | `041d225fca07ae405b440ca424a0c56f90fdac0f`                                      |
| Commit terakhir                   | Merge pull request #25, pemisahan arsitektur aset                               |
| Struktur aktual                   | `client/`, `admin/`, `api/`, `worker/`, `packages/shared/`                      |
| Status sebelum dokumen ini dibuat | Tidak ada perubahan tracked; `graphify-out/` untracked dari analisis sebelumnya |

Repository ini berbeda dari `ikhsanaryaaa/nesomn-studio`. Tidak ada asumsi bahwa modernisasi di repository tersebut sudah diterapkan, dan tidak ada copy/cherry-pick otomatis dari sana.

Dokumentasi yang tersedia mencakup README.md, DESIGN.md, PRD.md, AI-RULES.md, phase.md, workflow.md, dan issue internal. AGENTS.md, PENJELASAN-PROYEK.md, folder docs, workflow CI, dan .dockerignore belum ditemukan pada baseline. Sebagian dokumen internal diabaikan oleh git; dokumentasi release/deployment baru harus berada pada file yang terlacak.

### Kondisi implementasi yang menjadi dasar

- Modul editor 2D/3D, katalog, admin, project, auth, billing, credit, storage, dan AI queue sudah memiliki source. Keberadaan source belum membuktikan seluruh alur bekerja end-to-end.
- Compose utama saat ini memiliki enam service: db, redis, api, worker, admin, client.
- Bun global mesin saat audit adalah 1.4.0; packageManager dan Docker menggunakan 1.3.14.
- Elysia pada manifest adalah `^1.2.25`, tetapi lockfile menyelesaikannya ke 1.4.28; CORS pada lockfile adalah 1.4.2.
- UI client menggunakan dark/indigo/Inter, sedangkan admin memiliki tema biru tersendiri.
- API login email/password tersedia; route Login client dan implementasi Google OAuth belum lengkap.
- Checkout marketplace lama masih membuat order pending; pricing mengirim gateway stub secara tetap.
- Loader file editor belum menerapkan otorisasi lisensi/subscription secara memadai.
- Verifikasi signature Stripe dan pembatasan gateway stub belum aman untuk production.
- Settlement order dan grant hak terpisah; pemotongan credit, insert job, serta enqueue juga belum atomik/punya pemulihan memadai.
- Identitas model 3D belum tersimpan secara andal dalam state project; material dan decal pada GLB memerlukan perbaikan.

### Bukti pengujian dari audit sebelumnya

| Pemeriksaan                   | Hasil yang benar-benar diamati                                                                      |
| ----------------------------- | --------------------------------------------------------------------------------------------------- |
| Typecheck                     | Shared lulus; client/admin/api/worker gagal, termasuk dependency/type yang tidak ditemukan          |
| Lint                          | Terhenti karena module debug tidak ditemukan                                                        |
| Build                         | Client/admin terhenti karena package rollup tidak ditemukan                                         |
| Test                          | 19 pass, 13 fail, 4 errors; termasuk PostgreSQL tidak tersedia dan dependency memoirist hilang      |
| Uji adapter Stripe terisolasi | Signature palsu diterima dan menghasilkan status paid, menggunakan data dummy tanpa transaksi nyata |
| Compose config                | Menghasilkan enam service, sehingga target dua service belum terpenuhi                              |
| Docker daemon                 | CLI tersedia; akses daemon mendapat permission denied                                               |

Hasil di atas bukan pengujian baru atas modernisasi. Belum ada frozen install baru, Docker build baru, browser acceptance, migrasi modernisasi, atau transaksi merchant nyata. Instalasi dependency yang tidak lengkap harus dibedakan dari bug source.

## 2. Keputusan dan batasan global

- Pertahankan creative studio platform: Scene Editor 2D, 3D Editor, Asset Store, subscription, credits, AI, background jobs, dan admin.
- Pertahankan framework, workspace, tabel/relasi utama, nama/konten authored, ownership, dan dokumen scene existing.
- Tidak melakukan reset/drop database, penghapusan volume, seed massal, force-push, merge, deployment, atau transaksi merchant nyata tanpa instruksi eksplisit.
- Verifikasi directory, remote, branch, status, dan commit sebelum implementasi. Hentikan perubahan bila remote tidak cocok; jangan mengoreksinya otomatis.
- Pertahankan semua perubahan pengguna. Buat branch kerja sesuai aturan repository saat eksekusi; jangan commit implementasi langsung ke main.
- Migrasi bersifat aditif sejauh memungkinkan. Backup, pemeriksaan schema/migration journal existing, dan validasi pada DB disposable mendahului migrasi environment pengguna.
- Tidak menaruh secret di frontend, Git, image, screenshot, atau log. Jangan menyalin .env ke image.
- Tidak mengganti error API menjadi data mock. Demo hanya pada route/mode eksplisit dengan label Demo/Sample.
- Hasil test yang belum dijalankan harus SKIPPED/BLOCKED, bukan PASS.
- Keputusan terbaru pengguna menggantikan spesifikasi visual lama: monokrom + orange, dua tema, font baru, target kontrol minimal 44px.

## 3. Target arsitektur deployment

```text
Browser
  |
gateway Nginx                  Compose utama: tepat app + gateway
  |
app Bun/Elysia
  |-- /api/*                   REST API
  |-- /admin/*                 Production build admin SPA
  |-- frontend routes          Production build client SPA
  |
  |-- PostgreSQL eksternal
  |-- Redis eksternal -------- Worker AI eksternal
  |-- Private storage
  |-- Receipt API <----------- Worker QRIS eksternal <--- ShopeePay
```

- Pertahankan base admin `/admin/` dan URL API publik `/api/`. Hindari konflik dengan route internal admin API.
- Unknown `/api/*` menghasilkan JSON 404. Missing file pada asset/static namespace menghasilkan 404 file, bukan SPA HTML. SPA fallback dibatasi pada navigasi frontend yang memang didukung.
- Gateway meneruskan ke `app:3000`; port app tidak dipublish ke publik. Default gateway direncanakan port 80, dapat dikonfigurasi. Dokumentasikan TLS di gateway atau reverse proxy di depannya, termasuk trusted forwarded headers dan secure cookie.
- Gunakan network privat aplikasi dan shared external network, misalnya `nesomn-data-network`. Dokumentasikan pembuatan network serta penyambungan DB existing tanpa membuat/menghapus DB tersebut.
- DATABASE_URL/REDIS_URL mendukung hostname container eksternal atau managed/private DNS. Redis auth, database index, dan TLS harus dihormati.
- App menggunakan production runtime non-root. Build client/admin dilakukan di multi-stage Dockerfile dengan frozen lockfile dan cache manifest yang konsisten.
- PostgreSQL, Redis, worker AI, dan worker QRIS tidak ditambahkan lewat override/profile yang ikut ter-load pada deployment utama. Sediakan runbook independen yang konkret.
- Pisahkan liveness proses dan readiness dependency. Worker memiliki pemulihan koneksi dan graceful shutdown. Migrasi tidak dijalankan otomatis saat boot.

## 4. Runtime dan dependency

Target yang diverifikasi pada 30 Oktober 2026:

| Komponen       | Target       | Dasar                                               |
| -------------- | ------------ | --------------------------------------------------- |
| Bun            | 1.4.4 stable | GitHub release terbaru saat audit, prerelease false |
| Elysia         | 1.4.30 exact | npm dist-tag latest saat audit                      |
| @elysiajs/cors | 1.4.2 exact  | npm latest; peer Elysia >=1.4.0                     |

Verifikasi ulang metadata resmi pada saat fase upgrade dimulai. Bila versi berubah, pilih stable yang kompatibel, catat tanggal/alasannya, dan hindari beta/next/rc/canary. Digest image harus diverifikasi saat implementasi, bukan dikarang dalam rencana.

Sinkronkan packageManager, runtime development yang dipakai, tipe Bun yang kompatibel, lockfile, Docker, dan CI. Jangan menggunakan `oven/bun:latest`, `--force`, atau fallback frozen install ke install biasa. Jangan melakukan upgrade massal dependency lain tanpa kebutuhan.

## 5. Arah UI yang disepakati

Referensi bentuk: https://ujihub.royyan.net/ . Homepage, bagian fitur, dan halaman login sudah ditinjau. Yang diadaptasi adalah bahasa bentuk dan komposisi, bukan konten, warna, domain pendidikan, atau mekanisme login UjiHub.

### Identitas Nesomn

- Monokrom + orange: off-white/white/ink-dark pada light, charcoal/gray pada dark; orange untuk action, focus, selection, dan highlight.
- Bricolage Grotesque untuk heading/display; Manrope untuk body/UI; fallback font tetap baik. Logo asli Nesomn digunakan.
- Nuansa creative editorial: heading kuat, preview karya/editor dominan, whitespace terukur, border tipis, dan shadow lembut.
- Tidak menggunakan indigo/lime sebagai aksen brand baru, glow dekoratif berlebihan, atau layout seluruh halaman berupa bento cards.
- Warna karya, material, desain pengguna, dan hasil export adalah data konten, bukan bagian yang diubah mengikuti tema brand.

### Shape dan komponen

Ukuran berikut adalah usulan Nesomn, bukan klaim hasil pengukuran CSS referensi:

| Elemen                     | Arahan                                            |
| -------------------------- | ------------------------------------------------- |
| Panel visual/preview besar | Radius 24-32px                                    |
| Kartu aset/modal           | Radius 16-24px                                    |
| Input                      | Radius 12-16px, target interaksi minimal 44px     |
| CTA utama/filter/badge     | Bentuk pill sesuai hierarki                       |
| Toolbar/inspector editor   | Radius 8-12px, padat dan terbaca                  |
| Navigasi publik            | Kapsul membulat; navigasi workspace tetap efisien |

Bangun semantic tokens untuk warna, font, spacing, radius, focus, elevation, dan motion. Token Ant Design admin disejajarkan dengan client tanpa migrasi component library. Kontras teks di atas orange diuji; jangan mengasumsikan teks putih selalu sesuai.

### Penerapan per surface

- Home: layout editorial dan preview produk asli yang dominan; tidak mengarang statistik, klien, testimonial, atau fitur.
- Store/detail: thumbnail/poster dominan, search/filter pill, lisensi dan CTA jelas; preview 3D hanya pada detail/viewer yang dibuka, bukan tiap thumbnail.
- Login/register: form bersih dan panel visual membulat; desktop split layout, mobile form fokus. Alur auth mengikuti kebutuhan Nesomn.
- Account/subscription/credit/checkout: hierarki saldo, entitlement, rincian harga, kode unik, expiry, serta status yang mudah dipahami.
- Editor: canvas/viewport mendapat prioritas, inspector collapsible, toolbar terbaca, shortcut serta focus yang jelas. Mobile memakai panel/drawer yang tidak menutup seluruh area kerja secara permanen.
- Admin: utamakan tabel, filter, form, validasi, dan tindakan operasional yang didukung API.
- Halaman studio/services/works/contact belum ditemukan. Jangan membuat klaim konten atau backend yang belum tersedia.

Tema tersimpan, menghormati preferensi sistem, dan konsisten pada client/admin. Uji 360, 390, 768, 1024, 1440px, dua tema, keyboard, modal focus trap/recovery, reduced motion, semua state request, dan overflow halaman.

## 6. QRIS ShopeePay dan integritas transaksi

Source yang diaudit: https://github.com/ikhsanaryaaa/qris-merchant-id , commit `e1b1b6968c570c0cb18ccf9ce4d95694e8df48de`. Pin dependency ke revisi yang ditinjau atau revisi berikutnya yang diverifikasi; jangan mengandalkan nama paket PyPI sebagai bukti identik dengan fork pengguna.

### Kemampuan dan batas source

- SDK Python menyediakan auth/session, feed transaksi store-scoped, dan watcher ShopeePay. Amount ShopeePay berupa integer rupiah, bukan sen.
- Helper QRIS menyediakan injeksi nominal pada payload statis. Jangan mengasumsikan API invoice provider dengan order reference atau recurring debit.
- Worker bawaan memiliki HMAC opsional, mengirim payload yang belum memuat merchant/store/completed, menandai seen sebelum ACK, dan belum memiliki reliable delivery yang diperlukan Nesomn.
- `wait_for_payment()` memeriksa completed, tetapi worker bawaan memakai `poll_once()` tanpa pemeriksaan tersebut. Jangan menyalin worker apa adanya.
- README SDK menyebut unofficial serta live verification belum lengkap. Offline tests bukan bukti akun merchant nyata bekerja.

### Target alur

1. Server membaca harga plan/pack/aset, menghitung diskon, dan menyimpan snapshot order.
2. Server membuat invoice pending dengan merchant/store, currency IDR, expiry, kode unik Rp1-999 bila diperlukan, dan jumlah bayar akhir.
3. UI menampilkan subtotal, diskon bila ada, kode unik terpisah, total bayar, QR, expiry, dan status pending.
4. Worker QRIS eksternal membaca transaksi selesai dari merchant/store yang benar lalu mengirim receipt melalui kanal terautentikasi.
5. API memvalidasi autentikasi, schema, merchant/store, completed status, reference, nominal tepat, dan waktu; receipt disimpan secara persisten sebelum ACK.
6. Matching dan settlement dilakukan dengan locking/constraint yang menjamin satu receipt tidak membayar beberapa invoice.
7. Status paid dan fulfillment credit/subscription/license berlangsung atomik atau memakai mekanisme fulfillment persisten yang aman dicoba ulang.
8. Browser hanya membaca status server. Tombol atau request browser tidak dapat menyatakan pembayaran berhasil.

### Aturan rekonsiliasi

- Unikkan jumlah bayar akhir dalam scope merchant/store dan masa reservasi; kode unik saja tidak cukup karena subtotal berbeda dapat bertabrakan.
- Reservasi dilakukan secara atomik, menangani concurrency dan kode habis. Jangan diam-diam menghasilkan nominal yang bentrok.
- Matching nominal harus exact, tanpa tolerance longgar. Waktu merchant dan waktu penerimaan callback dibedakan.
- Simpan reference transaksi sebagai string agar ID panjang tidak kehilangan presisi.
- Terapkan event/reference unik, anti-replay, autentikasi wajib, timestamp transport, serta retry dengan persistent outbox/spool dan ACK yang jelas. Tanda tangan worker membuktikan pengirim internal; kualitas receipt tetap bergantung pada verifikasi feed merchant.
- Jangan menganggap cache seen dalam memori/file sebagai satu-satunya perlindungan replay. Sediakan backfill/cursor persisten agar restart/downtime tidak melewatkan receipt.
- Invoice expired, pembayaran terlambat, unmatched, ambigu, duplicate, serta callback berulang dicatat dan dapat direkonsiliasi. Jangan memberi entitlement otomatis pada kasus ambigu.
- Gunakan cooldown sebelum jumlah bayar digunakan ulang. Keterbatasan pencocokan nominal tanpa order reference harus dinyatakan, termasuk penanganan pembayaran sangat terlambat.
- Histori Pakasir/Stripe tidak diganti menjadi QRIS. Cutover hanya mengubah checkout baru; receipt lama direkonsiliasi melalui jalur terverifikasi atau review manual.
- QRIS baru diselesaikan dalam IDR. Histori USD dipertahankan; jangan membuat konversi mata uang tanpa aturan bisnis.

Pembayaran renewal berbasis invoice per periode adalah rancangan awal, bukan recurring debit otomatis. Kebijakan pembayaran terlambat, overpayment/refund, serta perlakuan kode unik perlu dipastikan sebelum aktivasi merchant nyata. Payload QRIS merchant, merchant/store ID, dan credential/session diberikan melalui konfigurasi aman, tidak diminta untuk ditulis ke Git atau chat.

## 7. Review focus lintas fase

Lima kondisi yang wajib memiliki pengujian eksplisit:

1. Receipt duplikat/paralel, timeout ACK, dan restart worker tidak menggandakan entitlement atau menghilangkan pembayaran. Pemilik: fase 5.
2. Invoice dengan total bertabrakan, kode habis, dan pembayaran terlambat tidak salah dipasangkan. Pemilik: fase 5.
3. Project 3D lama, model multi-mesh, ukuran ekstrem, dan pergantian model tidak kehilangan referensi/material atau memengaruhi scene lain. Pemilik: fase 8.
4. Redis gagal sesudah debit, job diproses ulang, dan refund paralel tidak merusak saldo atau meninggalkan job aktif selamanya. Pemilik: fase 4 dan 9.
5. Deep link admin/client, unknown API, missing assets, dan URL file privat tidak bocor melalui SPA fallback. Pemilik: fase 3 dan 4.

## 8. Pembagian pekerjaan: 10 fase

Fase 1 selesai sebagai audit reproducible; fase 2 menyelaraskan runtime/tooling; fase 3 menyelesaikan app/gateway dan lifecycle eksternal dengan acceptance lokal serta final review CLEAN. Fase4 menyelesaikan integrity/security lokal dengan review/fix pass dan acceptance disposable; fase5 menyelesaikan invoice/receipt/worker QRIS dalam acceptance lokal; fase6 menyelesaikan fondasi UI dalam acceptance lokal; fase7 menyelesaikan public/store/auth/account acceptance lokal; fase8 menyelesaikan viewer/editor3D/sampleGLB acceptance lokal; fase9-10 belum dimulai. Hasil tersebut tidak berarti seluruh alur platform sudah diuji atau siap produksi. Urutan memprioritaskan risiko data/pembayaran sebelum perubahan visual menyeluruh.

### Fase 1. Audit baseline dan persiapan pengujian

**Prioritas:** P0. **Dependency:** Tidak ada.

- [x] Verifikasi ulang identitas repository, perubahan pengguna, dokumentasi, seluruh workspace, scripts, dan kontrak source.
- [x] Inventaris implementasi nyata, fallback/demo, gap endpoint, schema/migration existing, dan fixture scene lama tanpa menyalin data sensitif.
- [x] Siapkan strategi DB disposable, Redis test, fake provider/receipt, dan baseline evidence yang terpisah dari production.

**Selesai bila:** Ada baseline reproducible, pemetaan data dan scope, serta daftar hambatan yang spesifik. Tidak ada asumsi bahwa pekerjaan repository lain sudah diterapkan.

**Hasil fase 1:** Lima guard test dan 22 unit/scene-contract test lulus. Empat migration existing berhasil pada DB disposable dan menghasilkan 17 public tables. Integration baseline: 12 pass, 4 fail, 4 errors; empat file route terhalang memoirist yang hilang. Typecheck/lint/build tetap gagal karena dependency/type existing; menjadi input fase 2. Kedua container test sudah teramati exited (255) pada pemeriksaan akhir; bukan bukti graceful shutdown. Tidak ada source aplikasi/dependency/migration existing yang diubah. Lihat [progress dan rulings](docs/revision/phase-1-progress.md).

### Fase 2. Runtime, dependency, dan tooling

**Prioritas:** P0. **Dependency:** Fase 1.

- [x] Verifikasi stable resmi, pin Bun/Elysia/plugin yang kompatibel, dan sinkronkan manifest, lockfile, development runtime, Docker, CI.
- [x] Pulihkan dependency lokal menggunakan versi terkunci; perbaiki error source/type/lint yang masih muncul setelah install valid.
- [x] Pastikan scripts aktual dan frozen install bekerja; catat executable/runtime yang benar-benar dipakai.

**Selesai bila:** `bun install --frozen-lockfile`, typecheck, lint, build, dan test baseline terisolasi lulus atau memiliki blocker eksternal terdokumentasi tanpa PASS palsu.

**Hasil fase 2:** Bun 1.4.4, Elysia 1.4.30, CORS 1.4.2 dan bun-types 1.4.4 terpin. Frozen install, lima workspace typecheck, lint (0 errors/2 warnings existing), production build client/admin, 10 Node guard/regression, 22 unit/scene, 24 integration dan empat Docker image build lulus. Prerender process exit diperbaiki dan CI build env dipisahkan dari test. Review independen akhir CLEAN; remote CI/browser/live provider belum diuji. Keempat migration dan 156/157 file source tetap identik; satu import client prerender berubah. Global Bun 1.4.0 tetap, executable lokal 1.4.4 digunakan untuk checks. Lihat [laporan](docs/revision/phase-2-report.md), [evidence](docs/revision/phase-2-evidence.json), dan [review](docs/revision/phase-2-review.md). Branch `works/runtime-tooling-upgrade`, perubahan belum commit/push/deploy.

### Fase 3. Deployment app + gateway dan lifecycle eksternal

**Prioritas:** P0. **Dependency:** Fase 2.

- [x] Buat multi-stage image app, sajikan API/client/admin, dan ganti Compose utama menjadi tepat app/gateway.
- [x] Konfigurasikan base path, static caching, API JSON 404, missing-asset 404, gateway, upload limits, timeouts, non-root, environment validation, health/readiness, restart dan TLS boundary.
- [x] Siapkan network eksternal, prosedur backup/migrasi eksplisit, packaging worker AI independen, serta runbook runtime worker QRIS yang dilengkapi adapter pada fase 5.

**Selesai bila:** Compose config tepat dua service; Docker build serta pengujian gateway/deep links dapat dibuktikan. Worker AI dapat dijalankan di luar Compose utama dengan versi/dependency yang sesuai.

**Hasil fase 3:** Exact command Compose menghasilkan app/gateway. Multi-stage app/worker non-root dibangun, API/client/admin disajikan satu app tanpa Vite runtime, auth/upload/Sharp/signed download dan actual API enqueue->consumer di Redis auth/db4 diuji. Liveness/readiness/outage recovery, app storage persistence dan SIGTERM drain job aktif lulus. Frozen install/typecheck/lint/build, 11 Node guards, 13 deployment unit, 22 baseline unit, 24 integration lulus; dua lint warnings existing dan chunk warnings tetap dicatat. Circular bootstrap Linux client diperbaiki dengan regression actual image artifact dan browser smoke. Review CLEAN setelah mewajibkan explicit production storage config. Delapan container test exited0; tidak ada volume/production data dihapus. TLS/provider/merchant/managed services live dan CI remote belum diuji. Adapter QRIS tetap fase 5, redesign fase 6. Lihat [laporan](docs/revision/phase-3-report.md), [evidence](docs/revision/phase-3-evidence.json), [review](docs/revision/phase-3-review.md) dan [screenshot](docs/revision/artifacts/phase-3/home-1440.jpg). Perubahan masih lokal tanpa commit/push/deploy.

### Fase 4. Keamanan dan integritas bisnis

**Prioritas:** P0. **Dependency:** Fase 2-3.

- [x] Tutup simulasi pembayaran/fallback provider diam-diam pada production; verifikasi atau fail-closed jalur legacy yang tidak dapat dipercaya.
- [x] Perkuat role/ownership, private asset loader/download, publikasi aset, auth/session, Google OAuth state/identity/callback, CSRF/origin/CORS, proxy-aware rate limit, serta upload/MIME/metadata/URL validation.
- [x] Buat settlement/fulfillment dan credit mutation idempoten, serialized per user saat perlu, dan memiliki database constraint yang tepat.
- [x] Atasi gap debit-insert-enqueue, job aktif paralel, retry/refund, entitlement akhir periode/cancel/renewal, kuota dan expiry credit, serta retention.

**Selesai bila:** Test negatif auth/role/ownership, download privat, webhook legacy, concurrent grant/credit, dan kegagalan Redis tidak membuka bypass atau menggandakan hak. Tidak ada migrasi destruktif.

**Hasil fase4:** Bun1.4.4/Elysia1.4.30 tetap; frozen/typecheck5/lint0errors/build pass. Security38tes186assertions, baseline24integration+22unit/scene, deployment13unit+11Nodeguards, gateway5HTTP, worker drain1, actual Redis outage/restart1, storage persistence1 dan actual Linuxbootstrap1 pass. Tiga migration aditif0004-0006, empat baseline SQL identik; upgrade legacy fixture/preflight diuji tanpa DB production. Review0Critical/4Important/2Minor, semua temuan diperbaiki dalam satu fix pass dengan RED->GREEN (Minor diregrade karena efek user). Free Basic Pro gate dan initial Redis startup hang juga diperbaiki. Tujuh layanan lab final exited0, tanpa penghapusan volume/network. QRIS/live merchant/provider/Google consent/R2/production migration serta UI baru masih belum terbukti. [Laporan](docs/revision/phase-4-report.md), [evidence](docs/revision/phase-4-evidence.json), [review](docs/revision/phase-4-review.md), [rulings](docs/revision/phase-4-progress.md). Perubahan belum commit/push/deploy.

### Fase 5. Integrasi QRIS ShopeePay dan cutover

**Prioritas:** P0. **Dependency:** Fase 3-4.

- [x] Tambahkan schema invoice/receipt/fulfillment secara aditif sesuai kebutuhan, tanpa mengganti histori order/gateway lama.
- [x] Implementasikan perhitungan invoice, reservasi jumlah bayar unik, expiry, QR payload validation, dan API status server-side.
- [x] Integrasikan SDK terpin pada worker eksternal dengan completed/scope checks, autentikasi wajib, persistent delivery, backfill, dan receipt ingestion.
- [x] Uji matching, nominal bentrok, concurrency, kode habis, duplicate/replay, late/unmatched, outage, restart, dan fulfillment exactly-once secara efek bisnis.
- [x] Dokumentasikan trust boundary, credential/session renewal, cutover, recovery, rekonsiliasi, dan batas live verification. Tidak melakukan transaksi merchant nyata.

**Selesai bila:** Test offline/disposable membuktikan receipt tak valid tidak mengubah order menjadi paid dan pengiriman ulang tidak menggandakan manfaat. Aktivasi merchant nyata tetap memerlukan konfigurasi serta instruksi pengguna.

**Hasil fase5:** Acceptance lokal selesai: QRIS9tests37assertions, Python8offline, security38, baseline22unit+24integration, deployment13+Node11, frozen/typecheck/lint/build dan3Dockerimages PASS. Compose tepat app/gateway; gateway7HTTP, compiled checkout lima viewport dan SDK-normalizer→SQLite→HMAC→DB dengan ACK loss/restart memberi10credits sekali. Tujuh migration sebelumnya byte-identik;0007 aditif hanya di DB disposable. Review/fix pass didokumentasikan. QRIS defaultdisabled, merchant/wallet/session/production belum diuji; nominal permanen memberi batas maksimal999 per baseprice sepanjang histori. UI monokrom-orange/shape UjiHub dan4GLB belum masuk fase5. [Laporan](docs/revision/phase-5-report.md), [evidence](docs/revision/phase-5-evidence.json), [review](docs/revision/phase-5-review.md), [runbook](docs/payments-qris.md). Perubahan lokal belum commit/push/deploy.

### Fase 6. Fondasi desain Nesomn dengan shape UjiHub

**Prioritas:** P1. **Dependency:** Fase 2; sesudah fondasi P0 stabil.

- [x] Tetapkan tokens monokrom + orange, font, light/dark persistence, logo dan pemetaan tema admin.
- [x] Perbarui primitives, navigasi, form, modal, badge, filter, focus, target 44px, motion/reduced-motion dan feedback state.
- [x] Bedakan bentuk ekspresif public/store dengan kontrol editor/admin yang padat.

**Selesai bila:** Komponen representatif konsisten dalam dua tema, keyboard dan viewport target. Referensi bentuk terasa jelas tanpa mengubah konten atau fungsi platform.

**Hasil fase6:** Token bersama monokrom-orange, self-hosted Manrope/Bricolage, original logo, light/dark/system persistence client/admin dan accessible Radix mobile drawer selesai. Theme/navigation3tests19assertions, contrast2, baseline22, QRISpure4, deployment13+Node11, frozen/type/lint/build/Docker PASS. Actual Linux assets diuji Chrome lima lebar light/dark tanpa home horizontal overflow; Tab/Escape/recovery, query-only navigation, API error dan Scene Editor shell diuji. Review0Critical2Important2Minor diperbaiki dalam satu fix pass;6active categories RED→1GREEN, drawer tidak lagi menutupi hasil. No DB/API/domain/renderer/scene changes; public compositions/detail store/account/admin/editor phases7–10 tetap. [Laporan](docs/revision/phase-6-report.md), [evidence](docs/revision/phase-6-evidence.json), [design system](docs/design-system.md), [review](docs/revision/phase-6-review.md). Tidak commit/push/deploy atau klaim seluruh platform production-ready.

### Fase 7. Halaman publik, store, auth, account, dan pembayaran

**Prioritas:** P1. **Dependency:** Fase 4-6.

- [x] Terapkan desain pada home, katalog, filter/search, detail/preview, bundle builder, Library dan projects/account.
- [x] Lengkapi login/register/OAuth UI dan redirect yang sesuai API; satukan checkout marketplace, plan, dan top-up.
- [x] Tampilkan rincian kode unik sebelum pembayaran, QR/expiry, pending/paid/expired/reconciliation state, riwayat dan entitlement berdasarkan server.
- [x] Tambahkan loading/empty/error/retry/success/disabled states yang jujur; pertahankan harga serta konten authored dari sumber aslinya.

**Selesai bila:** Alur browse-login-buy-status-library/account terbukti dengan fake receipt dan DB test, termasuk gagal jaringan. Tidak ada success palsu dari browser atau mock fallback tersembunyi.

**Hasil fase7:** Public editorial/store/gallery/auth/account/library/projects/checkout UI diterapkan. Actual production gateway disposable browse-register-buy-receipt-replay-Library-private-download plus session revoke/login/networkretry PASS. Home5widths2themes tanpa overflow; frozen/type/lint/build/Docker/backend regressions PASS. Login/register deep links fixed with RED→GREEN. Independent review unavailable due reviewer usage limit; no CLEAN verdict. Live OAuth/merchant/production/full keyboard/editorGLB remain unproven. [Laporan](docs/revision/phase-7-report.md), [evidence](docs/revision/phase-7-evidence.json). Tidak commit/push/deploy.

### Fase 8. Viewer 3D, kompatibilitas editor, dan empat GLB

**Prioritas:** P1. **Dependency:** Fase 4, 6-7.

- [x] Pisahkan state preview read-only dari editor; reuse Three/R3F/Drei tanpa viewer library tumpang tindih.
- [x] Perbaiki referensi aset tersimpan, reset/load, clone material, mesh target decal/UV, camera state, serta export tanpa merusak format scene lama.
- [x] Tambahkan bounding-box frame/center, clipping dan zoom limits adaptif, studio lighting, reset/zoom/rotate/fullscreen, progress/poster/retry/no-WebGL, DPR dan reduced motion.
- [x] Kelola cache dan disposal sesuai ownership: jangan membuang geometry/material/texture bersama yang masih dipakai scene lain. Bersihkan object URL, listener, animation loop dan recording stream saat selesai/unmount.
- [x] Buat generator reproducible untuk nesomn-abstract-form.glb, nesomn-product-box.glb, nesomn-lowpoly-room.glb, nesomn-typography-block.glb; sertakan poster dan manifest.
- [x] Sediakan showcase production berlabel Demo/Sample; validasi glTF 2.0, GLB chunks, accessor/buffer bounds, mesh/material/resources, lalu render nyata seluruh model di browser desktop/mobile dan pergantian berulang.

**Selesai bila:** Empat GLB valid dan dirender, framing berbagai ukuran benar, preview tidak mengubah project, scene existing bisa dibuka/disimpan, serta material/decal/image/video export teruji. Validasi file saja tidak dihitung sebagai bukti render.

**Hasil fase8:** Empat original embeddedGLB/poster/manifest/generator, read-only viewer, bounding frame/controls/fallbacks/owned cleanup dan integrasi modelKey/material/meshdecal/editor export selesai dalam acceptance lokal. Khronos4x0error0warning; real production-image assets ChromeWebGL2 empatmodel1440/390+12switches, reducedmotion/fullscreen/invalidRetry/noWebGL, PNG/JPEG/WebMdecode PASS. LegacyJSON/catalog-source dan disposableDB ownership roundtrip PASS.10container/14image testing dihapus sesuai permintaan pengguna. Physicaldevice/liveCORS/remoteCI/wholeplatform readiness belum terbukti. [Laporan](docs/revision/phase-8-report.md), [evidence](docs/revision/phase-8-evidence.json), [runbook](docs/viewer-3d.md). Belum commit/push/deploy.

### Fase 9. Scene Editor 2D, AI workflow, dan admin

**Prioritas:** P1. **Dependency:** Fase 4-8.

- [ ] Terapkan workspace 2D responsif tanpa mengubah layer, selection, undo/redo, dokumen, import, save/load dan hasil export yang sudah didukung.
- [ ] Hubungkan Scene/Motion AI, credit display, polling, cancellation bila provider mendukung, retry/recovery, dan subscription gate dengan API yang telah diperkuat.
- [ ] Sinkronkan admin 3D/Scene assets, plans, packs, providers, usage, users, subscriptions, sessions, audit dan rekonsiliasi pembayaran yang didukung API.
- [ ] Perbaiki resource redirect, logo/base path, upload preview expiry, empty/error states dan validasi form; jalankan regresi lintas client/admin/API/worker.

**Selesai bila:** Editor 2D lama dan baru, job sukses/gagal/ulang, saldo/refund, worker independen, serta operasi admin memiliki bukti pengujian tanpa bypass permission.

### Fase 10. Acceptance, dokumentasi, dan release readiness

**Prioritas:** P0 untuk gerbang rilis. **Dependency:** Fase 1-9.

- [x] Jalankan frozen install, typecheck/lint/tests/build, Docker build, dan acceptance tepat dua service dalam environment yang tersedia.
- [x] Uji gateway, API/static/deep links/404, auth/role/ownership, upload/private download, QRIS, entitlement/credit/job, serta kedua editor dan scene lama.
- [x] Uji 360/390/768/1024/1440px, light/dark, keyboard/focus, reduced motion, console/network errors dan resource cleanup. Simpan screenshot/artifact desktop/mobile per surface yang benar-benar diuji.
- [x] Perbarui README, deployment/worker/migration/recovery runbook dan catatan as-built. Laporkan versi aktual, file penting, command, PASS/FAIL/SKIPPED/BLOCKED, deviasi, risiko dan sisa pekerjaan.

**Selesai bila:** Semua acceptance memiliki bukti atau blocker spesifik. Release readiness tidak berarti izin deploy/merge atau klaim seluruh platform production-ready bila live merchant, browser, Docker atau integrasi penting belum terbukti.

## 9. Peta file/folder yang diperkirakan terdampak

Path di bawah relatif terhadap root repository. Ini rencana cakupan, bukan daftar file yang sudah berubah. File baru dibuat hanya jika diperlukan oleh deliverable fase.

| Area                 | Existing yang ditinjau/diubah                                                                  | Penambahan yang direncanakan                                                                                             |
| -------------------- | ---------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| Runtime/tooling      | package.json, bun.lock, tsconfig.base.json, manifests workspace, eslint.config.mjs             | Runtime pin/config dan workflow CI yang diperlukan                                                                       |
| Deployment           | docker-compose.yml, nginx.conf, Dockerfile workspace                                           | Root multi-stage Dockerfile, .dockerignore, konfigurasi gateway/env/health yang sesuai                                   |
| API composition      | api/src/index.ts, api/src/middleware/_, api/src/lib/_                                          | Static SPA composition, environment validation, readiness tests                                                          |
| Data/business        | api/src/db/schema/_, api/drizzle/_, billing/auth/catalog/store/project/AI modules              | Migration aditif, invoice/receipt/fulfillment dan test konkurensi sesuai kebutuhan                                       |
| QRIS                 | packages/shared/src/index.ts, billing routes/gateway/grant                                     | Adapter QRIS dan wrapper worker eksternal pada integrations/qris/, tanpa menyalin worker upstream yang belum aman        |
| AI worker            | worker/Dockerfile, worker/src/index.ts, worker/src/process-job.ts, API queue/credit/provider   | Test recovery/idempotency dan runbook lifecycle independen                                                               |
| UI foundation        | client/src/index.css, components/ui/_, shell/_, stores/ui-store.ts                             | Theme/fonts/tokens yang diperlukan; pemetaan theme admin                                                                 |
| Pages/auth/store     | client/src/App.tsx, pages/_, hooks/_, lib/api.ts                                               | Route/form auth yang belum ada dan checkout/status QRIS                                                                  |
| 3D                   | components/editor3d/\*, stores/scene-3d-store.ts, pages/editor-3d.tsx, export/record utilities | Read-only viewer, showcase, generator, manifest, GLB/poster dan validator tests                                          |
| 2D                   | components/editor/\*, stores/scene-editor-store.ts, pages/scene-editor.tsx, export utilities   | Test kompatibilitas/save-load/export dan workflow UI yang diperlukan                                                     |
| Admin                | admin/src/App.tsx, resources.tsx, routes.tsx, providers/_, pages/_, public logo assets         | Surface rekonsiliasi yang memiliki API, tema dan validasi terkait                                                        |
| Dokumentasi/evidence | README.md, REVISION.md, DESIGN.md sebagai spesifikasi                                          | docs/deployment.md, docs/workers.md, docs/payments-qris.md, docs/migrations.md, docs/as-built.md dan artifact acceptance |

## 10. Strategi pengujian dan migrasi

Scripts yang sudah tersedia pada baseline:

```bash
bun install --frozen-lockfile
bun run typecheck
bun run lint
bun test
bun run build
docker compose config --services
```

`bun run dev` tersedia pada root. Script `start`, `test`, dan `db:migrate` tersedia pada workspace API; worker memiliki `start`; client/admin memiliki build/preview. Root belum memiliki script start/test/migration. Script baru untuk app, browser acceptance, atau validator ditambahkan dan didokumentasikan saat benar-benar diimplementasikan, bukan diasumsikan sudah tersedia.

Sesudah deployment baru tersedia, target command utama adalah `docker compose build` dan `docker compose up -d`. Output `docker compose config --services` wajib tepat:

```text
app
gateway
```

Migrasi menggunakan script existing workspace API melalui prosedur eksplisit yang menyesuaikan lokasi kerja image baru. Sebelum dijalankan: verifikasi DATABASE_URL tujuan tanpa membocorkan credential, backup dan uji restore, periksa migration journal/schema serta duplikasi yang dapat menggagalkan constraint baru, uji migration pada disposable clone, lalu jalankan hanya pada environment yang diotorisasi. Jangan menjalankan seed/reset/push otomatis. Sediakan recovery app-version dan perubahan schema aditif tanpa menghapus histori baru.

Test integrasi menggunakan DB disposable dan tidak mengarah ke akun merchant/DB production. Test browser harus memverifikasi perilaku, bukan hanya screenshot: status API, validasi form, fokus, scene compatibility, file export, model switching dan cleanup. Bukti visual mengikuti matriks viewport/tema/surface yang benar-benar diuji.

## 11. Dependensi eksternal dan keputusan sebelum live

- Akses Docker daemon saat ini terhalang permission; keberhasilan build/container belum dapat dijanjikan.
- DB/Redis test dan browser/WebGL yang sesuai harus tersedia untuk acceptance. Ketidakhadirannya dicatat sebagai blocker, bukan alasan menghapus fitur.
- Konfigurasi merchant asli diperlukan untuk aktivasi: QRIS statis, merchant/store scope, session/token aman dan aturan pembaruannya. Tidak ada transaksi merchant nyata dalam pengujian otomatis.
- Kebijakan late/unmatched/overpayment/refund/kode unik dan renewal ditulis jelas sebelum cutover live. Jangan menebak fitur merchant yang tidak disediakan SDK.
- Angka pasti palette orange dan contrast dipilih pada fase 6; identitas monokrom + orange serta font/shape sudah disepakati.
- Tidak menambahkan halaman/company claims, inquiry/SMTP, atau fungsi admin yang belum memiliki model/API tanpa scope baru yang eksplisit.

## 12. Referensi

- Repository target: https://github.com/ikhsanaryaaa/nesomn-studio-website
- Referensi bentuk UI: https://ujihub.royyan.net/
- Bun stable yang diperiksa: https://github.com/oven-sh/bun/releases/tag/bun-v1.4.4
- Elysia npm latest: https://registry.npmjs.org/elysia/latest
- CORS npm latest: https://registry.npmjs.org/@elysiajs%2fcors/latest
- QRIS source yang diaudit: https://github.com/ikhsanaryaaa/qris-merchant-id/tree/e1b1b6968c570c0cb18ccf9ce4d95694e8df48de

Referensi versi/source adalah snapshot saat analisis. Semua klaim implementasi final harus berdasarkan source hasil revisi dan bukti pengujian fase terkait.
