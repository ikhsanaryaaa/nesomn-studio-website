# Viewer3D runbook

[Phase8 implementation/evidence](revision/phase-8-report.md). Public /demo/3d is Demo/Sample only; no product records/project writes. Catalog detail preview is opt-in and uses existing signed license/plan access.

Commands with pinned Bun1.4.4 PATH:

- node scripts/generate-demo-models.mjs
- node scripts/validate-demo-models.mjs
- node scripts/test-viewer.mjs unit
- NESOMN_DISPOSABLE_TESTS=1 node scripts/test-viewer.mjs integration after fixed disposable DB/Redis + explicit migration setup from testing-phase4.md.
- NODE_ENV=production bun run build
- docker build --target app -t nesomn-app:release .
- NESOMN_VIEWER_DIST=<extracted client/dist> node tests/viewer-browser.mjs (Windows Chrome, own localhost18088/debug9238/profile; explicit offline API fixture, never production).

Khronos validator test used official npm gltf-validator2.0.0-dev.3.10 extracted under .cache/revision-phase-8/validator. Raw report retained, no runtime dependency. Re-run same official pinned validator against four GLBs for external replication.

Inputs: max25MB embeddedGLB/GLTF2.0, metadata/vertex budgets. Prefer embedded .glb. External buffer/image resources and Draco/Meshopt/KTX2 explicitly unsupported. HTTPS or same-origin HTTP, cross-origin credentials omitted; storage CORS must allow studio origin. Signed URL query is allowed but not serialized/logged. Never use VITE merchant/storage credentials. Failed access stays error/Retry.

Controls: drag orbit, wheel/pinch zoom, ResetView/Zoom±/AutoRotateOff-default/backdrop/Fullscreen. OS reducedmotion immediately disables autorotation. Editor optional modelSource/meshPath keep legacy JSON compatible; old missing model identity requires reselect, not guessed migration. Projection decal creates ownUV, not an atlas editor.

Owned model/texture disposal, R3F control/renderer lifecycle, PMREM cleanup, fetch abort, FileReader and recording cleanup protect mounts/switches. No Canvas grids. Video rejects empty output, retries once, then explicit error.

User requested test container/image deletion after Docker testing. Current phase8 test resources already removed; rebuild only when needed and clean verified task-specific resources afterward. Preserve production/shared data and unrelated project resources.
