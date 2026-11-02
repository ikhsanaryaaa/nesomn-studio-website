# Audit Baseline Nesomn Studio

Pelaksanaan: 30-31 Oktober 2026, Asia/Jakarta. Scope: fase 1 REVISION.md. Audit dan pengujian persiapan, bukan implementasi modernisasi atau persetujuan production release.

## Identitas dan integritas checkout

- Repository: https://github.com/ikhsanaryaaa/nesomn-studio-website.git
- Workspace: C:/Users/ikhsan/Desktop/nesomn-studio-website.
- Branch: main; commit 041d225fca07ae405b440ca424a0c56f90fdac0f.
- Tidak ada source aplikasi tracked yang diubah. Hash 157 file source dan empat migration disimpan pada phase-1-baseline.json untuk pemeriksaan ulang.
- REVISION.md dan graphify-out yang sudah ada dipertahankan. Tidak ada checkout/reset/commit/push/merge atau remote change.
- issue.md existing dipertahankan; scope fase ini tercatat pada phase-1-issue.md. Publikasi issue/PR tidak dilakukan dalam pekerjaan audit lokal.

README, PRD, DESIGN, roadmap, workflow, aturan internal, manifests, lockfile dan konfigurasi ditinjau. DESIGN adalah draft spesifikasi dark/indigo, bukan bukti as-built atau pengganti keputusan monokrom + orange dan shape UjiHub. AGENTS.md, PENJELASAN-PROYEK.md, docs deployment, CI dan .dockerignore belum tersedia pada baseline. Dokumen internal ignored dibaca terpisah; isi .env tidak dimasukkan dalam evidence.

## Inventaris workspace

Jumlah adalah file tracked di dalam src pada commit baseline, termasuk test existing. Bukan jumlah semua asset/build/dependency.

| Workspace | File src | Implementasi | Scripts yang benar-benar ada |
| --- | --- | --- | --- |
| client | 64 | React/Vite, Router, Tailwind/shadcn/Radix, Query/Zustand, Konva/R3F | dev, build, preview, typecheck |
| admin | 18 | Refine/Ant Design, providers, CRUD 3D/Scene, users/billing/AI/session/audit | dev, build, preview, typecheck |
| api | 71 | Elysia, Zod, Drizzle/Postgres, auth/storage/catalog/billing/AI/admin | dev, start, typecheck, test, db:generate, db:migrate, db:seed |
| worker | 3 | BullMQ consumer dan processJob, mengimpor source API | dev, start, typecheck |
| packages/shared | 1 | DTO, enum kontrak, SceneState/Scene3DState, billing/AI types | typecheck |

Root memiliki dev/build/lint/format/typecheck. Root tidak memiliki start/test/migration script; `bun test` adalah command runtime. Elysia dideklarasikan ^1.2.25 dan terkunci 1.4.28; CORS terkunci 1.4.2. Bun global 1.4.0, manifest/Docker 1.3.14. Tidak ada install atau upgrade pada fase 1.

## Alur dan kontrak antar workspace

1. Client/admin memanggil /api dengan cookie. Nginx existing menghapus prefix /api ketika meneruskan ke Elysia; admin SPA berada pada /admin, sedangkan API admin juga memiliki prefix internal /admin.
2. Client memakai fetch wrapper dengan DTO shared dan type assertions. Eden treaty belum diimplementasikan meskipun disebut pada komentar; tidak ada jaminan runtime response schema end-to-end.
3. Store 2D/3D berada pada Zustand. Project CRUD menyimpan JSON state ke projects.state dan memeriksa user ownership.
4. Katalog memetakan field publik; editor loader mendapatkan signed model/base-image URL; claim/download memakai licenses pada jalur store.
5. Checkout menghitung harga server-side dan membuat orders/order_items. Grant menulis subscription/credit_ledger/licenses.
6. AI routes menentukan provider/tier, memotong credit, insert ai_jobs, lalu enqueue Redis ai-jobs. Worker mengambil job/provider dari DB, menjalankan adapter, update status dan refund bila gagal.
7. Admin di atas API guarded mengelola katalog, plans/packs, user/subscription/ledger, session, provider/usage dan audit. Worker bergantung pada database/schema/crypto/provider API, bukan hanya shared DTO.

Graph existing dipakai untuk navigasi DB, grantOrder, processJob dan ModelMesh. Ekstraksinya tidak lengkap; keputusan audit dikonfirmasi lewat source dan test, bukan inferred graph edges.

## Peta endpoint source

Ini inventaris route yang didefinisikan source, bukan klaim bahwa endpoint berhasil dipanggil. Runtime API test masih terhalang dependency memoirist.

| Prefix internal | Route utama | Boundary yang terlihat |
| --- | --- | --- |
| /health | GET health | Publik, hanya status proses |
| /auth | POST register, login, logout | Register/login publik; logout requireAuth; Google OAuth belum ditemukan |
| /me, /sessions | Profil, access, daftar/revoke sesi | requireAuth dan ownership revoke |
| /catalog | assets list/detail, editor-asset, bundles list/detail | Publik; list published, detail/loader belum konsisten |
| /store | bundle/price, claim, checkout draft, library, download | requireAuth; download license; checkout lama belum settle |
| /projects | List/create/get/update/delete | requireAuth dan ownership by userId |
| /ai | Models, credit, jobs create/status/history | requireAuth; tier/provider checks; one-job check belum atomik |
| /billing | Plans/packs, checkout, webhook, dev/pay, history, subscription/cancel | Campuran publik/auth; simulator dan signature perlu diperbaiki |
| /files/:key | Streaming local storage | Signed token TTL; bukan pemeriksaan ulang license |
| /admin | assets-3d, assets-scene, bundles, plans, packs, users, subscriptions, ledger, sessions, providers, audit, uploads | Parent requireAdmin guard; subroute tidak aman untuk dipasang terpisah tanpa guard |

Client memiliki home, pricing, marketplace/detail, bundle-builder, library, editor scene/3D dengan slug/project query, projects, account, checkout dan not-found. Tidak ada route Login publik walaupun sidebar mengarah ke /login. Admin punya login sendiri dan basename /admin. Halaman studio/services/works/contact tidak ditemukan.

## Peta data dan invariants

Empat migration 0000-0003 terdaftar di journal. Pada DB disposable kosong, semuanya berhasil dan menghasilkan 17 public tables serta empat journal entries. Snapshot metadata terakhir 0002, sedangkan 0003 merupakan migration manual: sebelum generate perubahan berikutnya, periksa kemungkinan drift snapshot/schema; jangan menganggap journal membuktikan database existing identik.

| Domain | Tabel | Hubungan dan invariant yang harus dipertahankan |
| --- | --- | --- |
| Identitas | users, sessions | Email/googleId unik; sesi mengacu user; role admin/user; logout/revoke invalidates session |
| Subscription | plans, subscriptions | User-plan, segment/cycle/period; max session dan feature access; cancel/expiry harus konsisten |
| Credit | credit_packs, credit_ledger | Ledger per user; delta/reason/ref/balanceAfter; charge/refund/grant tidak boleh ganda atau lost update |
| Katalog | assets, bundles, bundle_items | Slug unik; discriminator editorType; draft/published/archived; bundle pair primary key |
| Commerce | orders, order_items, licenses | User order, polymorphic refType/refId; lisensi mengacu user/aset/order; kepemilikan beli tidak dihapus saat subscription berakhir |
| Project | projects | Owner, scene2d/scene3d, JSON state; konten authored/transform tidak berubah karena tema UI |
| AI | ai_providers, ai_jobs | Provider key unik, encrypted key, user/provider job; status/priority/input/cost/result; batas job aktif dan refund |
| Media/audit | media, audit_logs | Storage key unik; owner/actor nullable; jangan bocorkan credential melalui metadata/audit |

orders dan ledger belum memiliki seluruh constraint idempotency/fulfillment yang diperlukan modernisasi. refId order_items berupa text polymorphic, sehingga keberadaan target dan snapshot manfaat perlu dijaga di application boundary. Saldo sekarang dibaca dari balanceAfter terbaru, bukan konsisten dihitung SUM(delta) seperti narasi sebagian dokumen.

### Kontrak scene yang dipertahankan

- 2D: canvas width/height/background; objects image/text dengan id, transform, opacity, fill/src/text/fontSize. Store history hanya state UI, bukan bagian dokumen tersimpan.
- 3D: modelKey, background, materialColor, grain, camera preset dan decals src/position/rotation/scale. modelUrl tidak masuk shape serialisasi lama.
- Fixture sintetis ditulis berdasarkan kontrak itu, tidak mengambil database pengguna. Test round-trip dan duplicate/undo berjalan pada store existing tanpa DB/WebGL.
- Referensi model katalog, GLB material/mesh dan URL texture harus ditambah secara backward-compatible pada fase 8; jangan mengganti karya lama menjadi sample secara diam-diam.

## Kekuatan yang memiliki bukti terbatas

- Unit harga diskon, password hashing, encryption dan parser query lulus.
- CRUD project memiliki pemeriksaan ownership pada source, tetapi endpoint runtime belum lulus karena module API gagal dimuat.
- Guard admin terpusat dan cookie httpOnly tersedia pada source; konfigurasi secure/origin/CSRF/expiry tetap perlu audit implementasi lanjutan.
- Session limit basic, credit debit/refund, retention selection dan processJob stub memiliki test yang lulus pada DB disposable.
- Tiga test kontrak scene lulus. Tidak ada klaim visual render atau validasi export dari hasil ini.

## Register gap, fallback dan risiko

| ID | Risiko/source | Bukti dan dampak | Fase perbaikan |
| --- | --- | --- | --- |
| P0-01 | billing/gateways/stripe.ts | Signature hanya diperiksa ada; JSON dipercaya. Audit sebelumnya mengonfirmasi signature palsu menghasilkan paid pada adapter dummy | 4, sebelum cutover 5 |
| P0-02 | billing/routes.ts, gateway.ts, stub.ts | Client dapat memilih stub; dev/pay tidak membatasi production; public webhook stub tanpa signature; unknown/missing-config gateway dapat fallback ke stub | 4-5 |
| P0-03 | billing/routes.ts, grant.ts | Paid ditulis sebelum transaksi grant; retry dapat melewatkan fulfillment yang gagal, request paralel dapat menggandakan grant; subscription belum memakai marker order unik | 4-5 |
| P0-04 | catalog/routes.ts, feature-access.ts | Public editor loader menerbitkan file URL tanpa auth/license; detail by slug tidak memeriksa published; canUseAsset belum dipakai dan belum mencakup seluruh asset flag | 4 |
| P0-05 | ai/routes.ts, ai/credit.ts, process-job.ts | Debit/insert/enqueue terpisah; active-job check race; latest-ledger row lock tidak otomatis menyelesaikan seluruh concurrent append/grant/refund | 4, 9 |
| P0-06 | Dockerfiles, docker-compose.yml | Enam service; worker image tidak memuat source API; env worker/secret production belum diteruskan; frozen install memiliki fallback; health hanya proses | 3 |
| P0-07 | auth/session/feature-access/billing/retention | Expiry/cancel/tier/session memakai aturan berbeda; kuota/expiry lifecycle belum lengkap; README menunjuk script retention yang tidak ada | 4, 9 |
| P1-01 | client/App.tsx, sidebar, auth routes | Login publik belum ada; Google env/schema tidak membuktikan OAuth route tersedia | 4, 7 |
| P1-02 | bundle-builder.tsx, pricing.tsx, store/routes.ts | Marketplace masih draft checkout; pricing hardcode stub; histori dan status UI belum pembayaran nyata | 5, 7 |
| P1-03 | model-mesh.tsx, scene-3d-store.ts | Cylinder fallback tanpa label eksplisit; modelUrl tidak tersimpan/reset; GLB color tidak mengikuti store; decal belum mesh-target yang jelas | 8 |
| P1-04 | scene-3d-viewport.tsx, record-3d-video.ts | Kamera/zoom tetap, Center bukan auto-frame; belum ada no-WebGL/error isolation lengkap; captureStream tidak menjamin 1080px dan cleanup track | 8 |
| P1-05 | provider.ts, providers/kie.ts | Konfigurasi kosong fallback stub; Kie payload endpoint kerangka belum diverifikasi pada provider nyata; jangan mengklaim generate live bekerja | 4, 9 |
| P1-06 | queue.ts, worker/index.ts | REDIS_URL hanya host/port; auth/TLS/db index terbuang; retry attempts 1; belum graceful shutdown/reconciliation menyeluruh | 3-4, 9 |
| P1-07 | local-fs.ts, nginx.conf | Local signed URL /files tidak diproxy oleh Nginx existing yang hanya mengarah /api ke server; fallback HTML dapat merusak preview/download | 3, 7 |
| P1-08 | local-fs.ts, storage/routes.ts | Default signing key development; perbandingan token sederhana; path containment startsWith belum memeriksa separator boundary | 4 |
| P1-09 | uploads.routes.ts, nginx.conf, admin forms | API limit 25/100MB tetapi gateway belum mengatur limit; MIME bergantung metadata upload; preview URL signed TTL dapat kedaluwarsa bila disimpan sebagai permanen | 3-4, 9 |
| P1-10 | rate-limit.ts, nginx.conf | Peer IP server di belakang proxy dapat menjadi IP gateway; perlu trusted proxy parsing agar limit tidak terkumpul pada semua pengguna | 4 |
| P1-11 | client/index.css, editor layouts, admin/App.tsx | Dark/indigo/Inter berbeda dari target; kontrol 32-38px; inspector fixed; mobile drawer focus perlu perbaikan | 6-9 |
| P1-12 | marketplace.tsx, use-feature-access.ts | API error dapat tampil sebagai empty catalog/default free access; belum semua error/retry state jujur | 7 |
| P1-13 | admin/App.tsx, resources.tsx | Default NavigateToResource masih assets, sementara resource assets-scene; logo absolute root berpotensi salah pada base /admin | 9 |
| P1-14 | integration tests existing | Test session tidak cleanup semua user; route test tidak mencakup auth negative/ownership lengkap karena belum bisa dimuat; butuh DB disposable baru per run | 2, 4 |
| P1-15 | shared contracts/API wrapper | DTO assertions tanpa runtime contract; update route dan DTO dapat drift; perubahan harus diuji lintas client/admin/API/worker | 2, 4-9 |

Tidak ada risiko di atas yang dinyatakan sudah diperbaiki. Penambahan fase 1 hanya melindungi cara menjalankan baseline dan menyiapkan bukti untuk perbaikan berikutnya.

## Baseline hasil eksekusi

| Command/operasi | Status | Batas bukti |
| --- | --- | --- |
| node --test tests/baseline-runner.test.mjs | PASS, 5 test | Env allowlist, target test tetap, opt-in dan command selection |
| node scripts/test-baseline.mjs unit | PASS, 22 test | 19 existing + 3 state compatibility; tidak menjalankan browser |
| Migration existing pada DB disposable | PASS | 4 journal entries, 17 public tables; bukan migration production |
| Plan sintetis minimum | PASS | Satu plan scene_individual_monthly; bukan seed aplikasi |
| Redis disposable | PASS, PONG | Connectivity saja, belum queue end-to-end |
| Integration baseline | FAIL: 12 pass, 4 fail, 4 errors | Auth/project/AI/billing route files tidak dapat load karena memoirist hilang |
| bun run typecheck, melalui flags isolasi | FAIL | Shared lulus; empat workspace lain gagal, termasuk dependency/type hilang |
| bun run lint, melalui flags isolasi | FAIL | ESLint tidak menemukan debug; tidak menghasilkan audit lint source lengkap |
| bun run build, melalui flags isolasi | FAIL | Vite client/admin tidak menemukan rollup; tidak ada production asset build baru |
| Compose utama config --services | PASS sebagai inventaris | Tetap enam service; target dua service fase 3 belum terpenuhi |
| Compose test config --services | PASS | Hanya test-db/test-redis, dipanggil eksplisit |
| Browser/UI/GLB/export acceptance | SKIPPED | Fase 1 belum build/deploy aplikasi dan belum membuat empat GLB |
| Frozen install/upgrade | SKIPPED | Scope fase 2; dependency/lockfile tidak diubah |
| Merchant/AI provider nyata | SKIPPED | Tidak menggunakan credential atau transaksi production |

Satu percobaan fixture lewat Docker CLI dengan environment minimal gagal pada plugin Compose; pengulangan melalui shell Docker normal berhasil. Koneksi port test sempat ditolak sandbox; akses berizin berhasil. Daemon tersedia, sehingga hambatan Docker lama bukan lagi alasan untuk melewatkan baseline DB.

Command, exit code, counts, source/migration hash dan scripts/dependency manifests ada pada phase-1-baseline.json. Log command baseline utama ada di .cache/revision-phase-1/2026-10-30/. Beberapa observasi Docker/fixture yang sebelumnya hanya tampil pada tool output ditranskripsikan ke JSON dengan provenance historis; bukan raw log atau fresh rerun. Guard runner memerlukan Node yang mendukung node:test (dipakai v24.18.0); aplikasi/test tetap menggunakan Bun 1.4.0 pada audit ini.

## Strategi aman untuk fase berikutnya

1. Fase 2 memulihkan frozen install dan dependency yang hilang, kemudian mengulang command baseline dengan environment test yang sama. Jangan mengubah test assertion agar tampak lulus.
2. Setelah API dapat dimuat, jalankan auth/role/ownership, download dan billing negatif sebelum perubahan bisnis. P0 pembayaran/aset tetap harus dianggap terbuka sampai dibuktikan tertutup.
3. Tambahkan constraint/idempotency setelah memeriksa duplikasi data existing di environment yang diotorisasi. DB kosong yang berhasil tidak membuktikan constraint baru aman pada histori production.
4. Pertahankan fixture scene legacy dan catat output sebelum mengubah model reference/material/export. Render dan file export baru dibuktikan pada fase 8/9.
5. Gunakan fake provider dan normalized receipt samples untuk fase 5/9. Backend QRIS dan callback tidak tersedia pada baseline ini; jangan membuat test yang memanggil merchant nyata.
6. Sebelum upgrade production, backup termasuk migration journal, periksa restore pada DB terpisah, bandingkan schema existing dengan source, dan tentukan recovery release secara eksplisit.

## Deliverable dan batas selesai fase 1

Audit, source/schema hash manifest, issue/progress, runbook, test runner, fixture scene/receipt/plan dan Compose disposable tersedia. Fase 1 selesai sebagai audit yang reproducible dengan blocker tercatat meskipun baseline aplikasi belum hijau. Fase 2-10 belum dimulai.

Review independen memverifikasi 157 hash source dan empat hash migration, serta lima guard test. Evidence sukses fixture telah dilengkapi sambil mempertahankan attempt yang gagal. Digest dua image test direkam; Compose test masih memakai tag mayor yang mutable.

Pada pemeriksaan akhir 31 Oktober, kedua container test yang sama sudah exited (255) sebelum proses cleanup. Penyebab berhenti belum diketahui; tidak diklaim sebagai graceful shutdown atau keberhasilan recovery. Tidak ada restart/penghapusan volume, dan tidak ada tindakan atas stack utama. Gunakan prosedur runbook untuk membuat baseline test baru pada fase 2.
