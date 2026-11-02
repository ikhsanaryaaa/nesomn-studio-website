# Runtime dan Tooling Upgrade

## Summary

Menjalankan fase 2 REVISION.md pada branch works/runtime-tooling-upgrade dari commit 041d225. Memulihkan dependency dan baseline yang gagal pada fase 1 dengan runtime stable terpin.

## Scope

Pin Bun/Elysia/plugin/types, lockfile, instalasi, guard runtime, penyesuaian tooling/CI/Docker, dan perbaikan source minimum yang diperlukan oleh typecheck/lint/build/test setelah instalasi valid. Tidak mengganti framework, desain, schema/database existing, gateway pembayaran, atau deployment Compose utama. Bug bisnis besar dicatat untuk fase 4 dan seterusnya.

## Tahapan Implementasi (Steps)

- [x] Verifikasi remote/branch/status/commit dan buat branch kerja tanpa membuang artifact fase 1.
- [x] Verifikasi stable resmi; unduh Bun workspace dan validasi SHA256 tanpa mengganti global runtime.
- [x] Pin manifest/runtime/Docker/CI dan regenerasi lockfile secara terkendali.
- [x] Jalankan install lalu frozen install; perbaiki dependency/types yang benar-benar hilang.
- [x] Jalankan checks, diagnosis error source dan perbaikan minimum dengan regression tests bila perilaku berubah.
- [x] Ulang baseline unit/integration disposable, review independen dan dokumentasikan hasil aktual.

## Expected Result

Runtime dan dependency selaras; frozen install, typecheck, lint, build dan baseline tests memiliki bukti PASS atau blocker eksternal spesifik. Tidak ada penyembunyian error melalui any, rule disable menyeluruh, force install, mock fallback, atau pengurangan assertion test.

## Features

Runtime exact-version guard, lockfile reproducible, dev/CI/Docker pin konsisten dan baseline yang dapat dijalankan.

## Related Modules

Semua manifests/tooling dan workspace yang memiliki error setelah dependency dipulihkan. Kompatibilitas source API/client/admin/worker/shared tetap dijaga.

## Related Files

package.json, bun.lock, .bun-version, manifests workspace, Dockerfile workspace, eslint.config.mjs, tsconfig terkait bila dibutuhkan, scripts/check-runtime.mjs, scripts/test-baseline.mjs, tests/runtime-pin.test.mjs, workflow CI, docs/runtime.md, docs/testing.md, docs/revision/phase-2-*, REVISION.md. Source minimum yang harus diperbaiki akan dicatat dalam ledger.

## Notes

User mengotorisasi fase 2. Branch baru tetap pada commit awal yang sama, membawa seluruh file pengguna, tanpa reset/cherry-pick. Tidak ada commit/push/merge/deployment atau transaksi merchant. .env production tidak digunakan untuk baseline test.

Status: COMPLETE pada scope fase 2. Hasil dan keterbatasan: [laporan](phase-2-report.md), [evidence](phase-2-evidence.json), [review independen](phase-2-review.md). Fase 3 belum dimulai.
