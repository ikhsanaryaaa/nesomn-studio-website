# Scene 2D, AI dan admin — as built phase 9

## Workspace 2D

Route /editor/scene, /editor/scene/:slug dan ?project=<id> tetap berlaku. Logical canvas dan JSON scene tetap sama; ResizeObserver mengatur presentation scale dari ruang aktual. Inspector di kanan pada desktop, di bawah canvas pada layar kecil. Layers mengikuti urutan paint existing dan dapat dipilih via keyboard. Properties mengubah field existing; tidak menambah format dokumen.

Undo/redo, duplicate/delete, import image, background dan export PNG/JPEG tetap tersedia. Ctrl/Cmd+Z dan Shift+Ctrl/Cmd+Z, Delete/Backspace dan Escape bekerja di workspace, tidak di input atau modal. Export memakai logical dimensions, maksimum sisi 1080px, menyembunyikan Transformer dan memulihkan skala/ukuran/visibility dalam finally. Sumber gambar lintas origin tetap memerlukan CORS. Error export tampil dan tidak mengubah project.

Project 3D ditolak pada editor 2D. Project load gagal tidak mengizinkan save ke project tersebut. Edit selama request save tetap dirty; respons lama tidak boleh menimpa title atau reload state yang lebih baru. Tidak ada migrasi scene.

## AI

Scene/Motion tetap memakai /api/ai/models, /credit, /jobs dan status by ID. Model/credit error ditampilkan dan dapat dicoba ulang; gagal membaca saldo tidak dianggap nol. Job yang belum mendapatkan respons status tetap menonaktifkan generate. Status terminal menyegarkan saldo dari API. Gagal generate tidak otomatis diklaim refund tanpa membaca saldo.

Panel mempertahankan prompt/job saat berganti tab di editor 2D. Setelah reload, buka Pulihkan job dari server, Muat riwayat job lalu pilih ID. Operasi ini hanya membaca riwayat milik sesi aktif, tidak mengirim ulang generate. Riwayat API dibatasi 50 job. Job needsReview harus direkonsiliasi admin sebelum dikirim ulang.

POST /api/ai/jobs/:id/cancel hanya membatalkan pending. Bila worker sudah mengklaim job, server menolak 409. UI tidak menjanjikan penghentian provider. Tidak ada integrasi provider live yang diuji pada fase ini. Worker/credits/refund/replay diuji dengan provider test terisolasi; deployment independen tetap mengikuti [workers.md](workers.md).

## Admin dan preview

Default admin mengarah ke resource assets-scene dengan URL /admin/assets. /admin/subscriptions dan /admin/credit-ledger membaca API existing melalui cookie dan guard requireAdmin. Halaman ini sengaja read-only: tidak ada tombol mengubah paid, grant saldo atau memindahkan histori provider. CRUD katalog, plans, packs, provider, sessions dan audit existing tetap tersedia. Rekonsiliasi pembayaran tetap prosedur server di [payments-qris.md](payments-qris.md); belum ada API dashboard receipt reconciliation.

Upload preview baru mengembalikan previewPath /api/catalog/preview/<mediaUUID> selain previewUrl sementara existing. Kedua form aset menyimpan previewPath. Resolver hanya menerbitkan signed redirect 300 detik untuk media PNG/JPEG/WebP yang direferensikan oleh aset published, atau admin terautentikasi. Draft, gambar tak direferensikan dan file produk tidak terbuka untuk publik. Respons resolver no-store. Mengetahui media ID tidak memberikan akses file produk.

URL signed lama dalam DB tidak dikonversi massal. Untuk aset yang preview-nya sudah kedaluwarsa, periksa pemetaan media di staging/backup lalu unggah ulang preview melalui form admin. Jangan menebak fileKey produk sebagai gambar publik. Tidak ada migrasi/reset/seed saat startup.
