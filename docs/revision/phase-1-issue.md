# Audit Baseline dan Persiapan Pengujian

## Summary

Menjalankan fase 1 REVISION.md pada repository nesomn-studio-website. Hasil berupa audit source, peta domain/data, fixture sintetis, runner terisolasi dan bukti baseline sebelum modernisasi.

## Scope

Termasuk seluruh workspace, manifests/scripts/lockfile, route/UI, auth, schema/migration, storage/upload, billing/subscription/credit, queue/worker, Docker/Nginx dan dokumentasi. Pengujian boleh menggunakan DB/Redis disposable baru.

Tidak termasuk upgrade dependency, perubahan fitur/tema, integrasi QRIS nyata, perbaikan kode bisnis, migrasi DB existing/production, publikasi GitHub, commit/push/merge atau deployment. Checkout pengguna dan issue.md sebelumnya dipertahankan.

## Tahapan Implementasi (Steps)

- [x] Verifikasi cwd, remote, branch, commit, status dan batasan source/dokumen.
- [x] Inventaris workspace, scripts, endpoint, relasi dan invariants yang harus dipertahankan.
- [x] Siapkan fixture scene legacy dan normalized receipt sintetis tanpa data pengguna.
- [x] Tulis dan uji pengaman runner terhadap environment production serta command/test arbitrer.
- [x] Siapkan Compose test yang dipanggil eksplisit dengan project dan port sendiri, tanpa named volume.
- [x] Jalankan unit, checks tooling, migration disposable, fixture minimum dan integration baseline; catat kegagalan tanpa menyembunyikannya.
- [x] Catat risiko, urutan fase selanjutnya, evidence, runbook dan keterbatasan.
- [x] Review independen dan verifikasi akhir deliverable fase 1.

## Expected Result

Repository yang benar teridentifikasi, source/data domain terpeta, test fixture dan command dapat diulang dengan isolasi jelas, baseline PASS/FAIL/BLOCKED transparan, dan kode aplikasi/dependency/schema existing tidak diubah. Baseline tidak diwajibkan hijau untuk menyatakan audit selesai; hambatan menjadi input fase 2, bukan klaim readiness.

## Features

Runner unit/integration tanpa .env production; test guard; round-trip scene 2D/3D; DB/Redis tmpfs; fixture plan minimum; manifest hash source/migration dan laporan audit.

## Related Modules

Semua workspace ditinjau. Penambahan dibatasi pada scripts test, tests/fixtures, dokumentasi dan status REVISION.md.

## Related Files

- REVISION.md
- scripts/test-baseline.mjs
- tests/baseline-runner.test.mjs
- tests/scene-compatibility.test.ts
- tests/compose.test.yml
- tests/fixtures/README.md
- tests/fixtures/scene2d-legacy.json
- tests/fixtures/scene3d-legacy.json
- tests/fixtures/qris-receipts.sample.json
- tests/fixtures/baseline-plans.sql
- docs/testing.md
- docs/revision/phase-1-issue.md
- docs/revision/phase-1-progress.md
- docs/revision/phase-1-audit.md
- docs/revision/phase-1-baseline.json

## Notes

Instruksi pengguna terbaru dan REVISION.md menjadi scope; tidak menimpa issue.md internal tentang pemisahan aset. Root main dipertahankan karena fase audit tidak mengubah kode aplikasi dan pengguna sebelumnya melarang pergantian checkout otomatis. Tidak ada commit pada main. Implementasi fase berikutnya memerlukan branch kerja yang sesuai aturan repository.

Docker CLI dapat diakses setelah izin sandbox disesuaikan untuk target test lokal. Tidak ada perubahan credential production. Environment sanitized hanya untuk Bun/test, bukan Docker CLI, karena pembuangan environment sistem tertentu dapat mengganggu discovery plugin Compose pada Windows.
