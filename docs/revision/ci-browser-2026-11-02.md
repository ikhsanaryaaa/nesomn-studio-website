# CI browser acceptance — 2 November 2026

Perbaikan untuk PR #27 pada branch works/runtime-tooling-upgrade. Tidak mengubah domain/API/payment atau menonaktifkan tes/sandbox browser.

## Temuan dan perbaikan

1. **Chrome startup:** run [41410255066](https://github.com/ikhsanaryaaa/nesomn-studio-website/actions/runs/41410255066) berhenti sebelum UI karena loop menunggu CDP hanya 60×100ms. Preflight Linux [41421575534](https://github.com/ikhsanaryaaa/nesomn-studio-website/actions/runs/41421575534) menunjukkan proses masih running, bukan exit akibat sandbox/profile. Helper bersama sekarang menunggu readiness hingga30s, timeout tiap fetch, gagal langsung pada process exit/error, serta menyertakan diagnosis startup. Tidak ada --no-sandbox, retry seluruh suite atau continue-on-error.
2. **Drawer focus:** setelah startup diperbaiki, assertion menangkap focus sementara null sesudah portal dialog dilepas. Tes kini menunggu focus kembali ke tombol navigasi, tetap dengan batas waktu dan assertion asli. Focus trap20 Tab dan Escape recovery tetap diuji.
3. **3D save:** viewer harness masih menunggu toast lama “Project tersimpan”; UI bugfix telah memakai “Snapshot project tersimpan”. Harness sekarang memeriksa request yang diterima fixture, tombol Save selesai, dirty state bersih, serta model/grain/meshPath hasil save. Tidak bergantung pada toast copy.

## Bukti

- Regresi startup CDP tertunda >6s dijalankan terhadap loop lama: FAIL “Chrome debug endpoint unavailable”; helper baru: PASS. Tes juga memeriksa process exit, deadline dan port CDP setiap suite.
- `node --test tests/browser-startup.test.mjs tests/release-runner.test.mjs`: sembilan tes PASS.
- `node tests/chrome-startup.mjs`: Chrome lokal dengan env release sintetis PASS.
- `tests/release-ci.test.ts`: satu tes/11 assertions PASS. Lint lokal: nol error, dua warning Fast Refresh existing.
- Theme browser aktual lokal: lima viewport, persistent theme client/admin, focus trap/recovery dan API error PASS.
- Viewer aktual lokal: empat GLB,12 model switches, kontrol/fullscreen/reduced-motion/error/retry, save serta export PNG/JPEG/WebM PASS.
- Run Linux [41422861928](https://github.com/ikhsanaryaaa/nesomn-studio-website/actions/runs/41422861928) sudah membuktikan tema/public/editor-gateway/editor-admin PASS setelah perbaikan startup/focus; run tersebut masih gagal pada assertion toast viewer lama. Hasil revisi final mengikuti [checks PR #27](https://github.com/ikhsanaryaaa/nesomn-studio-website/pull/27/checks).

Semua pengujian tetap menggunakan compiled production assets dan fixture/disposable environment. Local browser artifact/harness sementara berada di .cache/ci-fix, tidak dipush. Tidak ada DB/merchant production atau Docker lokal baru pada diagnosis ini. Cleanup container/image CI tetap dijalankan oleh release-lab dan workflow, termasuk pada run yang gagal. PR tidak di-merge dan tidak ada deployment production.
