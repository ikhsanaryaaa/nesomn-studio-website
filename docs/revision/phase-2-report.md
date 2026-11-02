# Hasil fase 2: runtime, dependency dan tooling

31 Oktober 2026, Asia/Jakarta. Repository `https://github.com/ikhsanaryaaa/nesomn-studio-website.git`, branch `works/runtime-tooling-upgrade`, HEAD `041d225fca07ae405b440ca424a0c56f90fdac0f`. Perubahan masih lokal, belum commit/push/deploy. Artifact fase 1 dan perubahan pengguna dipertahankan.

## Perubahan nyata

- Bun 1.4.4 stable, Elysia 1.4.30, CORS 1.4.2, bun-types 1.4.4 dipin; lockfile diperbarui terbatas. Dependency aplikasi lain tetap pada resolusi existing.
- `.bun-version`, manifest, guard runtime, CI dan keempat Dockerfile diselaraskan. Image Bun memakai tag versi dan digest resmi. Frozen install tidak memiliki fallback tidak terkunci.
- Dependency tree lama diarsipkan secara reversible di `.cache/dependencies-before-phase2/`; fresh frozen install memulihkan dependency hilang dan junction workspace. Typecheck selesai tanpa source casts/any.
- Prerender client memakai `react-dom/server.edge` untuk menghindari MessageChannel dari browser entry yang menahan proses Node. HTML dan metadata tiga route tetap dihasilkan. Regression test terhadap bundle produksi membuktikan render dan exit normal.
- CI baru menjalankan frozen install, checks, build, unit dan integration dengan PostgreSQL/Redis disposable. `.dockerignore` mencegah environment, storage lokal, cache dan dependency host tersalin ke image. ESLint hanya mengecualikan artifact generated/cache tambahan.
- README, runbook runtime/testing, issue, ledger dan evidence diperbarui berdasarkan hasil source/checks.

Sumber pemilihan stable dan cara aktivasi runtime lokal ada di [runtime.md](../runtime.md). Global Bun mesin tetap 1.4.0; seluruh checks Bun fase ini menggunakan executable workspace 1.4.4 dengan PATH terkontrol. Node aktual 24.18.0. Tidak mengganti framework, model data, schema/migration, auth, provider pembayaran, scene format atau UI.

## Verifikasi

Command Bun di bawah dijalankan dengan `--no-env-file`, environment allowlist sintetis dan PATH Bun 1.4.4. Khusus build memakai NODE_ENV=production; pengujian tetap test. Log lokal `.cache/revision-phase-2/` diabaikan Git; ringkasan terstruktur dan hash log disimpan di [phase-2-evidence.json](phase-2-evidence.json).

| Command / pemeriksaan | Hasil | Batas bukti |
| --- | --- | --- |
| `bun install` lalu `bun install --frozen-lockfile` | PASS | Fresh install berhasil; final frozen tidak mengubah hash lockfile |
| `bun run check:runtime` | PASS | 1.4.4 diterima; global 1.4.0 ditolak dengan exit 1 sesuai harapan |
| `bun run typecheck` | PASS | Lima workspace exit 0 |
| `bun run lint` | PASS, 2 warnings | Fast Refresh existing pada badge/button; 0 errors, tidak dinonaktifkan |
| `bun run build` | PASS | Client/admin exit 0; client prerender `/`, `/pricing`, `/marketplace` |
| `node --test tests/baseline-runner.test.mjs tests/runtime-pin.test.mjs tests/prerender-exit.test.mjs` | PASS: 10 | Guard environment/runtime, production bundle dan SSR, bukan browser hydration |
| `node scripts/test-baseline.mjs unit` | PASS: 22 | Unit existing dan scene serialization/undo, bukan render/export visual |
| Migration entry existing pada DB disposable, lalu fixture SQL | PASS | Empat migration; tanpa seed aplikasi; bukan bukti upgrade schema production |
| `NESOMN_DISPOSABLE_TESTS=1 node scripts/test-baseline.mjs integration` | PASS: 24 | Auth cookie, session, ownership project, credit/refund, route AI, billing stub, retention, pemrosesan worker stub |
| `docker build -f api/Dockerfile -t nesomn-runtime-check:phase2 .` | PASS | Linux amd64 build; tidak memulai server |
| `docker build -f worker/Dockerfile -t nesomn-worker-check:phase2 .` | PASS | Packaging source/dependency, bukan consumer BullMQ end-to-end |
| `docker build -f client/Dockerfile -t nesomn-client-check:phase2 .` | PASS | Production assets dan prerender Linux |
| `docker build -f admin/Dockerfile -t nesomn-admin-check:phase2 .` | PASS | Production admin assets pada base `/admin/` existing |
| API image smoke: `bun --version`, absence `.env`, `.cache`, `.git` | PASS | Versi 1.4.4 dan path tersebut tidak ada; bukan security audit seluruh image |
| Parse YAML workflow dengan Bun.YAML | PASS | Sintaks/struktur lokal; GitHub Actions remote SKIPPED, belum push |
| `docker compose --env-file .env.example config --services` | 6 service existing | Target tepat app/gateway BELUM terpenuhi; fase 3 |
| Browser/mobile/light-dark screenshots, WebGL, gateway acceptance | SKIPPED | Tidak dilakukan pada fase runtime; tidak ada screenshot acceptance baru |
| Merchant, upload R2, OAuth Google, provider AI live, queue delivery/retry end-to-end | SKIPPED | Tidak memakai credential/service production; scope fase berikutnya |

Pengujian menggunakan project `nesomn-revision-test` saja, PostgreSQL loopback 55432 dan Redis loopback 56379. Fixture harga/akun adalah sintetis. Tidak ada transaksi merchant nyata atau akses DB production. Runbook lengkap install/env/migration/fixture/stop: [testing.md](../testing.md).

Kedua container test dihentikan setelah pengujian; pemeriksaan akhir menunjukkan `test-db exited 0` dan `test-redis exited 0`. Tidak ada volume dihapus. Perbandingan hash fase 1: 156 dari 157 file source aplikasi tetap identik, satu perubahan hanya entry prerender `client/src/main.tsx`; keempat file migration tetap identik.

## Diagnosis dan perbaikan

Install pertama yang inkremental belum memperbaiki tree dependency rusak. Lint menemukan debug hilang, build rollup hilang, dan types Drizzle berbeda akibat copy workspace lama. Setelah arsip tree dan fresh frozen install, seluruhnya pulih tanpa mengubah API bisnis.

Build awal setelah fresh install menghasilkan HTML tetapi client tidak keluar. Regression test RED merender ketiga route lalu timeout 10 detik. Source React terpasang memperlihatkan browser server entry membuka MessageChannel pada load; edge entry tidak membukanya. Sesudah mengganti satu import, root build exit 0 dan regression test GREEN (subprocess sekitar 0,35 detik). Tidak ada `process.exit` paksa, penghapusan prerender, atau timeout suppression. Entry tersedia dalam [exports resmi React](https://github.com/react/react/blob/main/packages/react-dom/package.json).

Ada lint error sementara pada test baru karena import process belum ditulis; diperbaiki dengan import eksplisit dan lint ulang lulus. Final frozen install sempat mendapat `EBADF` dari temporary directory sandbox; pengulangan dengan akses normal berhasil. Dua percobaan validasi YAML memakai assertion pada `pull_request: null`/runtime yang keliru; command diperbaiki dan parse final berhasil, tanpa perubahan workflow untuk menyembunyikan kegagalan.

Review akhir mengonfirmasi NODE_ENV=test dari job CI ikut memengaruhi build. Test artifact RED menemukan marker React development `not wrapped in act` pada bundle lama. CI step build diberi env production terpisah; local build diulang dengan production dan exit 0. Artifact test GREEN, Node suite final 10 pass, lint ulang 0 errors. Env integration tetap test. Pemeriksaan marker development adalah guard regresi, bukan audit keseluruhan isi bundle.

## File penting

`package.json`, `api/package.json`, `worker/package.json`, `bun.lock`, `.bun-version`, `scripts/check-runtime.mjs`, `tests/runtime-pin.test.mjs`, `tests/prerender-exit.test.mjs`, `client/src/main.tsx`, `eslint.config.mjs`, `.dockerignore`, keempat workspace Dockerfile, `.github/workflows/ci.yml`, `README.md`, `REVISION.md`, `docs/runtime.md`, `docs/testing.md`, dan `docs/revision/phase-2-*`.

## Risiko dan lanjutan

Build production masih memberi peringatan chunk besar: editor 3D sekitar 1,06 MB dan bundle admin sekitar 1,90 MB uncompressed pada build Windows. Optimasi pemuatan/chunking perlu pengukuran pada fase UI/editor. Dua warning Fast Refresh tetap dicatat.

Billing test yang lulus menggunakan stub dan tidak membuktikan signature provider, atomic settlement, QRIS atau concurrent credit aman. Temuan keamanan fase 1 tetap terbuka untuk fase 4-5. Worker test memanggil pemroses secara langsung; Redis PONG dan hasil stub tidak membuktikan lifecycle retry consumer. Scene contract test tidak membuktikan render GLB, material, export atau cleanup WebGL.

Empat Dockerfile diperbaiki sebatas pin, frozen install, context dan packaging. API/worker belum multi-stage/non-root production. Compose utama belum diubah; external DB/Redis/worker, app static hosting, health/readiness, API JSON404 dan gateway menjadi fase 3. Tidak ada perubahan visual UjiHub/monokrom-orange pada fase ini; desain tetap fase 6 dan seterusnya.

Fase 2 tidak menyatakan platform production-ready. Tidak ada commit, push, merge, force-push, deployment, seed massal, perubahan credential atau migrasi production.

Review independen akhir **CLEAN** setelah perbaikan environment build CI. [Catatan review](phase-2-review.md) memuat cakupan, bukti dan batas verifikasi reviewer. Fase 2 selesai; fase 3 belum dimulai.
