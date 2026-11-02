# QRIS ShopeePay — as-built phase 5

Adapter tersedia, **disabled secara default dan belum diverifikasi dengan merchant/wallet nyata**. Jangan mengaktifkan dari deskripsi SDK saja. UI baru monokrom/orange tetap fase6. Main Compose tetap tepat `app` dan `gateway`; consumer berikut memiliki lifecycle sendiri.

## Kontrak yang benar-benar diaudit

SDK pengguna [qris-merchant-id](https://github.com/ikhsanaryaaa/qris-merchant-id/tree/e1b1b6968c570c0cb18ccf9ce4d95694e8df48de), commit `e1b1b6968c570c0cb18ccf9ce4d95694e8df48de`, package0.2.0 alpha, MIT. Source vendored dan hashes tercatat di `integrations/qris/vendor-manifest.json`. Wrapper tidak menggunakan worker upstream yang menandai receipt seen sebelum ACK atau watcher seed yang membuang histori.

`ShopeePayPartner(token='B:...')`, `stores.list_stores()` dan `transactions.list_recent(store_id, merchant_id=..., start_time=..., end_time=..., max_pages=100)` adalah API Python SDK, bukan endpoint Nesomn/HTTP publik. Normalizer menyediakan id, amount_idr (rupiah utuh), create_time (epoch seconds), merchant_id, store_id, status dan completed. Wrapper hanya mengirim scoped `status=3`, `completed=true`. SDK membatasi service type1/3; arti incoming/status/provider retention di akun nyata masih memerlukan verifikasi operator. SDK sendiri belum memberi bukti live production.

Tidak ada API pembuatan Shopee QR atau signed invoice webhook yang dapat dipakai dari SDK ini. App membuat amount-specific QR dari **static QR merchant milik operator**, validasi TLV/CRC16/version/currency360/countryID/merchant account/name/city, menolak convenience fees dan menulis amount serta point-of-initiation12. CRC dan template SHA256 hanya integritas konfigurasi, bukan bukti kriptografis bahwa QR milik merchant/store portal yang dikonfigurasi. Operator wajib mencocokkan identitas pada portal dan aplikasi pemindai sebelum cutover yang disetujui. Tidak ada transaksi nyata dilakukan dalam fase ini.

## Alur dan batas kepercayaan

Authenticated `POST /api/billing/checkout` atau `/api/store/checkout` memerlukan `Idempotency-Key`. Server mengambil harga plan/creditpack/asset/bundle, snapshot benefit dan diskon; mengabaikan paid/harga dari browser. Kunci sama+payload sama mengembalikan invoice sama, payload berbeda409. Invoice awal pending, berlaku15menit. Kode1–999 ditambahkan setelah diskon dan **tidak membeli credits tambahan**. Checkout menampilkan subtotal, diskon, kode unik dan nominal final sebelum tombol menampilkan QR. Status berasal dari server; tidak ada tombol simulasi success.

Nominal payable direservasi permanen dalam merchant+store, termasuk invoice expired dan data pengguna yang dihapus. Tidak ada cascading FK pada tombstone. Ini mencegah pembayaran lama nominal sama melunasi invoice baru tanpa provider invoice reference yang dapat dipercaya. **Batas: paling banyak999 invoice per base price sepanjang histori; harga berdekatan dapat berbenturan dan mengurangi kapasitas lebih jauh.** Exhaustion503, bukan reuse diam-diam. Ini batas operasional besar; traffic berkelanjutan memerlukan kontrak invoice provider yang terverifikasi atau kebijakan baru yang ditinjau, bukan menghapus tombstone.

Worker dinyatakan tepercaya untuk mengamati feed. HMAC key terpisah32+ karakter hanya pada app dan worker QRIS. Kebocoran key/kompromi worker dapat memalsukan receipt; ini bukan provider signature end-to-end. HTTPS/private network, secret mount, pembatasan akses endpoint di ingress bila sesuai, clock sync dan audit host diperlukan. AI worker/frontend tidak menerima token Shopee atau key ini.

`POST /api/billing/qris/receipts` menerima raw JSON maksimal16KiB, header `x-qris-timestamp` epoch detik (±300s) dan `x-qris-signature` lowercase hex HMAC-SHA256 atas `nesomn-qris-v1\n<timestamp>\n<raw-body>`. Schema strict: reference, merchantId, storeId, amountIdr integer, createdAt epoch detik, status3, completedtrue. Worker menandatangani ulang saat retry; reference/fingerprint tersimpan untuk anti-replay permanen. Endpoint tidak mempercayai session/browser atau status order yang dikirim client.

Receipt tersimpan sebelum settlement. Merchant/store/amount exact; paidAt harus berada dalam createdAt..expiresAt invoice. Receipt dibayar tepat waktu tetapi dikirim terlambat dapat settle. Pembayaran benar-benar terlambat, kedua receipt pada invoice paid, atau konflik benefit/subscription masuk review_required tanpa grant; unknown amount unmatched. Per-user/order locks dan savepoint menjaga paid+payment receipt+fulfillment atomic. Retry receipt sama tidak menggandakan manfaat; fingerprint berubah409. Gangguan DB/transient tetap retryable, bukan di-ACK sebagai sukses. User hanya dapat membaca invoice/QR miliknya; QR pending saja, response no-store.

## Persiapan app dan migrasi

1. Ikuti [deployment](deployment.md) dan [security/preflight](security.md): identifikasi DB/schema/jurnal existing, drain financial writers/AI, backup PostgreSQL dan storage serta uji restore pada clone. Jangan push/reset/seed. Review SQL0000–0007 dan jurnal; tujuh SQL terdahulu dipertahankan byte-identik oleh fase5.
2. Review `api/drizzle/0007_qris_invoices.sql`: menambah qris_invoices/qris_receipts/qris_reservations dan constraints, tidak merelabel histori provider. Terapkan di clone dahulu. Jalankan command explicit berikut **hanya pada target yang diotorisasi setelah backup/preflight**:

```bash
docker compose --env-file .env.production run --rm --no-deps --workdir /app/api app bun --no-env-file --no-install src/db/migrate.ts
```

3. Default `QRIS_ENABLED=false` membuat checkout/ingestion QRIS fail closed. Untuk aktivasi terencana, isi server env QRIS*ENABLED=true, QRIS_MERCHANT_ID, QRIS_STORE_ID (angka sebagai string), QRIS_STATIC_PAYLOAD (payload QR yang sebenarnya), QRIS_EXPECTED_NAME (tag59 persis), QRIS_TEMPLATE_SHA256 (SHA256 UTF8 payload), QRIS_RECEIPT_SECRET. Gunakan secret manager; jangan VITE*\*/Git/image/log. App memvalidasi config saat startup tanpa mencetak nilainya. Readiness memerlukan schema0007 walau QRIS disabled.
4. GET `/health/live`, `/health/ready`; URL user `/checkout?order=<UUID>`, API owner `/api/billing/orders/<UUID>` dan `/qr`. TLS diterminasi reverse proxy di depan gateway8080; app3000 tetap private. Network eksternal/DB/Redis/storage mengikuti deployment.md.

## Worker independen (contoh Linux Docker host)

Gunakan `integrations/qris/worker.env.example` sebagai template BARU `/secure/nesomn/qris.env`; jangan overwrite env existing. Isi ids yang sama, URL HTTPS `https://YOUR_HOST/api/billing/qris/receipts`, secret/token file paths, state `/data/receipts.sqlite`, QRIS_BACKFILL_START berupa UTC epoch sebelum invoice pertama, dalam30hari terakhir. Jangan menyalin epoch contoh lama secara membabi buta.

```bash
docker build -t nesomn-qris-worker:release integrations/qris
docker network inspect nesomn-data-network
docker volume create nesomn-qris-state
```

Periksa volume di atas memang baru/milik worker ini. Provision directory milik UID10001 hanya pada volume baru, mount secret read-only `/secure/nesomn/qris-secrets:/run/secrets:ro`. Buat `shopee-token` berisi session `B:...` milik operator dan `receipt-key` sama dengan QRIS_RECEIPT_SECRET. Beri ownership UID10001, mode0600, directory0700 pada **path baru yang diperiksa**, tidak chown volume/data existing secara rekursif. Docker Desktop bind Windows mungkin tidak merepresentasikan mode0600; worker sengaja menolak permission longgar. Gunakan Linux host/secret provisioning yang mendukungnya, bukan menonaktifkan pemeriksaan.

```bash
docker run --rm --user 0 --network none --mount source=nesomn-qris-state,target=/data --entrypoint sh nesomn-qris-worker:release -c 'chown 10001:10001 /data && chmod 700 /data'
docker run -d --name nesomn-qris-worker --restart unless-stopped --init --network nesomn-data-network --env-file /secure/nesomn/qris.env --mount source=nesomn-qris-state,target=/data --mount type=bind,src=/secure/nesomn/qris-secrets,dst=/run/secrets,readonly --read-only --tmpfs /tmp:rw,noexec,nosuid,size=16m --cap-drop ALL --security-opt no-new-privileges:true --stop-timeout 300 nesomn-qris-worker:release
docker inspect nesomn-qris-worker --format '{{json .State.Health}}'
docker logs --tail 30 nesomn-qris-worker
```

Tidak ada published port, tidak menambah service/profiles/override Compose utama. HTTPS dapat melewati ingress; private Docker HTTP hanya pilihan eksplisit `QRIS_ALLOW_PRIVATE_HTTP=true` dan URL app3000 yang telah diverifikasi. Jangan mengekspos port app untuk worker. Image Python3.13-slim digest terpin, UID10001, deps exact; token dibaca ulang setiap cycle. Renewal session dilakukan operator lewat alur resmi yang diotorisasi, update file privat, tidak ada login/OTP/token extraction otomatis. Restart policy tidak otomatis restart karena status unhealthy; monitoring operator diperlukan.

## Recovery, rekonsiliasi, cutover dan rollback

- SQLite WAL synchronousFULL menyimpan body sanitized, attempts, delivered, scope dan checkpoint. Backup dengan SQLite online backup atau stop/drain lalu backup seluruh state konsisten; jangan copy hanya mainfile ketika WAL aktif. Jangan menghapus state untuk memperbaiki retry. SIGTERM menutup DB; deadline drain300s.
- Delivery berjalan sebelum/sesudah polling, terpisah dari kegagalan provider/token; event baru ditandai delivered hanya setelah HTTP200+JSONok. ACK hilang setelah commit dikirim ulang aman. Satu poison event tidak memblokir lainnya; attempts/age memberi fairness. App outage menyimpan pending untuk cycle berikutnya.
- Polling overlap120detik, slice1jam dan split saat truncated sampai1detik; saturated feed fail dan memerlukan investigasi, bukan drop. Unresolved status dipantau terpisah round-robin20; lebih30hari masuk unresolved_review, tidak diasumsikan paid. Initial backlog lebih30hari ditolak untuk rekonsiliasi operator; batas ini bukan klaim retensi provider. Invalid scoped row/changed event menghentikan pull dengan error generik untuk investigasi, sementara spool lama tetap dikirim.
- Tinjau SQLite `events WHERE delivered=0`, attempts, checkpoint `meta`, `unresolved` dan `unresolved_review`. Jangan log/copy token atau raw portal response. Error generik sengaja redacted. Cadangkan sebelum perbaikan manual. Jangan majukan cursor/hapus event tanpa bukti feed dan rekonsiliasi.
- SQL read-only berikut membantu investigator; jalankan pada koneksi operator yang benar. Tidak tersedia auto-refund, manual grant/refund API atau panel rekonsiliasi admin baru pada fase5. Jangan memakai dev/pay atau mengubah paid langsung untuk repair. Cocokkan feed/portal, invoice, ledger dan entitlements, putuskan refund/manual resolution melalui prosedur bisnis yang diotorisasi; alat admin berikutnya perlu scope/test tersendiri.

```sql
SELECT merchant_id, store_id, reference, amount_idr, paid_at, outcome, order_id FROM qris_receipts WHERE outcome <> 'applied' ORDER BY created_at;
SELECT order_id, base_idr, code, payable_idr, status, created_at, expires_at FROM qris_invoices ORDER BY created_at DESC;
SELECT merchant_id, store_id, count(*) AS reserved_amounts FROM qris_reservations GROUP BY 1,2;
```

- Saat cutover: hentikan checkout lama; inventaris pending/paid Stripe/Pakasir tanpa mengubah gatewayRef/history. Legacy endpoints tetap fail closed dan perlu rekonsiliasi terpisah. Mulai worker dengan backfill sebelum invoice pertama, verifikasi scope/identity/config/health, baru izinkan checkout baru. Jangan menambahkan data demo sebagai produk asli.
- Untuk menghentikan **invoice baru sambil menghabiskan pending receipt**, blok POST checkout di ingress/maintenance; biarkan endpoint receipt worker dan status read tetap hidup sampai seluruh pending/review terinventaris. `QRIS_ENABLED=false` menghentikan checkout **dan ingestion**, jadi jangan menggunakannya sebagai drain switch. Jika dinonaktifkan darurat, hentikan invoice baru, simpan DB/spool dan inventaris pembayaran terlambat untuk recovery. Jangan rollback/drop0007 atau menghapus reservation; schema aditif tetap ada. Tidak ada live cutover dilakukan.

## Pengujian tanpa merchant

Ikuti fixed disposable DB/Redis dan fixture pada [testing-phase4](testing-phase4.md), migrasikan sampai0007. Runtime PATH harus menunjuk Bun1.4.4, bukan Bun global1.4.0 di mesin audit. Runner menolak env integration tanpa opt-in, membuang credential parent dan tidak membaca .env.

```bash
node scripts/test-qris.mjs unit
NESOMN_DISPOSABLE_TESTS=1 node scripts/test-qris.mjs integration
docker build -t nesomn-qris-worker:test integrations/qris
docker run --rm --network none nesomn-qris-worker:test python -m unittest -v test_worker
```

Browser/worker HTTP harness `tests/qris/http-browser.mjs` hanya untuk lab khusus port18085, merchant sintetis99100005, DB fixed55432, container/network bernama phase5, Chrome headless profil baru dan env opt-in. Jangan arahkan ke deployment nyata. Ia memakai SDK normalizer offline + SQLite container ke app lab dengan ACK loss/restart, bukan memanggil Shopee. Artifacts dan batas bukti ada pada [laporan fase5](revision/phase-5-report.md). Live wallet scanning/merchant classification/TLS ingress/session renewal, CI remote dan deployment production masih **SKIPPED**.
