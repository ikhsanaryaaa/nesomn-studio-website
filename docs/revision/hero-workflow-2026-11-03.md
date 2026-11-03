# Hero editor/result preview — 3 November 2026

Changed the landing hero to copy-left/preview-right on desktop and a stacked composition on tablet/mobile. The illustrative editor contains layers, tools, a selected poster and inspector; a floating CSS3D product box repeats the same original Artwork component. Both are explicitly Demo/Sample, with no saved user data or fake interactive controls.

Files: client/src/pages/landing.tsx, landing.css, landing-hero-preview.tsx and landing-hero-preview.css; tests/domains-ui-browser.mjs. Removed the old abstract-poster preview styles. Existing colors, Poppins/Bricolage, Radix actions, catalogue and business logic remain.

Verification:
- Client typecheck PASS.
- Workspace lint PASS (two existing fast-refresh warnings).
- Client production build/prerender PASS; existing large-chunk warnings remain.
- node tests/domains-ui-browser.mjs PASS:360/390/768/1024/1440 × light/dark, no page overflow, shared artwork appears twice, no Canvas/WebGL allocated, Tryin3D target>=44px, desktop column separation, mobile result/caption geometry; existing catalogue states/menu/login checks retained.
- Separate source and visual review: desktop/tablet/mobile checked; final artifacts below.
- Browser focus recovery is awaited before screenshot scroll reset, fixing footer-position screenshots at360px.
- No Docker resources were created for this small UI change. No push/deployment or live backend testing.

[Desktop](artifacts/hero-workflow-2026-11-03/final/landing-light-1440.png) · [Mobile hero](artifacts/hero-workflow-2026-11-03/final/landing-light-360.png) · [Mobile workflow detail](artifacts/hero-workflow-2026-11-03/final/workflow-detail-dark-390.png) · [Browser measurements](artifacts/hero-workflow-2026-11-03/final/browser.json).

This is an illustrative HTML/CSS preview; the Tryin3D link opens the existing interactive sample showcase. No new editor functionality or asset export was implemented.
