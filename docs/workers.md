# Worker di luar Compose utama

Main Compose hanya app + gateway. Menjalankan `docker compose up/stop` tidak memulai atau menghentikan consumer AI maupun QRIS. DB/Redis/storage dan credential masing-masing memiliki lifecycle operator terpisah.

## AI worker yang tersedia

Worker Bun/BullMQ existing dipertahankan pada workspace worker/, queue **ai-jobs**, concurrency **2**, priority1/2 dan attempts1 dipertahankan; failed entry hanya di-retry saat DB masih pending. Producer fail-fast memakai ready client eksplisit, maxRetriesPerRequest=1 dan offline queue off; initial Queue.client tidak ditunggu di dalam transaksi outbox; consumer memakai maxRetriesPerRequest=null/reconnect. Username/password Redis, DB index dan TLS dihormati keduanya. Gunakan URL Redis identik pada producer/consumer; prefix Redis keyPrefix tidak ditambahkan.

Build dari root Dockerfile:

```bash
docker build --target worker -t nesomn-ai-worker:release .
```

Salin deploy/worker.env.example ke `.env.worker` baru, di luar Git. Isi DATABASE_URL, REDIS_URL, NODE_ENV=production dan **ENCRYPTION_KEY yang sama dengan existing app**. Worker saat ini mengambil provider terenkripsi dari ai_providers dan mengembalikan result URL; ia tidak membutuhkan JWT/OAuth/payment/SMTP/R2 credential. KIE_AI_API_KEY env bukan pengganti baris provider yang dikonfigurasi dalam DB.

Jalankan terpisah setelah schema/network siap:

```bash
docker run -d --name nesomn-ai-worker \
  --network nesomn-data-network --env-file .env.worker \
  --restart unless-stopped --init --stop-timeout 300 \
  --read-only --tmpfs /tmp:rw,noexec,nosuid,size=64m \
  --cap-drop ALL --security-opt no-new-privileges:true \
  nesomn-ai-worker:release
```

Contoh memakai shell POSIX; pada PowerShell jalankan satu baris atau gunakan backtick line continuation. Image sudah USER bun (UID1000), tidak membuka port. Jangan memasukkan command ini sebagai service/profile/override pada Compose utama. Jika worker kelak menyimpan output lokal, mount storage eksternal yang sama secara eksplisit; implementasi sekarang tidak mengunduh/menyimpan provider result ke local storage.

```bash
docker inspect nesomn-ai-worker --format '{{.State.Status}} {{.State.Health.Status}}'
docker exec nesomn-ai-worker bun --no-env-file --no-install api/src/healthcheck.ts worker
docker logs --tail 50 nesomn-ai-worker
docker stop --timeout 300 nesomn-ai-worker
```

Heartbeat /tmp diperbarui tiap 5s; healthcheck menuntut consumer running, Redis ready dan heartbeat berumur <=30s. Health ini bukan bukti setiap job/provider/DB berfungsi; pantau juga backlog, umur job, failure/refund dan app readiness. Redis outage membuat consumer reconnect, producer fail-fast dan outbox tetap pending; pada acceptance ia kembali mengonsumsi tanpa restart. Startup env invalid fail-closed.

SIGTERM/SIGINT menghentikan heartbeat/maintenance, menunggu processor aktif menyelesaikan efek DB, menutup transport Redis secara paksa jika disconnected, lalu menutup queue/DB. Docker memberi 300s; pilih grace sesuai durasi provider nyata. Acceptance mengamati sample job berstatus processing sebelum SIGTERM, kemudian done, log draining -> job selesai -> stopped dan exit0. Ini belum membuktikan drain provider live berdurasi panjang. Jika grace habis/hard kill, BullMQ dapat memproses stalled job kembali. **Fase4 menambahkan transaksi per-user, credit lots/allocations, durable SQL outbox, deterministic jobId, claim/lease dan terminal/refund guards**. Lihat [security as-built](security.md). Jangan replay job processing/unconfirmed ke provider: review providerRef/needsReview dan status vendor dahulu.

## Recovery dan pembaruan

1. Periksa readiness app, network/DNS/certificate, Redis auth/index dan persistence/noeviction sebelum restart/replay. Jangan log credential atau URL bertoken.
2. Redis pulih: biarkan koneksi reconnect dan periksa health/backlog. Database pending/processing dan queue harus dibandingkan; SQL outbox menyimpan dispatch pending; retry sesudah Redis pulih dan pindahkan failed Redis entry kembali ke waiting hanya saat SQL pending. Pending timeout30menit, processing lease5menit; lihat security.md.
3. Update worker: drain/stop consumer lama, simpan image tag/digest sebelumnya, lalu buat container baru dengan env/network yang sama. Jangan menghapus DB, Redis keys, volume atau melakukan seed untuk memperbaiki deployment.
4. Periksa job gagal, debit/refund dan provider timeout per job. Durable outbox, recovery pending, retry/refund concurrency dan fulfillment sudah diuji pada phase4/9/10. Provider yang hasil submit-nya belum terkonfirmasi masuk rekonsiliasi, bukan blind replay. Lihat release-readiness.md untuk batas live.

Layanan host/systemd/container orchestrator lain boleh memakai image/entry yang sama, tetapi harus menyediakan env privat, restart-on-process-exit, SIGTERM grace, monitoring heartbeat/backlog dan network yang benar. Health unhealthy sendiri tidak menyebabkan Docker restart otomatis.

## Worker QRIS: implementasi fase5

Adapter/image executable tersedia pada integrations/qris, default disabled. Lihat [runbook QRIS](payments-qris.md) untuk Docker build/run independen, merchant/store/staticQR verification, secret files, SQLite durable delivery/backfill, session renewal, health, rekonsiliasi dan rollback. Jangan menambah service/override/profile pada Compose utama. Worker upstream tidak dipakai; wrapper memakai SDK terpin dan HMAC mandatory. Tidak ada live merchant/payment yang diuji; status SDK alpha memerlukan verifikasi operator.

## Current phase5 payment contract

Adapter QRIS ShopeePay tersedia, default disabled; schema0007 wajib dimigrasikan eksplisit sesudah backup/preflight, termasuk bila QRIS belum aktif. Ikuti [payments-qris.md](payments-qris.md) untuk konfigurasi static QR/merchant/store, key transport terpisah, worker Docker independen, session renewal, durable SQLite spool, cutover dan rekonsiliasi. Tidak ada token/live transaksi yang diuji. SDK alpha tidak menjamin live feed. Jangan rollback/drop schema atau reuse nominal; kapasitas finite999 per base price sepanjang histori. Main Compose tetap app/gateway dan TLS di reverse proxy depan gateway8080; app3000 private. Bagian fase3/4 di atas adalah riwayat, bukan indikasi adapter masih belum ada.

## Deployment per container pada Litepod

Lihat [runbook Litepod](litepod.md). Dockerfile worker standalone ada di deploy/litepod/worker.Dockerfile (context root), dengan WORKER_HEALTH_PORT=3001 untuk listener health privat. QRIS memakai deploy/litepod/qris.Dockerfile dan QRIS_HEALTH_PORT=3002. Listener opsional; healthcheck image/heartbeat existing tetap berlaku. Jangan pasang domain publik worker. Periksa grace stop platform; versi Litepod yang diperiksa memberi 30s, sehingga lakukan drain terencana untuk worker yang memerlukan 300s.
