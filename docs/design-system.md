# Nesomn Creative Editorial — phase6 as-built

User direction: **monokrom + orange**, shape reference [UjiHub](https://ujihub.royyan.net), Bricolage Grotesque display + Manrope UI. This supersedes the old DESIGN.md draft's indigo/Inter/dark-only decisions. Product remains a studio platform with2D/3D editors, marketplace, subscription/credits and admin. No competitor content, logo, colors or factual claims copied. Reference was inspected in actual Chrome after load; it uses rounded rectangles, pill actions, strong headings and quiet spacing. Website layouts themselves remain phase7; canvas/admin composition is task-first.

## Single source and palette

`packages/shared/src/theme.css` owns semantic values. Client Tailwind aliases reference them; admin maps them into Ant Design ConfigProvider, including placeholder/error/success and primary foreground. Do not insert arbitrary brand colors in page components.

| Token               | Light             | Dark              |
| ------------------- | ----------------- | ----------------- |
| background          | #f7f6f2           | #151513           |
| surface             | #fffefa           | #1d1d1a           |
| surface2 / surface3 | #eeede8 / #e3e2dc | #282825 / #343430 |
| foreground          | #20201d           | #f4f3ec           |
| muted / faint       | #5e5d56 / #66655e | #b8b7ad / #aaa99f |
| accent / hover      | #b83e0b / #9d3006 | #ff9560 / #ffad85 |
| accent foreground   | #ffffff           | #26170f           |
| accent subtle       | #ffe8dc           | #42291c           |
| border / strong     | #d5d4cd / #a4a39b | #42423b / #77776b |

Orange differs by theme to preserve text contrast. Body/muted/placeholder tokens on background/surface/surface2 and accent text pairs pass4.5:1; focus accent on background passes3:1. Semantic success/warning/danger/info remain for meaning, not decoration. No blue/indigo gradient or glow in foundational CSS. Old gradient utility names remain compatibility aliases to solid orange so existing pages continue working.

## Type, shape and interaction

Manrope Variable UI/body and Bricolage Grotesque Variable headings self-hosted via exact `@fontsource-variable/*@5.3.0` (OFL1.1, licenses in installed packages). Browser confirms both loaded, no Google Fonts runtime request. JetBrains Mono retained for data/code; Inter package retained for compatibility but no longer imported by foundation. Display tracking -.025em, balanced heading wraps; existing semantic Tailwind type scale retained rather than changing all page copy/heading sizes at once.

Spacing uses existing Tailwind4px base scale. Shared control token44px; buttons, inputs, tabs, dropdown items, filters and mobile close/trigger minimum44px high. Slider gets44px interaction area with16px visible thumb. Switch44px high. This is not a claim every bespoke editor/admin control already meets target44 in all contexts; those surfaces need phases8–10. Radius6/10/16/28px, pills for large actions/badges/filter controls; task panels keep compact composition. Existing shadows are soft offsets; shared shadow tokens allow consistent extension.

Focus uses2px orange outline with3px offset and component rings. Input errors link aria-describedby and rolealert. Dialog viewport bounds/scroll, Radix modal focus trap/recovery, full sidebar link labels in collapsed mode, original black/white SVGs selected by theme. Mobile drawer remains expanded independently of desktop collapse state. Skip link targets main. Marketplace category selection uses query-aware aria-current and controls use aria-pressed; URL filters/search are navigable. API error renders explicit retry, not empty/fake catalog.

Motion tokens150/220ms with ease-out, CSS reduced-motion override plus Framer useReducedMotion for route entry. Content starts visible; no new autoplay. No changes to renderer, scene document or export semantics.

## Theme contract

`@nesomn/shared/theme` is a browser-only subpath, not imported by shared domain entry/API. `nesomn-theme` localStorage preference system/light/dark, system default follows OS. Head script sets data-theme/color-scheme before React; controller updates same-tab, storage events and OS changes, removes listeners on unmount. Blocked storage retains a session choice; reload follows OS if persistence is unavailable. Client and admin on same origin share preference. No cookie/backend/user-profile mutation.

Admin `ConfigProvider` keeps Refine/Ant Design; no UI framework migration. Theme selector is available on login and application shell. Original admin logo URL correctly uses `/admin/` base. Admin resource/business workflow redesign remains phase9. Light/dark screenshots and tested scope: [phase6 report](revision/phase-6-report.md).
