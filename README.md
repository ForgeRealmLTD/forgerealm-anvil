<p align="center">
  <img src="client/public/logo.png" alt="ForgeRealm Anvil" width="120" height="120" />
</p>

<h1 align="center">ForgeRealm Anvil</h1>

<p align="center">
  <strong>The internal tool ForgeRealm Ltd runs on.</strong><br/>
  Point of sale, Mini Mall stock reconciliation, and expenses — one navy &amp; gold app.
</p>

<p align="center">
  <img src="https://img.shields.io/badge/React-18-61DAFB?style=flat-square&logo=react&logoColor=white" alt="React" />
  <img src="https://img.shields.io/badge/TypeScript-5.9-3178C6?style=flat-square&logo=typescript&logoColor=white" alt="TypeScript" />
  <img src="https://img.shields.io/badge/Express-4-000000?style=flat-square&logo=express&logoColor=white" alt="Express" />
  <img src="https://img.shields.io/badge/PostgreSQL-Neon-4169E1?style=flat-square&logo=postgresql&logoColor=white" alt="PostgreSQL" />
  <img src="https://img.shields.io/badge/Tailwind-3.4-06B6D4?style=flat-square&logo=tailwindcss&logoColor=white" alt="Tailwind" />
  <img src="https://img.shields.io/badge/Framer_Motion-12-FF0055?style=flat-square&logo=framer&logoColor=white" alt="Framer Motion" />
</p>

---

## Overview

ForgeRealm Anvil is the single internal tool for running ForgeRealm Ltd (3D printing and
artisan maker business, Leeds). Three tabs, each a full area of the business:

| Tab | What it does |
|-----|--------------|
| **Point of Sale** | Live sales recording at market stalls and events — product grid, cart, cash/card, SumUp reconciliation, session analytics, XLSX/CSV exports. |
| **Mini Mall** | Bay MM12 at the Merrion Centre, where sales are reconciled from stock counts rather than till data. Models the monthly cycle (opening stock → restocks → closing count → derived units sold), a five-tier shelf with first-class bay positions (`MM12.14`), back stock, and a shelf heatmap showing which slots actually sell. |
| **Expenses** | Every pound out, by month and category — filament, pitch fees, the recurring MM12 shelf fee, equipment, packaging, software, compliance. Month-vs-month comparison and a twelve-month trend. Expenses tag to a channel so the Mini Mall tab pulls its shelf fee automatically. |

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18, TypeScript, Vite, Tailwind CSS, Framer Motion |
| Typography | Lora (display) + Poppins (UI) |
| Backend | Node.js, Express, TypeScript (tsx) |
| Database | PostgreSQL (Neon), numbered SQL migrations |
| Auth | JWT + bcrypt (single user) |
| Export | ExcelJS |
| Card payments | SumUp API (scheduled polling) |
| Hosting | Netlify — client + Express wrapped as a serverless function |
| Mobile | Capacitor (Android), offline read-cache + write queue |

## Getting Started

### Prerequisites

- Node.js 18+
- PostgreSQL database (or a [Neon](https://neon.tech) free tier)

### Setup

```bash
git clone https://github.com/IshmamDC217/forgerealm-anvil.git
cd forgerealm-anvil

# Install all dependencies (root, server, client)
npm run install:all

# Configure environment
cp .env.example server/.env
# Edit server/.env with your DATABASE_URL and JWT_SECRET
```

### Database

```bash
npm run migrate            # applies db/migrations/*.sql in order

cd server
npx tsx db/create-user.ts <username> <password>   # login credentials
npm run import:catalogue   # optional: creates the 50 MM12 bays with the real
                           # bay codes, names and prices at ZERO quantities, so
                           # you only type the counts. Safe to re-run.
```

### Development

```bash
npm run dev    # server on :3001, client on :5173
```

### Production

Deployed on Netlify: the build publishes `client/dist` and routes `/api/*` through
`netlify/functions/api.ts` (the Express app via `serverless-http`). A scheduled function
(`netlify/functions/sumup-poll.ts`) polls SumUp for card transactions.

| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | Neon PostgreSQL connection string |
| `JWT_SECRET` | Secret for signing JWT tokens |
| `ANVIL_ADMIN_USER` / `ANVIL_ADMIN_PASS` | Login credentials for `create-user` (legacy `POS_ADMIN_*` names still work) |
| `VITE_API_URL` | Absolute API URL for production/Capacitor builds |
| `CORS_ORIGIN` | Comma-separated allowed origins |

## API Areas

All routes live under `/api`, JWT-protected except `/auth/login` and `/health`:

- `/sessions`, `/groups`, `/sales`, `/products`, `/stock`, `/global-stock`, `/export`, `/sumup` — Point of Sale
- `/mini-mall` — slots, movements, monthly cycles, overview (shelf heatmap data)
- `/expenses` — expenses, categories, recurring templates, month summary

## Data Model Notes

- **Mini Mall stock is independent of POS stock.** `global_stock` is the central pool
  stalls draw from; `mm_slots` / `mm_back_stock` belong to bay MM12 only.
- **Units sold at the Mini Mall are derived**, not recorded: opening display + restocks
  during the month − closing display. Movements (`mm_movements`) are dated so the maths
  holds; months are opened and closed explicitly (`mm_months`, `mm_counts`).
- **Recurring expenses materialise on view** — no scheduler. A unique partial index
  guarantees one instance per template per month.
- Migrations are numbered SQL files in `server/db/migrations/`, applied once each and
  recorded in `schema_migrations`. They are additive — never destructive.

## Scripts

| Script | Description |
|--------|-------------|
| `npm run dev` | Start dev server + client |
| `npm run build` | Build client for production |
| `npm start` | Start production server |
| `npm run migrate` | Apply pending migrations |
| `npm run import:catalogue` | Create the MM12 bays from the real catalogue at zero stock |
| `npm run create-user` | Create a login user |

---

<p align="center">
  <img src="client/public/logo.png" alt="ForgeRealm" width="32" height="32" /><br/>
  <sub>Built by <strong>Ishmam Ahmed</strong> · ForgeRealm Ltd, Leeds</sub>
</p>
