# Admin Dashboard Visual Redesign

## Summary

Dashboard admin (berbasis Refine + Ant Design) terasa generik dan belum selaras dengan bahasa visual web utama di `DESIGN.md` (dark studio, premium, minimal, satu aksen biru-indigo). Pekerjaan ini melakukan redesign VISUAL saja: penyelarasan palet warna, tipografi, radius, dan spacing lewat token tema Ant Design serta CSS finishing. Tampilan tombol upload dipercantik secara visual (styling), TANPA mengubah komponen, struktur form, atau logikanya.

Pekerjaan ini murni styling. TIDAK ada fitur yang dihapus, TIDAK ada komponen baru, TIDAK ada perubahan struktur file, form, atau alur data. Sidebar juga tidak diubah.

## Scope

Termasuk (visual/styling saja):
- Penyelarasan token tema Ant Design admin (`ConfigProvider` di `App.tsx`) ke palet `DESIGN.md`: `colorBgLayout`, `colorBgContainer`, `colorBgElevated`, `colorBorder`, `colorPrimary` (accent `#3B5BFF`), `colorText`, `colorTextSecondary`, `borderRadius`, `fontFamily` (Inter), plus token per komponen (Table, Button, Input, Select, Tag, Menu, Card, Modal).
- Stylesheet global admin (`index.css`) untuk finishing yang tidak tercakup token antd: import font Inter & JetBrains Mono, custom scrollbar tipis, penghalusan visual. Diimport di `main.tsx`.
- Mempercantik tampilan tombol/area upload yang sudah ada SECARA VISUAL (warna, border, radius, hover) lewat token tema + CSS, tanpa mengubah elemen `Upload`, `customRequest`, atau struktur form.

TIDAK termasuk (out of scope, WAJIB dipatuhi):
- TIDAK membuat komponen baru (mis. tidak ada `AssetUploader` atau komponen wrapper lain).
- TIDAK memindahkan atau mengekstrak helper/fungsi (mis. `uploadTo` tetap di tempatnya).
- TIDAK mengubah struktur JSX/form di `assets.tsx` atau halaman lain (jumlah & susunan `Form.Item`, field, dan elemen tetap sama).
- TIDAK menghapus, menambah, atau mengubah fitur/fungsi apa pun.
- TIDAK mengubah struktur/isi/urutan menu sidebar.
- TIDAK mengubah logika data, endpoint API, atau kontrak upload (`/api/admin/uploads`).
- TIDAK mengganti komponen `Upload` antd menjadi `Upload.Dragger` bila itu mengubah struktur; perubahan hanya styling.
- TIDAK migrasi admin dari Ant Design ke Tailwind/shadcn (stack tetap sesuai AI-RULES 2).

## Tahapan Implementasi (Steps)

1. **Petakan token DESIGN.md ke token antd.** Di `admin/src/App.tsx`, buat/isi objek tema antd yang memetakan palet `DESIGN.md` (2) ke token antd: warna dasar (background, surface, border), accent (`#3B5BFF`), text, semantic, `borderRadius` (10px), dan `fontFamily` (Inter). Gunakan `theme.darkAlgorithm`. Hanya sentuh definisi tema dan penerapannya di `ConfigProvider`; jangan ubah bagian lain.
2. **Tambah token per komponen antd.** Pada `theme.components`, atur styling `Table`, `Button`, `Card`, `Input`, `Select`, `Tag`, `Menu`, `Modal`, `Layout` agar surface & border sesuai token DESIGN.md. Ini murni konfigurasi tema, tidak menyentuh JSX.
3. **Buat stylesheet global admin.** Tambah `admin/src/index.css`: import font Inter & JetBrains Mono (`@fontsource`), custom scrollbar tipis selaras tema, dan finishing visual halus. Import di `admin/src/main.tsx` (satu baris import, tanpa mengubah struktur render).
4. **Sediakan font.** Pastikan dependency `@fontsource/inter` & `@fontsource/jetbrains-mono` tersedia untuk paket admin, di-import di `index.css`.
5. **Percantik upload secara visual.** Bila perlu, tambahkan styling CSS untuk tombol/area upload yang sudah ada (hover, border, radius) via class atau token. JANGAN mengganti elemen `Upload`, memindah `uploadTo`, atau mengubah struktur `Form.Item`.
6. **Verifikasi tanpa perubahan struktur.** Pastikan diff hanya menyentuh: definisi tema di `App.tsx`, `index.css` (baru), satu baris import di `main.tsx`, dan `package.json`. File halaman (`assets.tsx` dll) idealnya tidak berubah struktur; bila tersentuh, hanya untuk class styling.
7. **Verifikasi build.** Jalankan typecheck & lint paket admin; pastikan lulus.
8. **Verifikasi visual.** Jalankan dev server, buka `/admin`, cek tema gelap + aksen biru aktif dan tidak ada fitur yang hilang.

## Expected Result

- Tampilan admin selaras tema web utama: background gelap, surface `#161618`, aksen biru-indigo `#3B5BFF`, radius & tipografi Inter sesuai `DESIGN.md`.
- Tabel, form, tombol, input, dan tag memakai warna surface/border/accent yang konsisten, bukan default antd generik.
- Semua fitur, komponen, dan struktur form TETAP SAMA seperti sebelumnya (tidak ada yang hilang atau dipindah).
- Sidebar tidak berubah.
- Diff perubahan terbatas pada styling (tema `App.tsx`, `index.css`, import `main.tsx`, `package.json`).
- Typecheck, lint, dan build admin lulus.

## Features

- Tema admin selaras `DESIGN.md` (dark studio, satu aksen biru-indigo).
- Token antd terpusat & mudah dirawat di `App.tsx`.
- Stylesheet global admin (scrollbar, font, finishing) di `index.css`.
- Penyegaran visual komponen (tabel, form, tombol, tag, upload) tanpa mengubah fungsi.
- Seluruh fitur eksisting dipertahankan utuh.

## Related Modules

- Admin (Refine + Ant Design) - tema & finishing visual.
- Design system (`DESIGN.md`) - sumber token warna, tipografi, radius.

## Related Files

- `admin/src/App.tsx` [MODIFY] - definisi tema antd (token global + `components`) dan penerapan di `ConfigProvider`. Tanpa perubahan struktur lain.
- `admin/src/main.tsx` [MODIFY] - tambah satu baris import `index.css`.
- `admin/src/index.css` [NEW] - stylesheet global admin (font, scrollbar, finishing visual).
- `admin/package.json` [MODIFY] - tambah dependency `@fontsource/inter` & `@fontsource/jetbrains-mono`.

## Notes

- Cakupan pekerjaan ini KETAT pada visual. Tidak boleh menghapus fitur, membuat komponen baru, memindah helper, atau mengubah struktur form/JSX/logika. Ini revisi setelah percobaan sebelumnya melampaui scope.
- Stack admin tetap Refine + Ant Design (AI-RULES 2). Penyelarasan lewat token antd + CSS global.
- Sidebar (`ThemedLayoutV2` sider) final: jangan diubah.
- Kontrak endpoint upload `/api/admin/uploads` tidak diubah.
- Referensi token: `DESIGN.md` 2 (warna), 3 (tipografi), 4 (radius/shadow), 7.6 (Admin).
- Hormati `prefers-reduced-motion` (DESIGN.md 9-10).
- Larangan gaya: tanpa em-dash, tanpa kata "feat"/"phase" di dokumen, commit, dan PR (AI-RULES 8).
