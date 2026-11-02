<div align="center">

# 🎨 Nesomn Studio

### Create. Customize. Publish.

**Creative studio platform** berbasis web yang menggabungkan **Scene Editor (2D)**, **3D Editor**, dan **Asset Store** dalam satu ekosistem terintegrasi.

<br/>

[![Bun](https://img.shields.io/badge/Bun-000000?style=for-the-badge&logo=bun&logoColor=white)](https://bun.sh)
[![React](https://img.shields.io/badge/React_19-20232A?style=for-the-badge&logo=react&logoColor=61DAFB)](https://react.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org)
[![Vite](https://img.shields.io/badge/Vite-646CFF?style=for-the-badge&logo=vite&logoColor=white)](https://vite.dev)
[![Elysia](https://img.shields.io/badge/Elysia-0F172A?style=for-the-badge&logo=elysia&logoColor=white)](https://elysiajs.com)

[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-4169E1?style=for-the-badge&logo=postgresql&logoColor=white)](https://www.postgresql.org)
[![Drizzle](https://img.shields.io/badge/Drizzle_ORM-C5F74F?style=for-the-badge&logo=drizzle&logoColor=black)](https://orm.drizzle.team)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_v4-06B6D4?style=for-the-badge&logo=tailwindcss&logoColor=white)](https://tailwindcss.com)
[![Docker](https://img.shields.io/badge/Docker-2496ED?style=for-the-badge&logo=docker&logoColor=white)](https://www.docker.com)

<br/>

[![Status](https://img.shields.io/badge/status-in_development-F59E0B?style=flat-square)](#)
[![License](https://img.shields.io/badge/license-proprietary-EF4444?style=flat-square)](#)
[![PRs](https://img.shields.io/badge/PRs-by_invitation-3B5BFF?style=flat-square)](#)

<br/>

</div>

---

## ✨ Overview

Nesomn Studio menghadirkan satu platform untuk seluruh kebutuhan **visual marketing** — dari pembuatan mockup produk, penyusunan materi promosi, hingga akses marketplace aset kreatif yang langsung dapat dipakai di dalam editor. Dirancang untuk **brand, kreator, agensi, dan bisnis digital**.

> Terasa seperti **Creative Studio Platform**, bukan sekadar aplikasi mockup atau editor desain biasa.

---

## 🧩 Core Modules

| Modul               | Deskripsi                                                                                                                    | AI  |
| :------------------ | :--------------------------------------------------------------------------------------------------------------------------- | :-: |
| **🖼️ Scene Editor** | Editor visual 2D berbasis canvas & layer untuk materi promosi. Dilengkapi panel AI untuk generate image & video dari mockup. | ✅  |
| **📦 3D Editor**    | Editor mockup produk 3D: UV design placement, warna material, kamera, grain, render image & video.                           | ❌  |
| **🛒 Asset Store**  | Marketplace aset kreatif (Fonts, 3D Mockups, Mockups, 3D Assets, Graphic Packs) + Bundle Builder.                            |  —  |

---

## 🚀 Features

- 🎨 **Scene Editor 2D** — add, duplicate, delete, change color, export PNG/JPEG
- 🤖 **AI Generation** — image (Scene tab) & video (Motion tab) dari mockup, via provider modular
- 🧊 **3D Editor** — UV placement, material & background, grain effect, camera preset, render ≤1080p
- 🏬 **Marketplace** — katalog, filter, search, lisensi & download
- 🎁 **Bundle Builder** — diskon bertingkat otomatis
- 💳 **Subscription & Credits** — plan bertingkat, credit ledger, top-up, usage admin-configurable
- 🛠️ **Admin Panel** — CRUD katalog, provider AI, usage, session & subscription management

---

## 🏗️ Tech Stack

<div align="center">

| Layer        | Teknologi                                         |
| :----------- | :------------------------------------------------ |
| **Runtime**  | Bun                                               |
| **Frontend** | Vite + React 19 + TypeScript (SPA) + React Router |
| **Styling**  | Tailwind CSS v4 + shadcn/ui                       |
| **State**    | Zustand + TanStack Query                          |
| **2D / 3D**  | Konva · React Three Fiber                         |
| **API**      | Elysia (Bun)                                      |
| **Database** | PostgreSQL + Drizzle ORM                          |
| **Admin**    | Refine                                            |
| **Queue**    | BullMQ + Redis                                    |
| **Storage**  | Cloudflare R2                                     |
| **Payment**  | Pakasir (ID) · Stripe (global)                    |
| **Deploy**   | Docker Compose                                    |

</div>

---

## 📦 Project Structure

```
nesomn-studio-website/
├── client/            # Vite + React SPA (public, editor, account)
├── admin/             # Refine admin panel
├── api/               # Elysia + Drizzle (REST API)
├── worker/            # BullMQ worker (AI jobs)
├── packages/shared/   # Tipe & kontrak bersama
└── docker-compose.yml
```

---

## 🛠️ Getting Started

> Prasyarat: [Bun](https://bun.com) **1.4.4**, Node.js **24.18.0** untuk tooling, [Docker](https://www.docker.com) + Docker Compose. Lihat [runtime terpin dan aktivasi Windows](docs/runtime.md).

```bash
# 1. Install dependencies (dari root)
bun install --frozen-lockfile

# 2. Siapkan environment
cp .env.example .env
#    lalu isi nilai DATABASE_URL, JWT_SECRET, R2, Pakasir, Stripe, SMTP, KIE_AI_API_KEY, dll

# 3. Periksa toolchain dan build
bun run typecheck
bun run lint
bun run build
```

| Service      | URL (default)                      |
| :----------- | :--------------------------------- |
| 🌐 Client    | http://127.0.0.1:8080              |
| 🛠️ Admin     | http://127.0.0.1:8080/admin/       |
| ⚙️ API       | http://127.0.0.1:8080/api          |
| ❤️ Readiness | http://127.0.0.1:8080/health/ready |

### Development (tanpa Docker)

`.env.example` sekarang template production. Untuk development, set NODE_ENV=development, CLIENT_URL=http://localhost:5173 dan ADMIN_URL=http://localhost:5174 serta DB/Redis development sendiri. Periksa env per-workspace existing juga; jangan gunakan production sebagai test environment.

```bash
bun run dev          # jalankan client + api + worker bersamaan
bun run typecheck    # cek tipe lintas workspace
bun run lint         # lint lintas workspace
```

---

## 🚢 Deployment (Produksi)

Compose utama memiliki tepat **app + gateway**. App Bun melayani API `/api`, client SPA dan admin `/admin/`; hanya gateway dipublish ke loopback port 8080 secara default. PostgreSQL/Redis/storage dan worker AI dikelola terpisah. Root Dockerfile target app/worker menggantikan empat Dockerfile legacy. Ikuti [runbook deployment](docs/deployment.md) untuk env, network existing, backup/schema/migration eksplisit, build, TLS, health dan startup; [runbook worker](docs/workers.md) untuk consumer independen. Jangan menjalankan startup production sebelum persiapan tersebut.

Audit menemukan gap keamanan pada provider pembayaran legacy/stub dan integritas settlement/credits. Pin runtime serta baseline test yang lulus belum menutup gap tersebut; perbaikan ada pada fase 4-5. Jangan menganggap webhook/fulfillment production-ready berdasarkan deskripsi fitur lama. Tidak ada migration, reset atau seed otomatis ditambahkan. Upgrade schema existing perlu backup dan pemeriksaan schema terlebih dahulu.

Lihat [audit awal](docs/revision/phase-1-audit.md), [hasil fase 2](docs/revision/phase-2-report.md), [hasil fase 3](docs/revision/phase-3-report.md), [runtime/build](docs/runtime.md), dan [pengujian disposable](docs/testing.md). Pengujian tidak menggunakan DB atau merchant production. Adapter QRIS fase5 tersedia dengan aktivasi default OFF; UI monokrom-orange masih fase6.

---

## 🗺️ Roadmap

|      | Milestone                 | Fokus                        |
| :--: | :------------------------ | :--------------------------- |
| `M0` | Foundation & Tooling      | Monorepo, Docker, tooling    |
| `M1` | Core Backend & Data       | Drizzle schema, API, auth    |
| `M2` | App Shell & Design System | Layout, sidebar, tokens      |
| `M3` | Admin Panel               | CRUD katalog + admin custom  |
| `M4` | Asset Store & Marketplace | Catalog, bundle builder      |
| `M5` | Scene Editor (2D)         | Konva editor                 |
| `M6` | 3D Editor                 | React Three Fiber            |
| `M7` | AI System                 | Provider registry, job queue |
| `M8` | Billing & Release         | Plans, credit, payment       |

---

## 📄 License

Proprietary — © 2026 Nesomn Studio. All rights reserved.

<div align="center">
<br/>

**Made with ☕ & 🎨 by Nesomn Studio**

</div>

## Fase 4: keamanan dan integritas bisnis

Fase4 menambahkan auth/session/origin, private asset/upload validation, credit accounts/lots, atomic settlement, durable SQL outbox dan worker claim/recovery. Production stub dan checkout legacy ditolak. Schema memerlukan migration aditif0004-0006 setelah backup/preflight eksplisit; tidak ada migrasi/seed pada boot. QRIS tetap fase5; desain monokrom-orange/shape UjiHub tetap fase6.

Baca [security dan migrasi](docs/security.md), [pengujian fase4](docs/testing-phase4.md), [laporan fase4](docs/revision/phase-4-report.md), serta [workers](docs/workers.md). Jangan memakai prosedur simulasi production fase3 sebagai kontrak terbaru. Seluruh hasil masih lokal dan bukan klaim platform production-ready.

## Fase 5: invoice dan receipt QRIS ShopeePay

Checkout asset/bundle/plan/top-up memakai server quote, kode unik terpisah dan invoice pending; QR ditampilkan setelah konfirmasi nominal. Status paid hanya dari receipt HMAC worker yang scoped/complete, dengan atomic fulfillment dan idempotency. SDK terpin/vendored pada worker independen, SQLite spool tahan retry/restart, bukan service Compose utama. Schema membutuhkan migration aditif0007 setelah backup/preflight. Legacy Stripe/Pakasir tetap histori asli dan tidak dibuka kembali untuk checkout.

**QRIS_ENABLED=false secara default.** Tidak ada token merchant atau transaksi live diuji. Nominal tidak dipakai ulang; kapasitas maksimal999 kode per harga dasar sepanjang histori (lebih kecil bila berbenturan). Sebelum aktivasi, operator wajib memverifikasi QR miliknya cocok dengan merchant/store, sesi dan live feed. Baca [runbook pembayaran/worker/cutover](docs/payments-qris.md), [laporan dan pengujian](docs/revision/phase-5-report.md), serta [bukti screenshot](docs/revision/artifacts/phase-5/). Tidak ada klaim seluruh platform siap produksi.

## Fase 6: fondasi visual dan tema

Token monokrom–orange, Bricolage Grotesque/Manrope self-hosted, original logo, light/dark/system client-admin, accessible mobile drawer dan UI primitives diterapkan. Referensi UjiHub dipakai untuk shape/hierarchy; public/store/account composition masih fase7. Browser menguji actual production assets pada lima viewport, tema, focus trap/recovery dan error state. Tidak mengubah renderer/scene/domain/API atau mengaktifkan merchant. Lihat [design system](docs/design-system.md), [laporan fase6](docs/revision/phase-6-report.md), [evidence](docs/revision/phase-6-evidence.json). Seluruh hasil lokal; bukan klaim platform production-ready.

## Fase7: public/store/auth/account

Home editorial, media-first catalog/gallery, login/register dengan API existing, server quote bundle, account/library/projects/error states dan history invoice diterapkan. Pengujian production gateway disposable membuktikan browse-register-buy-synthetic receipt-replay-Library/private download dan networkretry; tidak ada merchant live. [Laporan/batas bukti](docs/revision/phase-7-report.md), [evidence](docs/revision/phase-7-evidence.json). Independent reviewer unavailable (usage limit), bukan review CLEAN. Viewer3D/empatGLB tetap fase8; belum deploy/production-ready.

## Fase8: viewer3D dan sampleGLB

Route production /demo/3d berlabel Demo/Sample,4GLB original+poster/manifest/generator, bounded owned loader, adaptive framing dan preview controls tersedia. Editor memperbaiki model identity/reset/target mesh/material/recording cleanup, optional scene fields backward compatible. Actual Docker production assets diuji ChromeWebGL2 desktop/mobile viewport, repeated switching, PNG/JPEG/WebM decode; physical mobile/liveCORS belum dibuktikan.10container dan14image testing dihapus sesuai permintaan user. [Runbook](docs/viewer-3d.md), [laporan/bukti/batas](docs/revision/phase-8-report.md). Tidak commit/push/deploy atau klaim seluruh platform production-ready.

## Fase9: Scene 2D, AI dan admin

Workspace 2D responsif, layer/properties, export aman dan save selama edit diperbaiki tanpa mengubah format scene. AI memperjelas status/saldo/error, recovery dari server dan pembatalan khusus pending. Admin default resource dibetulkan, subscription/ledger read-only ditambahkan, upload preview baru memakai referensi stabil dengan guard publikasi. [As-built/runbook](docs/editor-admin.md), [laporan dan batas acceptance](docs/revision/phase-9-report.md). Pengujian memakai produksi assets, gateway Docker dan DB/provider disposable; tidak merchant live. Hasil acceptance phase10 dan gate live tersedia di docs/release-readiness.md.

## Phase10 — release acceptance

Gerbang lokal node scripts/release-check.mjs unit dan lab disposable mencakup install/audit/typecheck/lint/build, transaksi/roles/storage/jobs/QRIS, kedua editor, empat GLB dan browser admin/public. Audit66 advisory diremediasi ke nol pada snapshot723 paket; Drizzle/Sharp/Zod/tooling dan native REST adapter ditinjau serta diuji ulang. Bundle picker/membership kini tersambung dan atomik. Container/image testing dibersihkan otomatis.

[Laporan dan batas bukti](docs/revision/phase-10-report.md), [release runbook/NO-GO live](docs/release-readiness.md), [as-built](docs/as-built.md), [migration/recovery](docs/migrations.md), [dependency decisions](docs/dependency-security.md). Main Compose tetap tepat app/gateway. Tidak ada deploy atau transaksi merchant nyata; live credentials/restore/TLS/device acceptance tetap gate operator.

Deployment per container di Litepod (Podman/Caddy): lihat [runbook Litepod](docs/litepod.md) dan [hasil pengujian lokal](docs/revision/litepod-2026-11-02.md). Web/API/admin memakai satu container; AI/QRIS dan layanan data tetap independen.
