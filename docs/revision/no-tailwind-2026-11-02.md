# Tailwind removal — 2 November 2026

Repository: https://github.com/ikhsanaryaaa/nesomn-studio-website
Branch: codex/qris-session-refresh; local base8ffda2e. Changes remain local and include the preceding sidebar/auth redesign; existing graphify-out is preserved.

The user explicitly requested removing Tailwind. The client now uses ordinary semantic CSS with existing Radix/house component APIs. This is a styling migration, preserving platform/editor/auth/payment behavior. Admin already uses Ant Design and has no Tailwind dependency.

## What changed
- Removed tailwindcss, @tailwindcss/vite and tailwind-merge from client dependencies and regenerated bun.lock; lockfile change only removes entries.
- Removed Vite plugin, CSS compiler import and @theme directives. No generated utility stylesheet or replacement utility framework.
- Replaced utility strings across client pages, shell, editors/AI panels and Radix-backed primitives with component/role classes.
- cn now joins semantic classes using existing clsx; cva retains existing component variant APIs.
- styles/reset.css explicitly normalizes browser defaults, including fieldset/legend.
- styles/ui.css uses components cascade layer; unlayered page/editor styles can override component defaults, including caller-provided classes.
- styles/workspace.css covers page/shell roles, styles/editors.css editor/AI roles, styles/content.css store/viewer roles. Existing auth.css/sidebar.css and authored index.css surfaces retained.
- Theme values remain shared between client and admin; fonts, logo assets and monochrome/orange remain.
- Fixed invalid Input dropping caller styles; added render-based regression tests.
- Color controls use44px interaction targets (previously32px swatches) to respect the existing accessibility brief.
- README/design-system docs updated. Release checks include no-Tailwind guard and component regression tests.

## Verification and limits
Runtime: pinned cached Bun1.4.4, Elysia unchanged1.4.30; no other dependency upgrade. Frozen install succeeds.

The no-Tailwind guard checks manifests/lockfile/plugin/compiler directives plus JSX/cva class expressions, rather than trusting documentation. Two component render tests cover error associations/caller classes and Button Slot overrides.

Offline production browser fixtures explicitly use synthetic users/API responses; no real DB/merchant/OAuth identity or credentials. Screenshots and reports are under artifacts/no-tailwind-2026-11-02. Expected API401/503 errors are retained in diagnostics.

Independent source review found lost Input class overrides and fieldset normalization; both fixed and rechecked. Prior isolated CSS calibration covered target-size checking only, not full layout correctness.

Initial parallel browser attempts: editor workflow PASS; theme keyboard test selected before deferred Radix focus settled (added explicit focus assertions/waits); viewer export did not produce WebM. Sequential final-run results follow below. Do not treat unsuccessful attempts as PASS.

No Docker containers or images were created. No deployment, push, merge, migration or production action performed.

## Final command results

Use the pinned Bun1.4.4 executable (or Bun1.4.4 on PATH).

| Command | Status | Evidence and limits |
| --- | --- | --- |
| bun install --no-env-file --frozen-lockfile | PASS |633 installs/711packages checked; no lock changes |
| bun run typecheck | PASS |All5 workspaces |
| bun run lint | PASS |0 errors;2 existing FastRefresh warnings badge/button |
| bun run --cwd client build | PASS |Production Vite/prerender3routes; existing large-chunk/dynamic-import warnings |
| bun run --cwd client test:ui | PASS |2render-based tests/10assertions |
| node --test tests/no-tailwind.test.mjs tests/design-tokens.test.mjs tests/release-runner.test.mjs | PASS |10tests |
| node tests/theme-browser.mjs | PASS |Final sequential run;5widths, light/dark, login/register/workspace, themes/client-admin persistence, keyboard, collapse, errors; production assets |
| node tests/editor-bugs-browser.mjs | PASS |Fixture-only2Dsave/image renewal/error/retry, account/document switches,3D pending/stale save handling; no JavaScript exceptions |
| node tests/viewer-browser.mjs | FAIL |All4GLBs rendered desktop/mobile, invalid model retry/no-WebGL, save/PNG/JPEG reached; WebM missing, UI reports Rekaman gagal. Both parallel and sequential attempts failed |
| Docker/full production release lab/live OAuth/DB/merchant | SKIPPED |Not required for CSS compilation, no live services used; not a complete release acceptance |

### Unresolved export evidence
The recorder source was not changed by this migration. An isolated browser probe using the same recordTurntable function returned “Tidak ada frame video yang dapat direkam.” for a320x2402Dcanvas, but succeeded for a320x240WebGLcanvas. VP9 capability returned true in both cases. This narrows investigation toward capture/encoding behavior, but does not prove the editor export problem is environment-only or pre-existing. Video export remains unverified/failed, not PASS. No recorder workaround was added to this styling change.

Representative artifacts:
- [Login desktop dark](artifacts/no-tailwind-2026-11-02/theme/login-dark-1440.png)
- [Login mobile light](artifacts/no-tailwind-2026-11-02/theme/login-light-390.png)
- [Theme browser report](artifacts/no-tailwind-2026-11-02/theme/browser.json)
- [3D editor](artifacts/no-tailwind-2026-11-02/viewer/editor3d-1440.png)
- [2D mobile](artifacts/no-tailwind-2026-11-02/editor/2d-mobile-dark.png)
- [Viewer failure log](artifacts/no-tailwind-2026-11-02/viewer-failure.log)
- [Recorder probe evidence](artifacts/no-tailwind-2026-11-02/record-probe.log)

Earlier ui-shell-2026-11-02 documentation records the preceding intermediate redesign; its statement that Tailwind was retained is superseded by this revision.
