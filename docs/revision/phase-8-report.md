# Phase8 — viewer3D, editor dan empat GLB

31 Oktober2026. Repository https://github.com/ikhsanaryaaa/nesomn-studio-website, branch works/runtime-tooling-upgrade, HEAD041d225fca07ae405b440ca424a0c56f90fdac0f. Acceptance lokal selesai; fase1–8 masih uncommitted. Tidak mengubah remote/checkout/reset, push/merge/deploy, credentials atau DB production.

## Implementasi

Preview read-only lazy memakai renderer Three/R3F/Drei existing dan tidak menyentuh store project. Production route **/demo/3d** berlabel Demo/Sample memuat4model orisinal, bukan barang jualan/karya klien. Detail katalog3D hanya memuat viewer setelah tindakan user dan signedURL dari endpoint license/plan existing. Thumbnail grid tetap gambar.

Shared loader memiliki abort/timeout25s, stream cap25MB, validation URL/version/resource/buffer/accessor/vertex budget2juta, progress/poster/error/Retry/noWebGL. Mendukung embedded staticGLB/GLTF2.0; external buffers/images dan Draco/Meshopt/KTX2 ditolak jelas. Tidak ada decoder/viewer/CDN environment baru. PMREM studio dibuat lokal dengan RoomEnvironment, ACES/sRGB, lighting/shadows. Bounding-box sphere frame memakai FOV/aspect, target center, near/far dan zoom limits tanpa mengubah authored scene coordinates. Orbit mouse/touch, ResetView/Zoom±/AutoRotateOff default/backdrop/Fullscreen, DPR1–1.5 dan demand-render. Reduced-motion berubah secara reaktif, kontrol preview44px dan gesture hints.

Editor memperbaiki stale signedURL reset/load, identitas katalog yang tidak tersimpan dan decal yang diparent ke group. modelKey menyimpan slug dan signedURL diambil ulang; optional modelSource=catalog membedakan slug mug dari builtin lama. Optional decal.meshPath memilih mesh; legacy default largest mesh. Properties/selection position/rotation/scale mempertahankan lokal-coordinate/projection DreiDecal, sourceUV tidak ditulis ulang. Tidak mengklaim UV-atlas editor baru. GLTF load terpisah memiliki geometry/material sendiri, bukan shallow clone cache yang saling termutasi. Resource ownership meliputi model/texture/PMREM/listener/FileReader/recording cleanup.

PNG/JPEG max1080 dan error canvas eksplisit. Video memakai copy canvas max1080, requestFrame, AbortSignal, stoptracks/cancelRAF/remove-copy/revokeURL. Encoder pertama kadang menghasilkan header tanpa frame; hasil kosong ditolak, lalu satu retry stream baru. Tidak mengunduh success palsu. Final fresh-run WebM27308bytes berhasil decode854×944readyState4. Browser download directory unik mencegah memakai artifact lama.

## Model dan file

client/public/demo/models/:

- nesomn-abstract-form.glb:24244bytes,3meshes.
- nesomn-product-box.glb:7180bytes,4meshes.
- nesomn-lowpoly-room.glb:17248bytes,10meshes.
- nesomn-typography-block.glb:7076bytes,4meshes.

Setiap model memiliki SVG poster dari proyeksi geometry yang sama; manifest.json mencatat URL/bytes/Demo label. node scripts/generate-demo-models.mjs reproducible:8hash GLB/poster identik sesudah rerun. node scripts/validate-demo-models.mjs memeriksa glTF2.0/header/chunks/alignment/index/accessor/buffer bounds/finite extrema/mesh/material/resources. Official [Khronos validator](https://github.com/KhronosGroup/glTF-Validator), npm gltf-validator2.0.0-dev.3.10 dari registry resmi, juga dijalankan: masing-masing0error0warning. Validator hanya test tooling di cache, bukan runtime dependency/prerelease Bun/Elysia.

File utama components/viewer/\*, editor3d/{model-mesh,scene-3d-viewport,controls-panel-3d,add-design-3d-dialog}, pages/{demo-3d,editor-3d,asset-detail}, scene-3d-store, model-3d/mesh-target/export-3d/record-3d-video, use-reduced-motion, App/index.css; optional shared Scene3DState/Decal3D, API web-app route allowlist; generator/validator/tests/CI/docs. Tidak ada schema migration baru/auth/payment/credit business change.

## Runtime dan operasi

Actual Bun1.4.4 di .cache/runtime/bun-1.4.4/bun-windows-x64/bun.exe, global1.4.0 tetap. Elysia1.4.30/CORS1.4.2; Three0.171.0/R3F9.6.1/Drei10.7.7/postprocessing3.0.4 existing terkunci, tidak upgrade framework/dependency baru. Frozen669installs807packages no changes.

Pinned PATH: bun install --no-env-file --frozen-lockfile; bun run typecheck; bun run lint; NODE_ENV=production bun run build. PowerShell pakai env assignment. Production docker build --target app -t nesomn-app:release .; Compose app/gateway, app3000private, gateway127.0.0.1:8080/TLS reverse proxy. Client /, admin /admin/, showcase /demo/3d, API /api/, health /health/live dan /health/ready. [Deployment](../deployment.md), [external workers](../workers.md), [backup/schema/preflight](../security.md), [QRIS](../payments-qris.md). PostgreSQL DATABASE_URL/Redis/storage/AI/receipt worker tetap eksternal, schema0000–0007 tetap explicit migration setelah backup/clone, bukan boot. Sample tidak memerlukan merchant/DB.

## Verifikasi aktual

| Command / acceptance                                                                   | Status/batas                                                                                                                                                                                         |
| -------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Frozen/typecheck/lint/production build                                                 | PASS5workspaces,0errors2existing react-refresh warnings, prerender/chunk warnings existing                                                                                                           |
| Combined theme/navigation/public/viewer/recording tests                                | PASS9tests50assertions                                                                                                                                                                               |
| node scripts/test-viewer.mjs unit                                                      | PASS5tests21assertions: framing/unsafeURL/embeddedGLTF/material isolation/meshpaths/abortcleanup                                                                                                     |
| node scripts/test-baseline.mjs unit                                                    | PASS24tests55assertions, original2D/3DJSON and reset/catalog-source                                                                                                                                  |
| node scripts/test-qris.mjs unit                                                        | PASS4tests12assertions, no merchant                                                                                                                                                                  |
| deployment tests/check-deployment                                                      | PASS13tests99assertions, exact app/gateway, showcase SPA route                                                                                                                                       |
| Node runtime/prerender/bootstrap guards                                                | PASS11                                                                                                                                                                                               |
| Generator/custom validator/Khronos                                                     | PASS4GLB +8deterministic hashes, each0error0warning                                                                                                                                                  |
| Fixed disposable DB editor integration                                                 | PASS2tests8assertions: create/get/update/catalog signedURL/meshPath/ownership; synthetic rows removed                                                                                                |
| Final Docker build                                                                     | PASS latest source; actual production client assets extracted before image deletion                                                                                                                  |
| node tests/viewer-browser.mjs with extracted final image                               | PASS Chrome156WebGL2 SwiftShader:4models×1440/390,12extra switches,1Canvas,GLerror0,reset/zoom/rotate/fullscreen/dynamic reducedmotion/invalidRetry/noWebGL, actual decal fixture/save/PNG/JPEG/WebM |
| Fresh export/decode                                                                    | PASSPNG61856/JPEG14808/WebM27308bytes; video854×944ready4                                                                                                                                            |
| Runtime exceptions/external model/env network                                          | None in final test; explicit local me/projects fixture, not real account/provider                                                                                                                    |
| Real phone/physicalGPU/Safari/Firefox/live managed-storageCORS/full admin/editor suite | SKIPPED; mobile means viewport emulation, not physical certification                                                                                                                                 |
| RemoteCI/live merchant/provider/production deploy                                      | SKIPPED                                                                                                                                                                                              |

Browser mock only exists in test server, never application fallback. Separate integration uses actual Elysia/Drizzle on fixed disposable DB55432/Redis56379, not production. Independent review not performed: previous skill files are unavailable on host; implementer source audit/regression evidence only, no CLEAN verdict. Full editor/admin/release verification remains phase9/10.

## Artifacts dan cleanup

[Abstract desktop](artifacts/phase-8/nesomn-abstract-form-1440.png), [Product mobile](artifacts/phase-8/nesomn-product-box-390.png), [Room](artifacts/phase-8/nesomn-lowpoly-room-1440.png), [Typography](artifacts/phase-8/nesomn-typography-block-390.png), [editor/decal](artifacts/phase-8/editor3d-1440.png), [invalid](artifacts/phase-8/invalid-model-390.png), [noWebGL](artifacts/phase-8/no-webgl-390.png). [PNG](artifacts/phase-8/sample-editor-export.png), [JPEG](artifacts/phase-8/sample-editor-export.jpg), [WebM](artifacts/phase-8/sample-editor-export.webm), [browser evidence](artifacts/phase-8/browser.json), [machine evidence](phase-8-evidence.json), [Khronos](artifacts/phase-8/khronos-validation.json).

At user's explicit disk-cleanup request, **10 test containers and14 test image tags** from this repo's phases2–8 removed after testing. No targeted container/image tag remains. [Cleanup results](artifacts/phase-8/docker-cleanup.json). Named/allowlisted removal, no force/global prune; volumes/networks/buildcache preserved. Virtual shared image sizes are not a claim equal Windows physical disk reclaimed. Unverified nesomn-p3 images outside this task allowlist retained. Browser/server closed. Docker briefly unavailable after interruption, restored via DesktopCLI and final build passed; PowerShell stalled so cmd/Node structured runners completed checks.

## Risiko / deviasi

Embedded static assets only; no animation timeline/compressed decoders/external resource glTF. Mesh hierarchy paths require stable asset ordering/version. Old projects that saved mug while using another transient model URL never recorded recoverable identity: original GLB cannot be inferred; user must reselect correct catalog asset. New saves preserve identity.

Context loss shows fallback; reload may be needed after device capability recovery. Expired signed URLs require re-resolution from server. Native fullscreen/MediaRecorder depend on browser; second empty recording remains explicit error and one retry may extend action to roughly8seconds. Bespoke editor swatches/mobile panels/full keyboard/performance large scenes remain phase9/10; preview control44px/narrow viewport acceptance is not blanket WCAG certification. Local acceptance is not whole-platform production readiness.
