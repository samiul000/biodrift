# ARCHITECTURE.md — BioDrift System Design

## Overview

BioDrift is a monorepo with two workspace packages:

```
biodrift/
├── packages/scraper-service/    # Data ingestion, validation, correlation
└── apps/web/                    # Next.js 14 dashboard UI
```

---

## Data Flow

```mermaid
graph TD
    subgraph External["External Registries"]
        R1[EU-CTR]
        R2[Health Canada]
        R3[EMA]
    end

    subgraph Scraper["Bright Data Scraper Studio"]
        S1[Collector API]
        S2[CLI Runner]
    end

    subgraph Pipeline["Scraper Service"]
        F[fetch-all.ts]
        RAW[data/raw/*.json]
        Z[Zod Schema Validation]
        H[heal.agent.ts]
        C[combine-pipeline.ts]
        DB[(Prisma SQLite)]
    end

    subgraph UI["Next.js 14 Dashboard"]
        D[/dashboard]
        P[/patent-cliffs]
        S[/sentinel-health]
    end

    R1 --> S1
    R2 --> S1
    R3 --> S1
    S1 --> F
    S2 --> F
    F --> RAW
    RAW --> Z
    Z -->|Valid| C
    Z -->|Drift| H
    H -->|bdata scraper heal| S1
    C --> DB
    C --> JSON[unified_dashboard_data.json]
    JSON --> D
    JSON --> P
    DB --> S
```

---

## Package: `@biodrift/scraper-service`

### Purpose

Handles all data ingestion, validation, normalization, and correlation logic. Runs as Node.js scripts (not a server).

### Key Files

| File | Purpose |
|---|---|
| `src/schema.ts` | Zod validation schemas for all data models |
| `src/fetch-all.ts` | Triggers Bright Data collectors, saves raw JSON |
| `src/seed.ts` | Validates raw JSON and populates Prisma database |
| `src/combine-pipeline.ts` | Normalizes trials, computes patent cliffs, generates insights |
| `src/heal.agent.ts` | Validates schemas, auto-heals drift via `bdata scraper heal` |
| `prisma/schema.prisma` | Database schema (4 models) |

### Database Models

```
RawTrial          — Raw collector snapshots (source, recordId, data JSON)
NormalizedTrial   — Unified trial records across all sources
PatentCliff       — Computed cliff reports with threat levels
HealEvent         — Audit log of drift detection and repairs
```

### Pipeline Scripts

```
fetch-all.ts      → data/raw/{euctr,health_canada,ema}.json
seed.ts           → Prisma DB (RawTrial table)
combine-pipeline.ts → Prisma DB + apps/web/data/unified_dashboard_data.json
heal.agent.ts     → Prisma DB (HealEvent table)
```

---

## Package: `@biodrift/web`

### Purpose

Next.js 14 App Router dashboard for visualizing clinical trial intelligence and scraper health.

### Routes

| Route | Component | Purpose |
|---|---|---|
| `/dashboard` | `DashboardClient.tsx` | Summary metrics, trial explorer with filters |
| `/patent-cliffs` | `PatentCliffsClient.tsx` | Countdown cards, defense vs competitor charts |
| `/sentinel-health` | `SentinelHealthPage.tsx` | Collector health matrix, healing audit log, drift simulation |

### Data Loading

- **Server Components**: Read `unified_dashboard_data.json` at build time
- **Client Components**: Handle interactivity (filters, simulation buttons)
- **Charts**: Recharts library (BarChart, ResponsiveContainer)

### Theming

- Dark mode by default (`class="dark"` on `<html>`)
- Custom Tailwind colors: `bio-900` through `bio-100`
- Lucide React icons

---

## Schema Validation

All data flows through Zod schemas before processing:

```
Raw JSON → Schema.safeParse() → Valid: proceed | Invalid: log + heal
```

### Validation Rules

- All required fields must be non-empty strings
- Missing fields trigger `DRIFT_DETECTED` status
- >30% failure rate triggers autonomous healing

### Schema Types

```typescript
// Raw source schemas (input validation)
RawEUCTRSchema          { eudraCtNumber, trialTitle, medicalCondition, ... }
RawHealthCanadaSchema   { controlNumber, medicinalIngredient, trialPhase, ... }
RawEMASchema            { tradeName, activeSubstance, patentExpiryDate, ... }

// Unified schemas (output models)
NormalizedTrialSchema   { trialId, source, brandName, activeSubstance, ... }
PatentCliffReportSchema { activeSubstance, daysToCliff, cliffStatus, ... }
```

---

## Self-Healing Architecture

### Detection

1. Load raw JSON from `data/raw/`
2. Validate each record against its Zod schema
3. Calculate failure rate (`failures / totalRecords`)
4. If failure rate > 30%: trigger healing

### Repair

1. Generate diagnostic prompt from failed field names
2. Execute `bdata scraper heal <collectorId> "<prompt>"`
3. Log event to `HealEvent` table
4. Mark status as `AUTO_HEALED`

### UI Feedback

The Sentinel Health page shows real-time status badges:
- `🟢 Healthy` — All fields valid
- `🟡 Healing` — Drift detected, repair in progress
- `🟢 Auto-Healed` — Repair completed successfully

---

## Correlation Algorithm

### Step 1: Normalize Trials

Each source has a normalizer that maps raw fields to `NormalizedTrial`:

```typescript
// EU-CTR: Extract drug name from trial title
activeSubstance: r.trialTitle.match(/(?:of|for)\s+(.+?)(?:\s+in|\s+for|$)/i)?.[1]

// Health Canada: Extract brand from parenthetical
brandName: r.medicinalIngredient.match(/\((.+?)\)/)?.[1]
```

### Step 2: Sanitize Molecules

```typescript
sanitizeMoleculeName("Keytruda (pembrolizumab)") → "pembrolizumab"
sanitizeMoleculeName("adalimumab (Humira)")      → "adalimumab"
```

### Step 3: Cross-Reference

Match normalized trials to EMA patent data using sanitized molecule names:

```
EU-CTR trial (pembrolizumab) ↔ EMA patent (pembrolizumab)
Health Canada trial (semaglutide) ↔ EMA patent (semaglutide)
```

### Step 4: Compute Intelligence

For each EMA patent record:
1. `daysToCliff` — Days until `patentExpiryDate`
2. `cliffStatus` — CRITICAL_CLIFF / APPROACHING / SECURE
3. `genericCompetitorTrials` — Phase 3 trials by non-originator sponsors
4. `originatorDefenseTrials` — Trials by patent holder expanding indications
5. `threatLevel` — HIGH / MEDIUM / LOW / NONE
6. `insights` — Rule-generated action strings

---

## Offline Mode

When `USE_MOCK_DATA=true`:

1. `fetch-all.ts` loads pre-seeded JSON from `data/raw/`
2. No Bright Data API calls are made
3. Full pipeline runs locally
4. Dashboard displays mock data immediately

This allows hackathon judges to evaluate the system without API credentials.
