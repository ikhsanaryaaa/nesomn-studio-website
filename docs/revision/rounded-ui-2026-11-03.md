# Rounded shapes — 3 November 2026

Scope: existing shared client/admin corner scale, Radix Themes controls/portals, auth frame and application pill tokens. User requested visibly rounder shapes.

Checklist: shared radius8/16/24/32px; controls16px; panels24px; login frame/dialog32px; authored pill/avatar/filter corners remain pills; Radix full-radius preset unchanged. Englishcopy, orange/neutral themes,44px targets, spacing and editor workspace geometry unchanged.

References: existing shared theme, Themes radius/base-button/TextField CSS, current auth/sidebar and admin theme. No unrelated route/data/model audit. AppTheme retains radius=large; client stylesheet maps that preset to shared corner tokens in every Themes scope including portals. Admin derives borderRadius from shared16px token. App pill token renamed radius-pill to avoid Radix radius-full=0 in large mode shadowing circular/pill styles.

Validation results/artifacts follow after execution. No Docker images/containers, liveDB, merchant or production deployment required for this shape adjustment.

## Results
- PASS: pinned Bun1.4.4 bun run typecheck (all5workspaces).
- PASS: bun run build; client rebuilt after dialog-specific radius correction. Existing large-chunk/dynamic-import warnings remain.
- PASS: node --test tests/design-tokens.test.mjs tests/english-ui.test.mjs tests/no-tailwind.test.mjs (6tests).
- PASS: node tests/theme-browser.mjs on final production assets,360/390/768/1024/1440 in both themes; keyboard drawer/menu/dialog, focus return, persistence and no horizontal page overflow. Actual computed radii asserted for button/input>=16px, auth frame>=32px and dialog>=32px.
- PASS: git diff --check; mechanical design detector returned[].
- Source review identified Themes dialogs use radius5 rather than6; added explicit dialog corner mapping to shared32px token and verified in browser.
- SKIPPED: real DB/auth/payment, full Docker lab and editor save/export regression suites. No business handlers/schema/document format changed; known earlier WebM export limitation remains unaddressed.
- No Docker images or containers created. No push or deployment.

Artifacts: [desktop dark](artifacts/rounded-ui-2026-11-03/theme/login-dark-1440.png), [mobile light](artifacts/rounded-ui-2026-11-03/theme/login-light-390.png), [dropdown](artifacts/rounded-ui-2026-11-03/theme/theme-menu-dark-1440.png), [dialog mobile](artifacts/rounded-ui-2026-11-03/theme/radix-dialog-dark-390.png), [browser evidence](artifacts/rounded-ui-2026-11-03/theme/browser.json).
