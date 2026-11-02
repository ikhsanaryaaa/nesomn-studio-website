# Execution ledger: REVISION.md, fase 2

Mulai 31 Oktober 2026, Asia/Jakarta. Source base 041d225fca07ae405b440ca424a0c56f90fdac0f. Branch works/runtime-tooling-upgrade. Fase 1 dan seluruh artifact existing dipertahankan.

## Rulings

1. Otorisasi lanjut fase 2 mencakup branch kerja yang disyaratkan REVISION.md. Buat branch pada HEAD yang sama; tidak memindahkan checkout ke revision lain atau membuat worktree tanpa permintaan. Biaya: perubahan belum terisolasi pada direktori terpisah, tetapi branch dan scope terpisah dari main.
2. Gunakan Bun 1.4.4 di .cache workspace dengan PATH terkontrol. Global Bun 1.4.0 tetap ada. Biaya: developer harus mengaktifkan runtime terpin sesuai runbook.
3. Elysia 1.4.30, @elysiajs/cors 1.4.2 dan bun-types 1.4.4 adalah stable/latest yang diverifikasi saat fase ini. Dependency lain dipertahankan sejauh tidak diperlukan untuk compatibility.
4. Arsipkan dependency tree lama di .cache/dependencies-before-phase2 setelah pemeriksaan containment path; jangan hapus source atau force install. Alasan: install inkremental mewarisi dependency hilang dan copy workspace lama. Biaya: arsip memakai ruang disk lokal.
5. Dockerfile menyalin seluruh manifest dan runtime guard agar frozen install benar-benar reproducible. Worker menyalin source API karena import existing membutuhkannya. Arsitektur Compose tetap ditunda ke fase 3; image API/worker belum production hardening.
6. Pakai react-dom/server.edge untuk prerender Vite: browser entry meninggalkan MessageChannel aktif di Node. Biaya: satu import source berubah di fase tooling; kontrak HTML/metadata dan route dipertahankan serta dites bundle produksi RED/GREEN.
7. CI memerlukan Node untuk tooling di samping Bun. Versi Node aktual 24.18.0 dipin di setup-node; server runtime tetap Bun. Workflow belum di-push/dijalankan remote.
8. Review menemukan env test job CI diwariskan ke build Vite. Override NODE_ENV=production hanya pada step build, tanpa mengubah env pengujian. Tambahkan guard artifact React development dengan marker yang terbukti RED pada bundle lama; biaya: regression test bergantung pada marker versi React terkunci.

## Bukti awal

- GitHub Bun latest: bun-v1.4.4, prerelease false; npm Elysia latest 1.4.30, CORS 1.4.2, bun-types 1.4.4.
- Archive resmi Windows x64 SHA256 cd2c0fccc78f3ede1f50ca827a15f063eda13d4d150a3d0674f4f6e323d864a5 cocok; executable mengembalikan 1.4.4.
- Runtime guard RED: test gagal ketika module belum tersedia. Implementasi minimal ditambahkan sebelum verifikasi GREEN.

## Progress

Frozen install, typecheck lima workspace, lint (0 errors, dua warnings existing), client/admin production build, 10 Node tests, 22 unit/scene tests, dan 24 integration tests PASS. Empat migration existing + satu plan sintetis dijalankan hanya pada DB disposable. Empat Docker image build Linux PASS; API image smoke Bun/absence env/cache/git PASS. YAML workflow dan build/test env berhasil divalidasi lokal. Tidak ada deployment/live provider. Kedua container disposable telah stop dan teramati exited 0.

Runtime guard RED sebelum module tersedia lalu GREEN 3 tests. Prerender regression RED: HTML tiga route ada tetapi subprocess timeout 10 detik; GREEN setelah edge entry, build exit 0 dan Node suite 9 pass. Lint error import process test baru diperbaiki sebelum final lint. Frozen install final SHA256 bun.lock 95afff69a5504197a958829f630e8f55e8fbade43a34e43e0721b330f0aaf3e8 tidak berubah.

Review fix RED production artifact tersimpan di .cache/revision-phase-2/production-assets-red.log. Build production ulang exit 0; GREEN suite final 10 pass dan lint 0 errors. Tidak mengulang integration karena perubahan terakhir hanya environment build CI, test artifact dan dokumentasi; source API/worker/migration tidak berubah.

Review independen akhir CLEAN setelah satu fix pass build environment; 10 Node tests dan 12 hash log diverifikasi reviewer. Integration/migration/Docker besar diperiksa reviewer melalui source/evidence, tidak dijalankan ulang olehnya. Semua checklist fase 2 selesai; status COMPLETE dalam scope runtime/tooling, bukan production readiness. Ringkasan dan batas bukti ada di phase-2-report.md, phase-2-evidence.json dan phase-2-review.md. Branch/direktori tetap dipertahankan, tanpa commit/push/merge. Fase 3 belum dimulai.
