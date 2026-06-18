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

| Modul | Deskripsi | AI |
| :--- | :--- | :---: |
| **🖼️ Scene Editor** | Editor visual 2D berbasis canvas & layer untuk materi promosi. Dilengkapi panel AI untuk generate image & video dari mockup. | ✅ |
| **📦 3D Editor** | Editor mockup produk 3D: UV design placement, warna material, kamera, grain, render image & video. | ❌ |
| **🛒 Asset Store** | Marketplace aset kreatif (Fonts, 3D Mockups, Mockups, 3D Assets, Graphic Packs) + Bundle Builder. | — |

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

| Layer | Teknologi |
| :--- | :--- |
| **Runtime** | Bun |
| **Frontend** | Vite + React 19 + TypeScript (SPA) + React Router |
| **Styling** | Tailwind CSS v4 + shadcn/ui |
| **State** | Zustand + TanStack Query |
| **2D / 3D** | Konva · React Three Fiber |
| **API** | Elysia (Bun) |
| **Database** | PostgreSQL + Drizzle ORM |
| **Admin** | Refine |
| **Queue** | BullMQ + Redis |
| **Storage** | Cloudflare R2 |
| **Payment** | Pakasir (ID) · Stripe (global) |
| **Deploy** | Docker Compose |

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

> Prasyarat: [Bun](https://bun.sh) (latest), [Docker](https://www.docker.com) + Docker Compose.

```bash
# 1. Install dependencies (dari root)
bun install

# 2. Siapkan environment
cp .env.example .env
#    lalu isi nilai DATABASE_URL, JWT_SECRET, R2, Pakasir, Stripe, SMTP, KIE_AI_API_KEY, dll

# 3. Jalankan semua service via Docker
docker compose up --build
```

| Service | URL (default) |
| :--- | :--- |
| 🌐 Client | http://localhost |
| ⚙️ API | http://localhost/api |
| ❤️ Healthcheck | http://localhost/api/health |

### Development (tanpa Docker)

```bash
bun run dev          # jalankan client + api + worker bersamaan
bun run typecheck    # cek tipe lintas workspace
bun run lint         # lint lintas workspace
```

---

## 🚢 Deployment (Produksi)

> Semua service berjalan via Docker Compose. Pastikan `.env` terisi lengkap sebelum deploy.

```bash
# 1. Siapkan environment produksi
cp .env.example .env
#    Wajib diisi: DATABASE_URL, REDIS_URL, JWT_SECRET, ENCRYPTION_KEY
#    Gateway: PAKASIR_API_KEY + PAKASIR_WEBHOOK_SECRET, STRIPE_SECRET_KEY + STRIPE_WEBHOOK_SECRET
#    Storage: STORAGE_DRIVER=r2 + R2_* ; AI: KIE_AI_API_KEY

# 2. Build & jalankan seluruh stack
docker compose up --build -d

# 3. Migrasi schema & seed data awal (plans, credit packs, admin)
docker compose exec api bun run db:migrate
docker compose exec api bun run db:seed

# 4. Jalankan data retention (terjadwal, mis. cron harian)
docker compose exec api bun run src/scripts/retention.ts
```

**Catatan penting:**
- **Gateway pembayaran**: tanpa kredensial, sistem memakai `StubGateway` (simulasi). Isi env Pakasir/Stripe untuk mengaktifkan pembayaran nyata. Daftarkan URL webhook `POST /api/billing/webhook/:gateway` di dashboard gateway.
- **Webhook diverifikasi server-side** (signature) sebelum order menjadi `paid`. Grant credit/lisensi/langganan bersifat idempoten.
- **Rate limit** aktif pada endpoint sensitif. Untuk multi-instance, pindahkan store rate limit ke Redis.
- **Retention**: data project dihapus 30 hari setelah langganan berakhir. Jadwalkan `src/scripts/retention.ts`.

---

## 🗺️ Roadmap

| | Milestone | Fokus |
| :---: | :--- | :--- |
| `M0` | Foundation & Tooling | Monorepo, Docker, tooling |
| `M1` | Core Backend & Data | Drizzle schema, API, auth |
| `M2` | App Shell & Design System | Layout, sidebar, tokens |
| `M3` | Admin Panel | CRUD katalog + admin custom |
| `M4` | Asset Store & Marketplace | Catalog, bundle builder |
| `M5` | Scene Editor (2D) | Konva editor |
| `M6` | 3D Editor | React Three Fiber |
| `M7` | AI System | Provider registry, job queue |
| `M8` | Billing & Release | Plans, credit, payment |

---

## 📄 License

Proprietary — © 2026 Nesomn Studio. All rights reserved.

<div align="center">
<br/>

**Made with ☕ & 🎨 by Nesomn Studio**

</div>
