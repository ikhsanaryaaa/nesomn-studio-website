# Nesomn Studio — as-built phase 10

Status: implementasi lokal dan acceptance disposable, bukan persetujuan deploy production. Sumber implementasi adalah source repository dan [bukti phase10](revision/phase-10-report.md), bukan klaim historis README.

## Platform dan workspace

Bun Workspaces tetap client/, admin/, api/, worker/ dan packages/shared/. Bun 1.4.4, Elysia 1.4.30, @elysiajs/cors 1.4.2 dipin. Drizzle ORM 0.45.4, Sharp 0.35.5 dan Zod 4.6.7 diperbarui lewat [remediasi dependency](dependency-security.md); Node 24.18.0 dipakai untuk tooling/test harness, bukan runtime API.

Main Compose hanya app dan gateway. Nginx proxy ke app:3000; app Elysia melayani /api, build client SPA, /admin SPA dan signed storage routes. Gateway default 127.0.0.1:8080; TLS di reverse proxy terpisah. PostgreSQL, Redis, storage, AI worker dan QRIS worker memiliki lifecycle independen. Tidak ada Vite server atau migrasi/seed saat boot. Unknown API JSON404, missing assets tidak mendapat index.html.

## Modul yang tersedia

- Public/home, marketplace/filter/detail, bundle builder/quote, auth/OAuth, pricing, account/history, library/private download dan projects memakai API existing. Harga/quote/discount dihitung server. API error terlihat sebagai error, bukan produk mock. Demo GLB hanya /demo/3d berlabel Demo/Sample.
- Scene 2D memakai Konva, format canvas/objects existing. Responsive fit, area kerja mobile yang dapat di-scroll sampai seluruh inspector pada layar pendek, layer/property inspector, import, selection/transform, undo/redo, save/load dan PNG/JPEG memakai logical canvas (maksimum export 1080px). Export memulihkan state setelah error. Edit yang dibuat selama save tetap dirty.
- Editor/viewer 3D memakai Three.js/React Three Fiber/Drei, satu renderer dan shared loading. Model GLB/GLTF, framing, orbit/zoom/reset, read-only preview, material/camera/decal editor, save/load dan PNG/JPEG/WebM tersedia. modelSource/meshPath opsional menjaga kompatibilitas scene lama. Tidak membuat WebGL per thumbnail grid.
- AI Scene/Motion memakai provider registry, server tier/credits, durable SQL outbox dan BullMQ consumer terpisah. Pending dapat dibatalkan sebelum diklaim; processing provider tidak diklaim dapat dibatalkan. Hasil tidak pasti ditandai needsReview, tidak di-replay buta. History/status recovery tidak mengirim job baru.
- Admin Refine/Ant Design dengan adapter Axios/URLSearchParams native mendukung katalog 2D/3D terpisah, bundle, plans, credit packs, providers/cost, users, sessions/revoke dan audit. Subscription/credit ledger tersedia sebagai halaman read-only. Role server wajib; menyembunyikan menu bukan kontrol akses. Provider key tetap encrypted/masked.

Tema semantic monokrom + orange, Bricolage Grotesque/Manrope dan logo asli digunakan. Tema persist antar client/admin, reduced-motion dihormati. Bentuk/hierarki mengikuti keputusan referensi UjiHub, tanpa menyalin warna atau konten.

## Data, transaksi dan trust boundary

Auth menggunakan cookie httpOnly, secure production, session/role dari server, OAuth state/nonce/identitas terverifikasi dan redirect allowlist. Request origin/CORS, rate limiting, ownership project/media/lisensi dan signed private storage tetap berlaku.

QRIS ShopeePay memakai invoice pending dan kode unik Rp1–999 yang ditampilkan terpisah. Merchant/store/nominal/periode dan physical receipt identity diperiksa server; receipt transport HMAC berasal dari worker yang dipercaya. Browser tidak dapat menetapkan paid. Fulfillment/credits/subscription memakai transaksi/idempotency. Late/unmatched/duplicate/needsReview mengikuti [runbook QRIS](payments-qris.md). Histori provider lama tidak dikonversi ke QRIS. QRIS default disabled sampai konfigurasi operator lengkap.

Preview upload baru memakai media UUID stabil dan signed redirect segar hanya jika direferensikan aset published atau admin. File produk tetap private. URL signed lama di katalog/scene tidak dimigrasi massal.

Migration journal berisi 0000–0007. Migrasi aditif integrity/receipt/outbox/QRIS harus eksplisit sesudah backup, pemeriksaan schema dan rekonsiliasi legacy; tidak ada reset/drop/down-volume/seed production. Lihat [migrasi](migrations.md), [deployment](deployment.md), [workers](workers.md).

## Batas yang tetap ada

Belum ada halaman studio/services/works/contact atau inquiry/SMTP yang didukung domain/source; tidak dibuat klaim klien/testimonial fiktif. Belum ada dashboard receipt reconciliation atau tombol manual paid. UI mutasi subscription/ledger tidak ditambahkan, walaupun endpoint admin audited tersedia.

Pengujian memakai merchant/provider sintetis, local storage dan DB disposable. Google/R2/AI/merchant live, TLS/DNS production, browser fisik/Safari dan restore clone data production belum terbukti. SDK merchant alpha dan kapasitas nominal finite tetap risiko operasional. Deployment produksi tetap NO-GO sampai blocker dalam release checklist ditutup.
