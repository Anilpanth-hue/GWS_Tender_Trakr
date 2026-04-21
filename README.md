# GWS Tender Trakr

Internal AI-powered tender intelligence platform for Glasswing Solutions. Automatically scrapes Tender247, screens tenders against GWS business criteria (L1), and generates deep-dive AI analysis reports (L2) using Google Gemini.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 15 (App Router) |
| Database | MySQL 8 |
| AI | Google Gemini (via Genkit) |
| Scraping | Puppeteer |
| Auth | NextAuth.js |
| UI | Tailwind CSS + Framer Motion |

---

## Features

- **L1 Auto-Screening** — keyword/value rules filter hundreds of tenders down to relevant ones
- **L2 AI Analysis** — Gemini reads tender documents and produces scope, PQC, risk, BID/NO-BID reports
- **Manual Review Queue** — Accept / Reject qualified tenders with reason tracking
- **Scrape Scheduler** — Cron-based morning / afternoon scraping sessions
- **Settings UI** — Edit keywords, credentials and thresholds without code changes

---

## Setup

### 1. Clone & install

```bash
git clone <repo-url>
cd tender-trakr
npm install
```

### 2. Configure environment

```bash
cp .env.example .env.local
```

Edit `.env.local` with your values:

| Variable | Description |
|---|---|
| `NEXTAUTH_URL` | App URL (e.g. `http://localhost:3000`) |
| `NEXTAUTH_SECRET` | Random secret — run `openssl rand -base64 32` |
| `DB_HOST / DB_PORT / DB_USER / DB_PASSWORD / DB_DATABASE` | MySQL connection |
| `GEMINI_API_KEY` | Google AI Studio API key |
| `TENDER247_EMAIL / TENDER247_PASSWORD` | Tender247 account credentials |

### 3. Create the database

```bash
npm run db:migrate
```

### 4. Run in development

```bash
# Next.js web app
npm run dev

# Scraping server (separate terminal)
npm run dev:scraper
```

---

## Production Deployment

### Build

```bash
npm run build
npm start
```

### Scraping server

The scraping server (`src/scraping-server/`) runs as a separate Node process alongside Next.js:

```bash
npm run start:scraper
```

> **Note:** The scraping server requires Puppeteer and a Chromium installation. On Linux servers, install the required dependencies for Puppeteer headless Chrome.

### Environment checklist before going live

- [ ] `NEXTAUTH_SECRET` is a strong random value (not the default)
- [ ] `NEXTAUTH_URL` points to the production domain
- [ ] Database is on a managed instance (RDS, PlanetScale, etc.)
- [ ] Gemini API key has appropriate quota limits set
- [ ] Server has sufficient RAM for Puppeteer (~512 MB minimum)

---

## Project Structure

```
src/
├── app/
│   ├── (app)/          # Authenticated pages (Dashboard, Tenders, Analysis, etc.)
│   └── api/            # REST API routes
├── lib/
│   ├── ai/             # Gemini analysis logic
│   ├── db/             # MySQL query helpers
│   ├── scraper/        # Puppeteer scraper (Tender247)
│   └── screening/      # L1 keyword/rule screening
├── scraping-server/    # Standalone cron + scrape job runner
└── types/              # Shared TypeScript types
scripts/
├── setup-db.ts         # DB schema creation / migration
└── migrate.ts          # Migration runner
```

---

## Database

Run migrations:

```bash
npm run db:migrate        # Apply all pending migrations
npm run db:migrate:down   # Roll back last migration
```

---

*Built by Glasswing Solutions — Internal use only*
