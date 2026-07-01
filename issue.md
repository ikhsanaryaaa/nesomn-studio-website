# Admin Dashboard UI Redesign

## Summary

Dashboard admin (berbasis Refine + Ant Design) saat ini terasa generik dan belum selaras dengan bahasa visual web utama yang didefinisikan di `DESIGN.md` (dark studio, premium, minimal, satu aksen biru-indigo). Pekerjaan ini melakukan redesign tampilan admin agar konsisten dengan tema utama: penyelarasan palet warna, tipografi, radius, spacing, dan komponen inti (tabel, form, tombol, tag). Selain itu, komponen upload file (preview image, asset file, GLB) yang saat ini hanya berupa tombol biasa akan ditingkatkan menjadi area dropzone yang lebih informatif dan enak dipakai.

Sidebar admin (navigasi kiri / `ThemedLayoutV2` sider) sudah final dan TIDAK direstrukturisasi. Perubahan hanya menyentuh token tema global, styling konten, dan komponen upload.

## Scope

Termasuk:
- Penyelarasan token tema Ant Design admin (`ConfigProvider`) ke palet `DESIGN.md` (background, surface, border, accent, radius, font).
- Menambahkan stylesheet global admin untuk finishing detail yang tidak tercakup token antd (scrollbar, spacing halus, tipografi Inter, tabel, tag semantic).
- Redesign komponen upload di halaman Assets menjadi dropzone yang lebih baik (ikon, hint format & ukuran, state ter-upload, drag-and-drop), memakai `Upload.Dragger` antd dengan styling selaras tema.
- Membuat komponen upload yang dapat dipakai ulang (`AssetUploader`) agar konsisten di preview image, asset file, dan GLB.
- Konsistensi visual halaman list & form CRUD lain (assets, bundles, plans, users, subscriptions, credit packs, ai-providers, usage, sessions, audit-logs) mengikuti token baru.

TIDAK termasuk (out of scope):
- Mengubah struktur/isi/urutan menu sidebar (sudah final).
- Mengubah logika data, endpoint API, atau kontrak upload (`/api/admin/uploads`).
- Menambah resource / halaman admin baru.
- Mengubah alur autentikasi admin.
- Migrasi admin dari Ant Design ke Tailwind/shadcn (stack admin tetap Refine + antd sesuai AI-RULES §2).

## Tahapan Implementasi (Steps)

1. **Petakan token DESIGN.md ke token antd.** Buat objek tema baru di `admin/src/App.tsx` yang memetakan palet `DESIGN.md` (§2) ke token antd: `colorBgLayout`, `colorBgContainer`, `colorBgElevated`, `colorBorder`, `colorBorderSecondary`, `colorPrimary` (accent `#3B5BFF`), `colorText`, `colorTextSecondary`, `borderRadius` (10px), dan `fontFamily` (Inter).
2. **Tambah token komponen antd.** Pada `theme.components`, atur styling `Table`, `Button`, `Card`, `Input`, `Select`, `Tag`, `Menu` agar surface & border sesuai (`--surface`, `--surface-2`, `--surface-3`, `--border`). Sider dibiarkan memakai warna default layout (tidak direstrukturisasi, hanya ikut warna surface).
3. **Buat stylesheet global admin.** Tambah `admin/src/index.css` berisi: import font Inter & JetBrains Mono (`@fontsource`), custom scrollbar tipis selaras tema, penghalusan spacing konten, dan util kecil (mis. dropzone). Import di `admin/src/main.tsx`.
4. **Muat font.** Pastikan dependency `@fontsource/inter` & `@fontsource/jetbrains-mono` tersedia untuk paket admin (reuse yang sudah dipakai client bila memungkinkan) dan di-import di `index.css`.
5. **Buat komponen `AssetUploader` reusable.** Tambah `admin/src/components/asset-uploader.tsx` memakai `Upload.Dragger` antd: area dashed border, ikon `InboxOutlined`/`UploadOutlined`, judul, hint format & ukuran (props), indikator state "ter-upload" (nama file/label hijau), dan penanganan `customRequest` yang memanggil helper upload.
6. **Refactor `assets.tsx` memakai `AssetUploader`.** Ganti tiga blok `Upload` (preview, asset file, GLB) dengan `AssetUploader`, pertahankan logika `uploadTo`, `FILE_ACCEPT`, dan `form.setFieldValue`. Pindahkan helper `uploadTo` bila perlu agar dipakai bersama.
7. **Poles halaman list & form lain.** Sisir halaman di `admin/src/pages/*` untuk memastikan penggunaan `Tag` warna semantic konsisten, judul halaman rapi, dan tidak ada nilai warna hardcode yang bentrok dengan tema baru.
8. **Verifikasi build.** Jalankan typecheck & lint untuk paket admin, pastikan tidak ada error tipe / lint akibat perubahan.
9. **Verifikasi visual.** Jalankan dev server, buka `/admin`, cek halaman Assets (list + create/edit) dan minimal 2 halaman lain untuk memastikan tema selaras dan uploader berfungsi (drag-drop + klik).

## Expected Result

- Tampilan admin selaras dengan tema web utama: background gelap `#0B0B0D`-ish, surface `#161618`, aksen biru-indigo `#3B5BFF`, radius & tipografi Inter sesuai `DESIGN.md`.
- Tabel, form, tombol, input, dan tag memakai warna surface/border/accent yang konsisten, bukan default antd generik.
- Komponen upload tampil sebagai dropzone premium: dashed border, ikon, hint format/ukuran, mendukung drag-and-drop dan klik, serta menampilkan state file yang sudah ter-upload.
- Sidebar tidak berubah strukturnya (menu & urutan sama seperti sebelumnya).
- Typecheck, lint, dan build admin lulus tanpa error.

## Features

- Tema admin selaras `DESIGN.md` (dark studio, satu aksen biru-indigo).
- Token antd terpusat & mudah dirawat di `App.tsx`.
- Stylesheet global admin (scrollbar, font, finishing) di `index.css`.
- Komponen `AssetUploader` reusable berbasis `Upload.Dragger`.
- Dropzone upload dengan drag-and-drop, hint format/ukuran, dan indikator state ter-upload.
- Konsistensi visual lintas halaman CRUD admin.

## Related Modules

- Admin (Refine + Ant Design) - tema, layout konten, komponen CRUD.
- Design system (`DESIGN.md`) - sumber token warna, tipografi, radius, motion.
- Modul upload admin (`/api/admin/uploads`) - dikonsumsi uploader, kontraknya tidak diubah.

## Related Files

- `admin/src/App.tsx` [MODIFY] - perluas objek tema antd (token global + `components`).
- `admin/src/main.tsx` [MODIFY] - import `index.css` admin.
- `admin/src/index.css` [NEW] - stylesheet global admin (font, scrollbar, finishing, util dropzone).
- `admin/src/components/asset-uploader.tsx` [NEW] - komponen `Upload.Dragger` reusable.
- `admin/src/pages/assets.tsx` [MODIFY] - pakai `AssetUploader` untuk preview/file/GLB.
- `admin/src/pages/bundles.tsx` [MODIFY] - penyesuaian visual bila perlu.
- `admin/src/pages/plans.tsx` [MODIFY] - penyesuaian visual bila perlu.
- `admin/src/pages/users.tsx` [MODIFY] - penyesuaian visual bila perlu.
- `admin/src/pages/credit-packs.tsx` [MODIFY] - penyesuaian visual bila perlu.
- `admin/src/pages/ai-providers.tsx` [MODIFY] - penyesuaian visual bila perlu.
- `admin/src/pages/usage.tsx` [MODIFY] - penyesuaian visual bila perlu.
- `admin/src/pages/sessions.tsx` [MODIFY] - penyesuaian visual bila perlu.
- `admin/src/pages/audit-logs.tsx` [MODIFY] - penyesuaian visual bila perlu.
- `admin/package.json` [MODIFY] - tambah dependency `@fontsource/*` bila belum ada.

## Notes

- Stack admin tetap Refine + Ant Design (AI-RULES §2). Penyelarasan tema dilakukan lewat token antd + CSS global, BUKAN mengganti ke Tailwind/shadcn.
- Sidebar (`ThemedLayoutV2` sider) final: jangan ubah menu, urutan, atau strukturnya. Warna sider boleh ikut menyesuaikan token surface agar tidak kontras dengan tema baru, tanpa mengubah tata letak.
- Kontrak endpoint upload `/api/admin/uploads?kind=preview|file` tidak diubah; uploader hanya lapisan UI.
- Batas ukuran/format file mengikuti `FILE_ACCEPT` yang sudah ada; hint di dropzone harus mencerminkannya.
- Referensi token: `DESIGN.md` §2 (warna), §3 (tipografi), §4 (radius/shadow), §6.4 (input/form), §6.5 (modal/dropzone), §7.6 (Admin).
- Hormati `prefers-reduced-motion` untuk animasi hover/transition (DESIGN.md §9-10).
- Larangan gaya: tanpa em-dash, tanpa kata "feat"/"phase" di dokumen, commit, dan PR (AI-RULES §8).
