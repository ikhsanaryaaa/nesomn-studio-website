# Radix Themes integration — 2 November 2026

Repository: https://github.com/ikhsanaryaaa/nesomn-studio-website
Branch: codex/qris-session-refresh; local base8ffda2e. This revision remains uncommitted, together with preceding sidebar/auth redesign and Tailwind removal.

## Implemented
- @radix-ui/themes pinned3.3.0, verified against the official npm latest registry metadata; stable and compatible with React19. Bun1.4.4/Elysia1.4.30 unchanged.
- Official @radix-ui/themes/styles.css imported after the browser reset, before project layout/brand adapters. Tailwind remains absent.
- AppTheme wraps both browser and production prerender. It follows the shared system/light/dark controller; orange accent, sand gray, large radius, solid panels. Original logos/Manrope/Bricolage remain.
- Actual Themes Button/IconButton, TextField, Badge, Card, Tabs, Switch, Skeleton, Dialog and DropdownMenu. Existing wrapper APIs preserve callers, refs, labels, validation, links and business event handlers.
- Secondary/ghost actions use gray. CSS additions primarily handle layout,44px targets, brand accent/contrast/font aliases and input icon spacing.
- Themes handles its dialog/menu portal scopes. The existing custom mobile drawer has Theme asChild so portaled controls inherit the same appearance.
- Controlled dialogs capture/restore opening focus, preserving caller callbacks/preventDefault and avoiding disconnected elements.
- Removed unused direct slot/switch/tabs primitive dependencies; retained the primitives still used.

## Deliberate exceptions
Themes3.3.0 Slider does not forward accessible names to its internal thumbs. The adapter therefore uses Radix Slider primitives with the official Themes size/variant/track/range/thumb CSS, and forwards aria-label/labelledby directly to thumbs. Regression tests cover the name and required surface variant.

Toast retains the existing Radix primitive implementation because Themes has no equivalent Toast component. Native bespoke editor inputs and authored page/editor layout remain CSS. Admin continues using Ant Design; it was not silently migrated.

The pinned DropdownMenu Item adapter forwards the existing asChild flag (verified in installed3.3.0 runtime source although omitted from its public typings) so account links remain real anchors. Recheck this compatibility contract on future Themes upgrades.

## Verification
Bun commands use the pinned1.4.4 runtime and sanitized test environment.
- PASS: bun install --no-env-file --frozen-lockfile.
- PASS: bun run typecheck, all5workspaces.
- PASS: bun run lint,0errors;2 existing FastRefresh warnings in badge/button.
- PASS: bun run --cwd client build, production/prerender3routes. Existing large-chunk/dynamic-import warnings remain.
- PASS: bun run --cwd client test:ui,5render-based tests/23assertions (TextField input associations/caller classes, Button Slot links/variant, actual Themes provider SSR, named Slider, native Dialog adapter buttons).
- PASS: node --test tests/no-tailwind.test.mjs tests/design-tokens.test.mjs,4tests.
- PASS: node tests/editor-bugs-browser.mjs on production assets with isolated API double;2Dimage/save/retry, document/account isolation,3Dpending/update/stale saves, no JavaScript exceptions.
- Mechanical detector: no findings. It does not prove behavior.
- Browser theme/dialog final result recorded below. Initial browser attempts found and resolved an incorrect test selector (Themes Title uses Heading) and missing focus restoration for a controlled modal.
- SKIPPED: real DB/auth/OAuth/merchant, full Docker release lab and production deployment. No Docker images/containers created.
- Known earlier FAIL: WebM export in local Chrome headless (no-tailwind revision). Recorder code is unchanged; this integration does not claim video export fixed.

Source review identified the Slider naming limitation and missing surface variant; both addressed. Browser validation uses360/390/768/1024/1440 light/dark, real menu/drawer/dialog keyboard and explicit401/503 failure fixtures.

References: [Radix setup](https://www.radix-ui.com/themes/docs/overview/getting-started), [styling/portals](https://www.radix-ui.com/themes/docs/overview/styling), [TextField](https://www.radix-ui.com/themes/docs/components/text-field). Installed source/types are the contract used for adapters.

## Final browser result
PASS: node tests/theme-browser.mjs on the final production build. Five widths and both themes; drawer20Tab/Escape recovery; Themes controlled-dialog12Tab/Escape focus recovery; menu keyboard; persistent client/admin theme; search input inset; login/register/signed-out/error screens; no JavaScript exceptions. The test's HTTP401/503 fixture is explicit and never production.

Artifacts: [browser report](artifacts/radix-themes-2026-11-02/theme/browser.json), [login desktop dark](artifacts/radix-themes-2026-11-02/theme/login-dark-1440.png), [login mobile light](artifacts/radix-themes-2026-11-02/theme/login-light-390.png), [Themes dialog mobile](artifacts/radix-themes-2026-11-02/theme/radix-dialog-dark-390.png), [editor workflow report](artifacts/radix-themes-2026-11-02/editor/browser-results.json).

No production deployment or push was performed. This does not claim all platform/payment/video workflows production-ready.
