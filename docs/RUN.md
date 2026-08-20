# RUN.md — BioDrift Command Reference

All commands run from the project root (`biodrift/`).

---

## Core Pipeline

| Command | What It Does |
|---|---|
| `npm run fetch` | Triggers Bright Data collectors (mock or live) and saves raw JSON to `packages/scraper-service/data/raw/` |
| `npm run seed` | Validates raw JSON against Zod schemas and populates the Prisma SQLite database |
| `npm run combine` | Runs the correlation pipeline: normalizes trials, computes patent cliffs, writes `unified_dashboard_data.json` |
| `npm run heal` | Validates all collector schemas and auto-heals drift via `bdata scraper heal` if >30% field failures |

### Recommended Order

```bash
npm run seed      # 1. Populate database from raw mocks
npm run combine   # 2. Correlate and generate dashboard data
npm run dev       # 3. Start the UI
```

---

## Development

| Command | What It Does |
|---|---|
| `npm run dev` | Starts Next.js development server at `http://localhost:3000` |
| `npm run build` | Creates a production build of the Next.js app |
| `npm run studio` | Opens Prisma Studio for database inspection at `http://localhost:5555` |

---

## Database

| Command | What It Does |
|---|---|
| `npx prisma db push --schema=packages/scraper-service/prisma/schema.prisma` | Pushes schema changes to SQLite |
| `npx prisma generate --schema=packages/scraper-service/prisma/schema.prisma` | Regenerates Prisma client |
| `npx prisma studio --schema=packages/scraper-service/prisma/schema.prisma` | Opens database GUI |

---

## Bright Data CLI (Optional)

Only needed when `USE_MOCK_DATA=false`.

| Command | What It Does |
|---|---|
| `bdata scraper run <collectorId>` | Triggers a specific collector |
| `bdata scraper heal <collectorId> "<prompt>"` | Heals a broken collector with a diagnostic prompt |
| `bdata scraper create --name "<name>" --url "<url>"` | Creates a new collector |

### Example

```bash
bdata scraper run c_mszvsbuy20mtxa6lja
bdata scraper heal c_mszvsbuy20mtxa6lja "Re-extract trialStatus from updated DOM"
```

---

## Environment Variables

| Variable | Required | Description |
|---|---|---|
| `USE_MOCK_DATA` | Yes | `true` for offline demo, `false` for live scraping |
| `DATABASE_URL` | Yes | SQLite connection string (`file:./biodrift.db`) |
| `BRIGHTDATA_API_TOKEN` | Only live | Your Bright Data API token |
| `BRIGHTDATA_COLLECTOR_EUCTR` | Only live | EU-CTR collector ID |
| `BRIGHTDATA_COLLECTOR_HC` | Only live | Health Canada collector ID |
| `BRIGHTDATA_COLLECTOR_EMA` | Only live | EMA collector ID |

---

## Quick Demo (Offline)

```bash
npm install
npx prisma db push --schema=packages/scraper-service/prisma/schema.prisma
npm run seed
npm run combine
npm run dev
```

Open `http://localhost:3000` — no API keys needed.
