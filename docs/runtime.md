# Runtime dan dependency

Runtime fase 2, diperbarui untuk deployment fase 3 pada 31 Oktober 2026. Jalankan command dari root repository. Laporan fase 2 tetap bukti historis; deployment aktual mengikuti [deployment.md](deployment.md).

## Versi terpin

| Komponen | Versi | Keputusan |
| --- | --- | --- |
| Bun | 1.4.4 | Release stable terbaru saat verifikasi; tidak prerelease |
| Elysia | 1.4.30 | npm dist-tag latest; patch dari lockfile 1.4.28 |
| @elysiajs/cors | 1.4.2 | latest; peer Elysia >=1.4.0; tidak menonaktifkan proteksi |
| bun-types | 1.4.4 | Diselaraskan dengan executable, API dan worker |
| Node.js tooling | 24.18.0 | Versi lokal dan CI untuk runner Node/Vite; server tetap Bun |

Sumber: [release Bun 1.4.4](https://github.com/oven-sh/bun/releases/tag/bun-v1.4.4), [blog resmi Bun](https://bun.com/blog), [Elysia npm](https://www.npmjs.com/package/elysia), [CORS npm](https://www.npmjs.com/package/@elysiajs/cors), [bun-types npm](https://www.npmjs.com/package/bun-types). Dist-tag dapat berubah; versi di atas adalah hasil verifikasi pada tanggal tersebut. Metadata release lokal tersimpan di `.cache/revision-phase-2/bun-release.json`.

`.bun-version`, `packageManager`, `engines`, types, workflow CI dan root Dockerfile menggunakan pin yang sama. Root `preinstall`, `dev`, `typecheck`, dan `build` menjalankan guard versi exact. Menjalankan script workspace langsung melewati guard root; aktifkan runtime yang benar dahulu. Dependency lain dipertahankan sesuai lockfile; tidak ada force install atau penurunan validation/auth.

## Mengaktifkan Bun

Pasang versi spesifik melalui [panduan resmi Bun](https://bun.com/docs/installation), lalu pastikan `bun --version` menghasilkan `1.4.4`. Pada mesin pelaksanaan, global Bun masih `1.4.0` dan sengaja tidak diganti. Executable resmi Windows x64 berada di:

```text
.cache/runtime/bun-1.4.4/bun-windows-x64/bun.exe
```

Aktifkan untuk sesi PowerShell lokal ini:

```powershell
$env:PATH = "$PWD\.cache\runtime\bun-1.4.4\bun-windows-x64;$env:PATH"
bun --version
bun run check:runtime
```

Folder `.cache` tidak masuk Git/image; clone lain harus memasang Bun sendiri. Archive resmi `bun-windows-x64.zip` telah dicocokkan dengan digest SHA256 release GitHub:

```text
cd2c0fccc78f3ede1f50ca827a15f063eda13d4d150a3d0674f4f6e323d864a5
```

## Install dan checks

```bash
bun install --frozen-lockfile
bun run check:runtime
bun run typecheck
bun run lint
bun run build
node --test tests/baseline-runner.test.mjs tests/runtime-pin.test.mjs tests/prerender-exit.test.mjs tests/browser-bootstrap.test.mjs
node scripts/test-deployment.mjs
node scripts/check-deployment.mjs
node scripts/test-baseline.mjs unit
```

Tes artifact membutuhkan hasil build client/admin terlebih dahulu. Ia memeriksa marker React development tidak ikut bundle, merender `/`, `/pricing`, `/marketplace` melalui bundle produksi dan memastikan subprocess keluar tanpa open handle. Build harus menggunakan `NODE_ENV=production` (default Vite bila belum disetel); jangan mewariskan `NODE_ENV=test` ke build. Pada PowerShell dapat ditetapkan dengan `$env:NODE_ENV = 'production'` sebelum build. Root build hanya memiliki build script pada client/admin; API dan worker menjalankan TypeScript melalui Bun.

Ikuti [runbook test](testing.md) untuk PostgreSQL/Redis disposable, migration existing, fixture sintetis dan integration. Jangan menjalankan test existing langsung ke `.env` aplikasi. Migration test memanggil entry langsung dengan `--no-env-file` dan environment sintetis; tidak menjalankan seed aplikasi.

Untuk development biasa, isi `.env` dari `.env.example` sesuai layanan development sendiri, lalu jalankan `bun run dev`. Script ini juga memulai API dan worker yang dapat mengakses layanan dari environment; ini bukan command pengujian terisolasi.

## Dependency tree lama

Instalasi inkremental masih mewarisi node_modules yang tidak lengkap: debug/rollup hilang dan workspace API berbentuk salinan lama, menyebabkan identitas types Drizzle berbeda. Tree lama dipindahkan secara reversible ke `.cache/dependencies-before-phase2/` setelah memastikan semua path berada di repository. Fresh frozen install memulihkan junction workspace yang benar dan menyelesaikan typecheck tanpa casts/any atau perubahan schema. Arsip lokal tersebut tetap ada dan tidak ikut lint/Docker context; tidak perlu menyalinnya ke mesin lain.

Jika mengalami keadaan serupa, tutup proses development dan arsipkan hanya direktori dependency yang sudah diperiksa, kemudian install frozen ulang. Jangan menghapus perubahan source atau menjalankan reset Git. Error Bun `EBADF accessing temporary directory` sempat muncul di sandbox terbatas; verifikasi ulang dengan akses temporary directory normal berhasil, tanpa mengubah lockfile.

## Docker dan CI

Semua stage Bun memakai multi-platform index resmi:

```text
oven/bun:1.4.4-alpine@sha256:4cf82f5686b196504fe119db3fcd9185b191f82ece82c40680e597228ec6070a
```

Dockerfile menyalin semua manifest workspace dan guard sebelum frozen install, tanpa fallback ke install tidak terkunci. Stage build memiliki tooling, stage production-deps hanya dependency API/worker/shared, runtime non-root. Worker memakai source API yang memang diimpor existing. `.dockerignore` mengecualikan environment, local storage, dependency host, cache dan metadata Git. Tidak ada migration/seed saat build atau boot.

```bash
docker build --target app -t nesomn-app:release .
docker build --target worker -t nesomn-ai-worker:release .
```

Fase 3 menggunakan tepat app/gateway pada Compose utama. Build client/admin masuk image app, worker merupakan target image terpisah yang dijalankan independen. Dockerfile workspace legacy dihapus agar tidak menjalankan packaging lama yang berbeda. Detail port/TLS/storage/health/migrasi ada di deployment.md. Fitur bisnis/payment/3D lengkap tetap memerlukan fase berikutnya.

`.github/workflows/ci.yml` memakai setup-bun dari `.bun-version`, checks, PostgreSQL/Redis disposable, migration dan baseline integration. Step build secara eksplisit memakai `NODE_ENV=production`; test tetap `test`. CI juga memeriksa Compose, membangun target app/worker dan menguji bootstrap artifact Linux hasil image. Bootstrap client tidak lagi memakai top-level await, karena cyclic React chunk dapat menahan eksekusi browser pada hasil bundling Linux. Workflow belum dijalankan GitHub Actions karena tidak ada push; bukti lokal dan batas tes ada di laporan fase terkait.
