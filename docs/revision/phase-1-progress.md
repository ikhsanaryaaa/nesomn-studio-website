# Execution ledger: REVISION.md, fase 1

Scope: audit baseline dan persiapan pengujian. Pelaksanaan 30-31 Oktober 2026. Commit source 041d225fca07ae405b440ca424a0c56f90fdac0f.

## Rulings

1. Kerjakan fase 1 saja. Scope audit tidak meliputi perbaikan bug aplikasi, upgrade, desain baru atau merchant cutover; kegagalan baseline dicatat untuk fase terkait. Biaya keputusan: aplikasi tetap memiliki masalah yang ditemukan sampai fase perbaikan dijalankan.
2. Tetap pada checkout main tanpa commit, switch, worktree, push atau issue GitHub, mengikuti batasan pengguna sebelumnya dan scope lokal saat ini. Biaya keputusan: artifact audit belum memiliki commit/branch sendiri; sebelum implementasi berikutnya harus ditempatkan pada branch kerja yang benar.
3. Jangan menimpa issue.md existing. Issue fase ini disimpan pada docs/revision/phase-1-issue.md. Biaya keputusan: workflow issue internal lama dan roadmap modernisasi memiliki dokumen terpisah yang harus dibaca bersama.
4. TDD berlaku pada pengaman runner baru. Tidak menulis test untuk sekadar menyalin dokumentasi; fixture scene diuji lewat store existing untuk menjaga kompatibilitas state.
5. Source inventory menggunakan git tracked files. Dokumen internal ignored dibaca terpisah; .env tidak dimasukkan ke inventory/evidence. Graph existing hanya dipakai navigasi karena ekstraksinya tidak lengkap.

## Bukti kerja

- Identitas remote/workspace/commit terverifikasi; REVISION.md dan graphify-out yang sudah ada dipertahankan.
- Source aplikasi: client 64 file, admin 18, api 71, worker 3, shared 1; total 157 file tracked dalam src.
- Empat migration existing dan 17 tabel dipetakan; hash disimpan pada phase-1-baseline.json.
- RED: node --test tests/baseline-runner.test.mjs gagal karena runner belum ada.
- GREEN: lima guard test lulus setelah runner dibuat.
- Unit existing 19/19 lulus. Ditambah tiga test kontrak scene, baseline unit menjadi 22/22.
- Docker awal ditolak sandbox. Pemeriksaan berizin membuktikan client/server 29.6.1 dapat diakses.
- Project Docker nesomn-revision-test belum ada sebelum dibuat. Dua service test baru memakai loopback 55432/56379 dan tmpfs, bukan volume/data existing.
- Empat migration berhasil pada DB kosong baru; satu plan fixture dimasukkan. DB/role terverifikasi, public tables 17, journal entries 4, Redis PONG.
- Satu percobaan fixture lewat Docker CLI dengan environment test yang terlalu minim gagal pada discovery Compose; dicatat dalam JSON evidence. Pengisian melalui Docker CLI normal berhasil. Koneksi TCP integration sempat diblokir sandbox dan dijalankan ulang dengan izin akses port test.
- Integration: 12 pass, 4 fail, 4 errors. Empat file route gagal load karena memoirist hilang; bukan PASS API.
- Typecheck gagal; lint tidak menemukan debug; build tidak menemukan rollup. Tidak ada install/upgrade sebagai bagian fase 1.

## Final verification

- Review independen fase 1 selesai: tidak ada critical finding pada runner/isolasi. Reviewer menjalankan ulang lima guard test dan mengonfirmasi 157 hash source serta empat hash migration identik.
- Important finding evidence: JSON awal hanya memiliki fixture attempt yang gagal. Diperbaiki dengan menambahkan successful retry, identitas DB, counts, Redis PONG dan Compose inventories dari tool output yang benar-benar diamati. Provenance transkripsi historis dinyatakan; bukan klaim fresh rerun atau raw log yang tidak ada. Attempt gagal tetap disimpan.
- Minor finding image tag mutable: digest image postgres/redis dari run asli dicatat pada baseline JSON. Compose test tetap memakai tag mayor; exact reproduction dapat memakai digest yang direkam. Tidak ada upgrade image produksi.
- Setelah retry pengguna dan pergantian tanggal, kedua container test dengan ID yang sama sudah teramati exited (255) sebelum cleanup. Percobaan konfirmasi live fixture berhenti dengan service not running; tidak ada DB write pada pemeriksaan ini. Penyebab stop tidak diketahui; tidak diklaim graceful shutdown. Tidak ada restart, stop tambahan, penghapusan container atau volume.
- Compose utama masih enam service; Compose test eksplisit hanya dua. Tidak ada perubahan deployment utama.
- Batas review: tidak menilai schema production, merchant/provider nyata, browser/WebGL/export, queue recovery atau endpoint runtime lengkap. Semua tetap menjadi scope fase berikutnya dengan bukti terpisah.
- Task 1 selesai sebagai audit baseline dan persiapan test, dengan baseline aplikasi belum hijau. REVISION.md diperbarui untuk membedakan fase 1 selesai dari fase 2-10 yang belum dimulai.
