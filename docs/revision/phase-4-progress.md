# Execution ledger: REVISION.md, fase 4

31 Oktober 2026. Branch works/runtime-tooling-upgrade, HEAD041d225fca07ae405b440ca424a0c56f90fdac0f, origin nesomn-studio-website benar. Tidak checkout/reset/commit; semua pekerjaan fase1-3 dipertahankan. Tidak ada AGENTS.md pada repository/parent yang diperiksa sebelumnya. Source dan test adalah kebenaran; graph historis hanya navigasi.

## Rulings

1. Kerjakan phase4 inline sesuai executing-plans dengan TDD dan satu independent final review. Detail implementation diturunkan dari source; tidak meminta approval untuk perbaikan rutin yang sudah diotorisasi.
2. Fail-closed legacy Pakasir dan checkout Stripe sampai cutover; signature Stripe diverifikasi benar untuk menerima metadata rekonsiliasi. Order/history lama tidak ditulis ulang, tidak auto replay fulfillment lama. Biaya: live checkout belum tersedia sampai fase5; keamanan lebih penting daripada simulator production palsu.
3. Per-user lock users row wajib pada seluruh append credit/settlement/job/session. Metadata baru aditif (accounts/lots/allocations/receipts/outbox/OAuth states/lease) adalah kebutuhan integrity, bukan migrasi framework/model scene. Constraint yang bentrok legacy harus abort/preflight, bukan auto dedup/delete.
4. Legacy ledger discrepancy butuh review, tanpa koreksi otomatis. Legacy credit tanpa metadata expiry tidak dihanguskan retroaktif. Credit baru per periode/monthly-no-rollover; refund hanya mengembalikan alokasi yang belum expired.
5. Canceled subscription tetap memberi hak sampai period end; semua selector memakai aturan efektif yang sama. Renewal idempotent; plan change overlapping yang belum memiliki kebijakan proration tidak dibebankan otomatis. Retention default dry-run, tidak menghapus karya lewat boot/scheduler otomatis.
6. AI creation atomik dengan outbox dan deterministic queue ID. Worker terminal replay tidak memanggil provider; interrupted ambiguous production call tidak disubmit ulang otomatis. Credit/refund tetap exactly-once sebagai efek DB, bukan klaim exactly-once eksternal vendor.
7. OAuth state single-use, PKCE/nonce dan signed ID-token identity; jangan auto-link akun password hanya karena email sama. Tidak memanggil Google live/merchant selama test.

## Shared interfaces/preflight

Settlement dan jobs harus memakai credit transaction yang sama; account baseline legacy harus cocok sebelum operasi baru. Quota expiry memakai effective subscription; sessions/asset gates/retention menggunakan predicate periode yang sama. Outbox recovery tidak boleh mengulang provider job yang sudah processing/done. Catalog public preview tidak boleh berubah menjadi private original. Migration lama tetap identik; schema snapshot lama drift sehingga migration baru ditulis/review eksplisit.

## Progress

Audit route/schema/callers dan PRD credit expiry selesai; mulai pure regression RED. Implementasi dan seluruh checks berikutnya belum selesai.

### Implementasi dan bukti sementara

- Pure guards RED -> GREEN 5 tes/36 assertions; finance RED missing module/export -> GREEN 5 tes/20 assertions, termasuk 40 grants/30 debits/12 refunds paralel.
- Settlement RED -> GREEN 2 tes; durable receipt + paid/grant/marker satu tx, legacy_review tidak menulis ulang order.
- Jobs RED -> GREEN 2 tes; SQL outbox + claim/lease + cancellation + stale recovery, refund tidak mengulang.
- Boundaries RED (draft200/canceledfalse) -> GREEN 3 tes: owner/expiry/DB role/session concurrency, private loader, canceled renewal.
- Validation RED -> GREEN 2 tes; explicit HTTPS hosts + public DNS pinning, byte upload checks dan active SVG ditolak. OAuth RED -> GREEN 2 tes; offline RSA signature/aud/iss/nonce dan cookie-bound single use state.
- Security suite sementara 21 pass/121 assertions. Typecheck lima workspace pass. Baseline pertama 21 pass/3 fail karena kontrak baru202 dan fixture worker legacy tanpa reservation; fixture diperbaiki memakai createAiJob nyata, bukan melonggarkan guard.
- Belum final: semua suite ulang, upgrade/preflight fixture, actual queue/gateway/Docker, dokumentasi dan final review.

Ruling: manual admin subscription tetap tidak auto-grant credits; snapshot quota0, editor/session entitlement berlaku sesuai periode. Biaya: admin harus memberi adjustment terpisah bila memang diotorisasi, menghindari hadiah berulang akibat status toggle.
Ruling: metadata/URL validation hanya diterapkan pada input baru; tidak menulis ulang key/URL legacy. URL original HTTP legacy yang tidak aman ditolak saat signed loading dan perlu inventory/reupload, bukan bypass public fallback.
Ruling: upload boundary memeriksa format/containment dan raster decode; validasi glTF accessor/render lengkap tetap fase8. SVG aktif ditolak hingga sanitizer yang teruji tersedia. Format dokumen scene tetap identik.
Ruling: tidak menghapus scratch/commit otomatis karena seluruh fase1-4 belum commit; evidence disimpan di docs dan log lokal .cache. Review baru membatasi diff phase4 berdasarkan input hashes agar perubahan fase sebelumnya tidak disalahatribusi.

### Acceptance sementara dan keputusan tambahan

- Actual BullMQ consumer (Redis disposable) pass: sukses/gagal/refund/terminal redelivery; baseline24 kembali green setelah fixture memakai reservasi API sebenarnya.
- Upgrade fixture dua database disposable pass: histori order/ledger identik, legacy_review, rerun no-op; case-insensitive duplicate menghentikan migration tanpa menghapus user. Tidak ada DROP/reset database; database fixture hilang saat lab tmpfs dihentikan.
- Tambahan migration0005 untuk receipt identity: RED membuktikan satu gatewayRef bisa dipakai dua order; GREEN4 settlement tests setelah UNIQUE(provider,gateway_ref), termasuk rollback fulfillment sambil receipt tetapdurable. Empat migration baseline tidak diubah.
- Frozen641 installs/no changes, typecheck5, lint0errors/2existingwarnings, build production client/admin,22unit/scene pass. Security run sebelum tambahan receipt:26pass140assertions. Final suite masih akan diulang.
- Production Docker app/worker build pass. Actual gateway5tests pass: API404/deep links, secure/httpOnly cookie, role/proxy, upload raster/Sharp/download/token, cross-site403, prodstub503, raw HMAC Stripe legacy202review + order tetap pending.
- Outbound HTTPS probe pada Bun Windows pertama RED: ERR_INVALID_IP_ADDRESS karena autoSelectFamily meminta lookup(all:true). Perbaikan autoSelectFamily:false + prefer publicIPv4 -> GREEN example.com HTTP200/577bytes, tanpa kredensial. Tambahkan opt-in regression network, tidak mengganti verifikasi vendor live.

Ruling: dua migration aditif (0004 core integrity,0005 physical receipt uniqueness) menjaga migration yang sudah diuji tidak diubah setelah diterapkan di lab. Tidak ada migrasi startup; lakukan backup/preflight/upgrade eksplisit.
Ruling: renewal paid atas manfaat legacy/manual atau benefit yang berubah ditahan untuk rekonsiliasi; jangan menebak proration/pergantian quota. Renewal baru identik memakai kalender UTC anchor asli, bukan 30/365 hari atau drift Februari.
Ruling: gateway acceptance phase3 script diselaraskan dengan kontrak aman (prod menolak stub, uploadbin arbitrary ditolak). Bukti phase3 historis tetap, klaim stubproduction lama sudah superseded. Queue/drain test baru dilakukan explicit testmode, bukan production bypass.

### Final review: findings and one fix pass

Fresh reviewer phase4_final_review (gpt-6-astra, read-only) found0Critical,4Important,2Minor. Regrade by effect: stale receipt outcome is Important for trustworthy financial recovery inventory; OAuth accepted return route404 is Important for usable authentication callback. Fix all6 in the same pass; no minor deferred. Declined live vendor/production readiness remains explicitly unproven, not waived.

RED suite:12pass/6fail reproducing failed Redis queue ID, pending->canceled overlap, accepted-then-timeout missing review marker, stale-history cancel, alternate payment event outcome and OAuth route mismatch. GREEN after fixes:36pass179assertions across11files.

Additional real Redis outage RED: Queue.client waited for first Redis connection inside SQL outbox tx, attempts remained0; worker SIGTERM exceeded30s and Docker killed it. This was not a PASS. Fix in same pass: producer uses a single observed ready client and fails fast before any queue operation; worker drains its actual processor promises and can force-close disconnected Redis transport after DB processing settles. Actual Docker outage/restart test will re-run against rebuilt image.

- Final fixed queue retry: native BullMQ retry only after DB stillpending; terminal SQL guard still authoritative. Regression failed-before-claim then redispatch RED->GREEN.
- Final fixed effective transitions: active AND canceled admin transitions reject overlap; user cancel uses effective current period under user lock, leaving expired history untouched. Both regressions RED->GREEN.
- Final fixed ambiguous provider outcome: needsReview true, accepted providerRef persisted via callback and additive0006, never expose credentials or resubmit ambiguous call automatically. Confirmed sample rejection remains not ambiguous. Regression RED->GREEN.
- Final fixed receipt outcome: alternate verified event IDs now applied durably when physical receipt already fulfilled. Regression RED->GREEN.
- Final fixed OAuth allowlist: actual client/production routes only. Regression RED->GREEN; live Google exchange still not tested.

Ruling:0006 adds only accepted remote execution identity to support reconciliation; no scene/domain rewrite. Baseline migrations stay unchanged; production operator must apply0004-0006 explicitly after backup/preflight.
Ruling: review Minor5/6 regraded Important due misleading financial recovery inventory and successful-login404 respectively. Both fixed with RED->GREEN in the single authorized fix pass, rather than left as cosmetic debt.
Ruling: reviewers decline live/prod validation because no real credentials/authorization/environment supplied. Offline contracts and disposable acceptance are the release evidence for this phase; live tests remain pending, without a production-ready claim.

### Final fix-pass boundary check

Self-check of the existing Free Basic seed exposed that any effective subscription was treated as Pro for AI. RED test proved a Free Basic row could access Pro provider; GREEN after using the existing proTemplates capability consistently for model listing/creation/priority. No new tier/model was invented. Invalid remote identifier numeric coercion also RED->GREEN; only bounded string references can be persisted.

Ruling: Pro AI follows the existing Pro capability (proTemplates), not mere presence of a subscription row. This matches the authored Free Basic/paid seed permissions. Cost: custom plans with this flag disabled stay Free for AI; operators must deliberately configure permissions rather than receive implicit Pro escalation.

Actual Docker outage GREEN after fix: SQL pending/debit retained, readiness503, disconnected worker SIGTERM exit0, Redis recovery + worker restart -> done with original balance90. Production worker startup/health/stop exit0 verified separately. Bun HTTPS public probe example.com passed both Windows and actual Linux app image HTTP200/577bytes; no vendor/merchant credentials used.

### Completion contract

Fase4 complete (local/disposable scope). Final fresh checks all exit0: frozen641/779nochanges, typecheck5, lint0errors2existingwarnings, productionbuildclient/admin+3prerender, security9pure64assertions+29integration122assertions=38/186, baseline24integration65assertions+22unit47assertions, Node11, deployment13/93. Exact main Compose app/gateway verified again. Docker final app/worker build pass; gateway5, worker active drain1, real Redis outage+offline shutdown/restart1, storage persistence1, actual Linuxbootstrap1 pass. Preflight0conflicts/activejobs, disposable schema25tables/7migrations. Original4SQLhashes unchanged and lockSHA95afff... unchanged.

Tujuh layanan lab final exited0; no volume/network deleted. Historical before-review worker exited137 remains preserved as the reproduced failure, not counted as final success. Final evidence/checks/hash/images and artifacts saved; no production access, merchant transaction, commit/push/merge/deploy. Live vendor/merchant/Google/TLS/R2 and real production schema remain unproven; no production-ready claim. Fase5-10 pending. Phase3 screenshots historical; phase4 backend evidence JSON only.

Final review gate: PASS after the single fix pass and full suite; reviewer did not re-review fixes. No deferred minors. Every declined live/prod item remains a declared release limitation, not a waived requirement. Scratch retained because all phases are uncommitted; do not delete prior-phase/user changes.
