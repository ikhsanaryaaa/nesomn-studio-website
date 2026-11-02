# Bug tracker — Nesomn Studio

Diperbarui: 1 November 2026. Review awal: 31 Oktober 2026. Repository: [nesomn-studio-website](https://github.com/ikhsanaryaaa/nesomn-studio-website).
Branch saat review: `works/runtime-tooling-upgrade`. HEAD: `041d225fca07ae405b440ca424a0c56f90fdac0f`.

Ketiga bug awal telah diperbaiki di source dan lulus regresi lokal. **FIXED LOCAL** tidak berarti production-ready: tes endpoint terhadap PostgreSQL disposable dan storage R2 live belum dijalankan karena Docker daemon tidak tersedia. Satu race Canvas tambahan ditemukan dan diperbaiki saat regresi. Rincian source, command, screenshot dan batas bukti ada di [laporan perbaikan](docs/revision/bug-fixes-2026-11-01.md).

| ID | Prioritas | Bug | Status |
| --- | --- | --- | --- |
| NS-BUG-001 | P1 | Project akun lama tetap tampil setelah pergantian akun | FIXED LOCAL — 1 Nov 2026 |
| NS-BUG-002 | P1 | Edit selama save 3D tertimpa respons/snapshot lama | FIXED LOCAL — 1 Nov 2026 |
| NS-BUG-003 | P1 | Gambar katalog 2D gagal dirender setelah signed URL kedaluwarsa | FIXED LOCAL — 1 Nov 2026 |
| NS-BUG-004 | P2 | Race inisialisasi Canvas ketika berpindah scene | FIXED LOCAL — 1 Nov 2026 |

## NS-BUG-001 — State project terbawa antar-akun

**Dampak:** data project akun A terlihat oleh akun B pada tab/browser yang sama. Backend tetap menolak akses project tersebut; temuan ini merupakan kebocoran state client, bukan bypass ownership API yang terbukti.

**Lokasi source saat review:**

- [use-auth.ts](client/src/hooks/use-auth.ts), baris 41–44.
- [auth.tsx](client/src/pages/auth.tsx), alur login yang membersihkan Query Client.
- [scene-editor.tsx](client/src/pages/scene-editor.tsx), baris 68–70.

**Langkah reproduksi:**

1. Login sebagai A dan buka project 2D milik A.
2. Logout melalui menu akun.
3. Login sebagai B pada tab yang sama, dengan return URL ke project A.
4. Periksa judul/canvas dan lakukan GET langsung terhadap project itu.

**Hasil aktual:** sidebar sudah menampilkan B, tetapi judul/canvas A tetap terlihat. GET project sebelum probe tetap satu kali; probe API untuk B mengembalikan 404.

**Hasil yang diharapkan:** pergantian identitas membersihkan state privat dan memvalidasi akses sebelum menampilkan project.

**Penyebab teridentifikasi:** logout/login membersihkan TanStack Query tetapi tidak mereset Zustand scene store. Editor melewati GET apabila project ID sama dengan ID pada store, tanpa mempertimbangkan pemilik sesi.

**Arah perbaikan:** isolasi/reset state editor berdasarkan identitas sesi, validasi ulang ownership, serta batalkan hasil async dari sesi lama.

**Acceptance perbaikan:**

- [x] Setelah A logout dan B login, tidak ada judul, layer atau gambar A yang terlihat.
- [x] Project yang tidak dimiliki B menghasilkan state akses ditolak/tidak ditemukan.
- [x] Respons load/save/image yang masih berjalan dari sesi A tidak mengisi kembali store B.
- [x] Save/load normal dalam sesi yang sama tetap bekerja.

**Bukti:** [hasil JSON](docs/revision/artifacts/bug-review-2026-10-31/browser-results.json), [screenshot](docs/revision/artifacts/bug-review-2026-10-31/account-switch-private-project.png).

## NS-BUG-002 — Edit selama save 3D hilang

**Dampak:** perubahan yang dibuat ketika request save berjalan dapat tertimpa; state juga ditandai tidak dirty walaupun perubahan terbaru belum tersimpan.

**Lokasi source saat review:**

- [editor-3d.tsx](client/src/pages/editor-3d.tsx), baris 125–136.
- [scene-3d-store.ts](client/src/stores/scene-3d-store.ts), baris 129.

**Langkah reproduksi:**

1. Buka scene 3D baru.
2. Klik Save dengan respons POST ditunda dua detik.
3. Selagi request berlangsung, ubah judul menjadi `EDITED WHILE SAVING`.
4. Tunggu respons save dan reload project yang dipicu perubahan query parameter.

**Hasil aktual:** judul kembali menjadi `Untitled 3D Scene`; perubahan terbaru hilang.

**Hasil yang diharapkan:** snapshot yang dikirim tersimpan, sedangkan edit lebih baru tetap berada pada canvas/store dan tetap dirty.

**Penyebab teridentifikasi:** `markSaved` menulis judul respons dan `dirty=false` tanpa memeriksa revisi. Sesudah create, perubahan parameter project memicu reset/load dari snapshot lama.

**Arah perbaikan:** gunakan snapshot/revisi dan identitas dokumen untuk membatasi respons save; pertahankan perubahan terbaru dan hindari reload yang menimpanya.

**Acceptance perbaikan:**

- [x] Judul dan properti yang diedit selama save tetap utuh setelah respons diterima.
- [x] Perubahan yang belum termasuk snapshot tersimpan tetap dirty.
- [x] Berlaku untuk create dan update project.
- [x] Respons save dokumen lama tidak mengubah dokumen yang baru dibuka.
- [x] Save tanpa perubahan tambahan tetap menandai state tersimpan dengan benar.

**Bukti:** [hasil JSON](docs/revision/artifacts/bug-review-2026-10-31/browser-results.json), [screenshot](docs/revision/artifacts/bug-review-2026-10-31/3d-save-lost-title.png).

## NS-BUG-003 — Signed image URL pada scene 2D kedaluwarsa

**Dampak:** project tetap memiliki layer, tetapi gambar katalog tidak dirender saat dibuka ulang setelah URL kedaluwarsa. Ini berlaku juga pada project baru. File aset tidak terbukti terhapus; kegagalan terjadi pada pemuatan gambar.

**Lokasi source saat review:**

- [scene-editor.tsx](client/src/pages/scene-editor.tsx), baris 114.
- [catalog/routes.ts](api/src/modules/catalog/routes.ts), baris 133.
- [canvas-object.tsx](client/src/components/editor/canvas-object.tsx), baris 20–38.

**Langkah reproduksi:**

1. Muat mockup katalog ke Scene Editor 2D.
2. Simpan project.
3. Simulasikan kedaluwarsa URL gambar dengan respons HTTP 403.
4. Buka ulang project tersimpan.

**Hasil aktual:** layer masih tersimpan satu, tetapi pixel gambar pada fixture turun dari 2704 menjadi 0. Tidak ada lookup untuk memperoleh URL baru.

**Hasil yang diharapkan:** project mendapatkan URL authorized yang masih valid dan gambar kembali dirender, atau menampilkan error/retry yang jelas bila akses benar-benar tidak tersedia.

**Penyebab teridentifikasi:** URL signed berumur 300 detik disimpan langsung pada `objects[].src`. Loader hanya menggunakan URL lama, tanpa referensi aset stabil atau refresh. Hook gambar tidak melaporkan kegagalan pemuatan tersebut.

**Arah perbaikan:** simpan identitas aset/media yang stabil dan resolve URL baru dengan pemeriksaan akses ketika load. Pertahankan kompatibilitas scene lama dan tangani kegagalan gambar secara eksplisit.

**Acceptance perbaikan:**

- [x] Simpan, kedaluwarsakan URL, lalu buka ulang: gambar tetap dapat dipulihkan dengan otorisasi yang sah.
- [ ] Verifikasi ulang endpoint dengan DB disposable bahwa refresh tidak membuka aset milik pengguna lain atau melewati lisensi. Implementasi memeriksa auth/lisensi; test DB tersedia tetapi SKIPPED (Docker daemon tidak tersedia).
- [x] Scene lama tetap dapat dimuat atau mendapat pesan pemulihan yang jelas.
- [x] Error/loading/retry gambar terlihat; export tidak diam-diam dianggap lengkap saat gambar gagal dimuat.
- [x] Transform, urutan layer, undo/redo dan format export tetap kompatibel.

**Bukti:** [hasil JSON](docs/revision/artifacts/bug-review-2026-10-31/browser-results.json), [screenshot](docs/revision/artifacts/bug-review-2026-10-31/2d-signed-source-expired.png).

## NS-BUG-004 — Canvas selesai inisialisasi setelah DOM dilepas

**Dampak:** navigasi dokumen 3D saat renderer sedang mulai dapat memicu exception `Cannot read properties of null (reading 'addEventListener')` pada event connector R3F.

**Perbaikan 1 November 2026:** connector bersama `client/src/lib/scene-pointer-events.ts` memeriksa target sebelum connect. Dipakai editor 3D dan viewer. Regresi browser sebelum guard gagal dengan exception tersebut; sesudah guard, skenario navigasi saat save tertunda lulus dengan `consoleExceptions: []`. Bukti pada [laporan perbaikan](docs/revision/bug-fixes-2026-11-01.md).

## Hasil perbaikan — 1 November 2026

- NS-BUG-001: reset kedua store pada perubahan identitas, generasi sesi untuk menolak respons lama, remount outlet, serta cleanup/guard callback image dan FileReader. Akses project divalidasi ulang.
- NS-BUG-002: acknowledgment save memakai snapshot dan identitas dokumen; edit terbaru tetap dirty, create tidak me-reload snapshot lama, serta respons dokumen yang ditinggalkan diabaikan.
- NS-BUG-003: referensi gambar stabil dengan redirect authorized/no-store; resolver URL lama memeriksa key storage, aset dan lisensi; loading/error/retry terlihat dan export parsial diblokir.
- PASS lokal: frozen install, typecheck lima workspace, lint (dua warning existing), production client build, 15 unit tests/84 assertions, browser desktop/mobile light/dark.
- SKIPPED: DB disposable dan Docker build/gateway/R2 live pada revisi ini. Tidak ada container/image Docker baru karena daemon tidak berjalan.
- [Hasil browser setelah perbaikan](docs/revision/artifacts/bug-fixes-2026-11-01/browser-results.json). Semua langkah reproduksi dan screenshot di bagian bug awal di atas adalah **bukti sebelum perbaikan**; hasil aktualnya dipertahankan sebagai catatan historis.

## Bukti dan batas pengujian awal

- Reproduksi menggunakan Chrome 156 dan production Linux assets hasil phase 10 dengan API fixture lokal. Nama/data dalam screenshot adalah data sintetis.
- Ownership 404, respons save tertunda, dan expiry gambar dikendalikan fixture. Expiry tidak memakai token storage production atau menunggu merchant/provider live.
- `node scripts/test-phase9.mjs unit`: **9 PASS, 47 assertions**. Tes existing itu belum mencakup tiga skenario di atas; hasil tersebut tidak berarti ketiganya sudah diperbaiki.
- [Verifikasi source](docs/revision/artifacts/bug-review-2026-10-31/source-verification.json) mencatat 209 file source tanpa perbedaan terhadap snapshot phase 10 pada saat review.
- Dugaan perpindahan slug 2D menumpuk layer **tidak terbukti** dan tidak masuk daftar bug. Transisi pathname me-remount editor; layer tetap satu.
- Review ini terfokus dan tidak menjamin seluruh repository atau integrasi live bebas bug.
- Tidak ada DB/merchant production yang digunakan, container/image Docker yang dibuat, atau credential yang diubah.

## Aturan status

OPEN berarti belum diperbaiki. FIXED LOCAL berarti perbaikan source dan regresi lokal sudah dijalankan; checklist yang belum terverifikasi dan pengujian SKIPPED tetap dicatat. Jangan mengubahnya menjadi verifikasi production sebelum pengujian integrasi dan deployment terkait benar-benar lulus.
