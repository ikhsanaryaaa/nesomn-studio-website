# Keamanan dan integritas bisnis

## Summary

Fase 4 REVISION.md. Origin/branch/HEAD diverifikasi; perubahan fase 1-3 dipertahankan. Tidak ada commit/push/deploy atau akses DB/merchant production. Input hash dicatat phase-4-input.json.

## Audit source

Stub/missing provider fallback dan dev/pay belum dibatasi production; Stripe hanya memeriksa header ada. Paid/grant terpisah, subscription grant bisa diulang; ledger append tidak serialized pada resource user yang stabil. Enqueue sesudah debit/insert belum durable, processJob dapat menjalankan ulang terminal/processing job. Loader publik menerbitkan private URL; detail draft bocor. Session tidak memeriksa owner/expiry, cancel/expiry berbeda antar modul. Google OAuth belum diimplementasikan. Upload mengandalkan MIME browser; provider test endpoint menerima URL arbitrer. Retention dapat memilih user dari periode lama walau sudah renew.

## Safe implementation order

- [x] Pengaman pure RED/GREEN: production stub/fallback, Stripe raw signature, origin/IP, storage key/token, URL/upload validation.
- [x] Migration aditif + preflight legacy; shared per-user transaction lock, credit account/lots/expiry/refund dan settlement idempotency. Tidak mengedit migration lama atau mereset histori.
- [x] AI debit+job+outbox atomik, deterministic queue ID, worker claim/terminal replay/lease recovery/cancel yang aman.
- [x] Auth/session/Google state-PKCE-nonce/verified identity, entitlement/cancel/renew/retention konsisten; server ownership/private asset/media checks.
- [x] Boundary routes/admin/storage/provider serta production negative integration/concurrency/outage tests pada DB disposable.
- [x] Frozen/typecheck/lint/build/Docker/Compose acceptance, runbook legacy reconciliation, evidence dan review independen.

## Design decisions

Legacy payment checkout/callback yang kontraknya belum terverifikasi fail-closed; Stripe signature dapat diverifikasi untuk rekonsiliasi histori tetapi order legacy tidak otomatis di-grant ulang. Histori gateway/currency/status tidak diubah. Stub hanya test/development dengan explicit allow flag, tidak production. QRIS tetap fase 5.

Stable lock pada users row menserialisasi credit, sessions, jobs dan fulfillment. Metadata baru aditif diperlukan untuk idempotency, credit expiry dan durable dispatch. Legacy saldo tidak ditebak/di-reset: discrepancy dihentikan untuk rekonsiliasi; legacy credit yang tidak memiliki expiry tidak diberi expiry retroaktif. New monthly quota/top-up mengikuti periode/no-rollover; refund tidak memperpanjang expiry.

Provider yang tidak lengkap tidak menjadi stub. Production legacy AI adapter perlu explicit configuration/host allowlist; kontrak live belum terbukti dan tidak diklaim. Tidak melakukan transaksi/provider nyata. Outbound URL divalidasi dan koneksi dipin ke DNS publik yang sudah diperiksa, tanpa redirect otomatis.

## Files/folders

api/src/{middleware,lib,modules/auth,modules/session,modules/billing,modules/ai,modules/catalog,modules/store,modules/project,modules/admin,modules/storage,db/schema}, migration aditif0004-0006+journal, worker/src, tests/security, baseline/deployment fixtures yang perlu kontrak baru, scripts/test-security.mjs, docs/revision/phase-4-*, docs/security.md, deployment/workers/testing docs, .env.example/worker example, Compose/CI bila terkait trust/lifecycle. Tidak merombak UI/editor/scene format atau framework.

## Acceptance and limits

Negative production payment/provider/auth/role/origin/private download; concurrent grant/debit/refund/session/job; duplicate/replay; Redis gagal antara commit dan dispatch; expired/canceled/renewed entitlement; new credit expiry; retention dry-run aman. Migration diuji pada clone disposable dengan legacy fixture dan preflight, tidak otomatis dijalankan pada boot/production. Google/Stripe/URL cryptographic contracts diuji offline; live credentials, managed endpoints, merchant dan UI redesign tetap di luar scope fase ini.


Selesai dalam acceptance lokal; lihat phase-4-report.md, phase-4-evidence.json dan phase-4-review.md. Live vendor/merchant/schema production tidak diuji dan bukan PASS.
