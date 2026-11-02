# English-only application UI — 3 November 2026

Repository: https://github.com/ikhsanaryaaa/nesomn-studio-website
Branch: codex/qris-session-refresh; local base8ffda2e. Changes remain local alongside preceding UI/Radix Themes revisions. Existing untracked graphify-out is preserved.

## Implemented
The user chose English-only interface copy. Application-authored labels, navigation, authentication, workspace access, store/bundle, subscription/credits/checkout/payment status, account/history, editors, AI jobs,3Dpreview, admin, accessible labels and loading/error/success/help text now use English.

API validation/errors and worker messages that can reach the UI were translated while retaining codes/statuses. Operator-only Indonesian messages were also normalized. Native Ant Design controls explicitly use en_US. Client/admin HTML and production prerender declare lang=en. Display dates/numbers use English locales (client en-ID, admin dates en-GB), keeping IDR and business amounts unchanged.

No i18n dependency was added for a single-language application. Existing Radix Themes/font/color/layout choices remain.

## Data and behavior boundaries
- User-authored project/scene names, asset/product/plan names, descriptions, uploaded files, existing records and historical job messages are not rewritten.
- No seed, migration, schema or production database update. No merchant or credential action.
- IDs/routes/local-storage keys/enums/error codes/numeric calculations and business logic remain.
- The recorder's translated error message and matching retry condition use the same English sentinel.
- Structural comparison across the198-file source snapshot found only three non-copy changes: explicit admin en_US locale import/prop and two English date-format arguments. Other reviewed changes are string/JSX copy or formatting.
- Third-party responses and existing authored/stored content may have their original language; this is not automatic data translation.

## Verification
Pinned Bun1.4.4, Elysia unchanged1.4.30, Radix Themes unchanged3.3.0. Test invocations use the sanitized test environment.
- PASS: bun run typecheck, all5workspaces.
- PASS: bun run lint,0errors/two existing FastRefresh warnings in badge/button.
- PASS: bun run build, actual workspace scripts including client/admin production assets. Admin rebuilt after the final days label fix. Existing chunk/dynamic-import warnings remain.
- PASS: node --test tests/english-ui.test.mjs tests/no-tailwind.test.mjs tests/design-tokens.test.mjs (6tests).
- PASS: bun run --cwd client test:ui (5tests/23assertions).
- PASS: bun --no-env-file --no-install test tests/theme.test.ts tests/navigation.test.ts tests/public-flow.test.ts (4tests/29assertions).
- PASS: node scripts/test-security.mjs unit (9tests/64assertions).
- PASS: node scripts/test-qris.mjs unit (4tests/12assertions).
- English guard checks AST runtime strings/JSX/templates against a bounded Indonesian vocabulary and document language; initially failed, then passed after translations. This is a regression guard, not a complete linguistic proof.
- Browser selectors/assertions were updated to English; an initial test-only pathname corruption from abbreviation replacement was repaired before rerunning. No application identifier was changed.
- Independent source review found the admin subscription suffix hari; fixed to days and added to the guard.

Browser final results/artifacts follow below. Browser fixtures use synthetic/offline API data, not production DB/users/merchant. Full DB-backed public/admin/payment acceptance, actual OAuth, Docker release lab and live merchant tests are SKIPPED. No Docker containers or images were created. The previously documented local headless WebM export failure remains outside this copy revision.

The new user language choice supersedes earlier mixed-language design notes. Technical comments and historical documentation do not form UI copy and need not be translated.

## Final browser results
- PASS: node tests/theme-browser.mjs against compiled client/admin assets.360/390/768/1024/1440px light/dark, theme persistence, English labels, drawer20Tab/Escape recovery, Themes dialog12Tab/Escape focus return, login error stays on form, search inset, collapsed sidebar, explicit store API error.
- PASS: node tests/editor-bugs-browser.mjs on production assets with API doubles; document/account isolation,2Dsave/image refresh/retry/export block and3Dpending/stale-save handling. No JavaScript exceptions.
- Expected fixture HTTP401/503 errors are retained in reports; these are not claims of live backend acceptance.
- Reviewer/source vocabulary guard and visual inspection found no further UI copy issue in tested surfaces.

Artifacts: [desktop login](artifacts/english-ui-2026-11-03/theme/login-dark-1440.png), [mobile login](artifacts/english-ui-2026-11-03/theme/login-light-390.png), [admin login](artifacts/english-ui-2026-11-03/theme/admin-light-1440.png), [editor dialog](artifacts/english-ui-2026-11-03/theme/radix-dialog-dark-390.png), [theme report](artifacts/english-ui-2026-11-03/theme/browser.json), [editor report](artifacts/english-ui-2026-11-03/editor/browser-results.json).

No commit/push/deployment was performed. This copy change does not resolve the previously recorded WebM limitation or prove complete production readiness.
