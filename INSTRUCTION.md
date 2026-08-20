You are an expert Full-Stack Engineer and Data Pipelines Architect. We are building **BioDrift** — an autonomous clinical trial and drug patent cliff sentinel for the Bright Data "Into the Scrape-Verse" Hackathon.

### Project Mission & Architecture

BioDrift continuously monitors niche regional clinical trial registries and regulatory portals across 4 key sources:

1. **EU Clinical Trials Register (EU-CTR)** (Regional protocols & phase data)
2. **Health Canada Clinical Trials Database** (Government trial authorized data)
3. **CenterWatch** (Disease-specific clinical listings)
4. **European Medicines Agency (EMA)** (Authorized medicines, active substances & loss-of-exclusivity/patent dates)

The system uses **Bright Data Scraper Studio (CLI & API)** for data collection, stores raw collector snapshots in `packages/scraper-service/data/raw/`, validates the schemas using Zod, and executes an autonomous self-healing loop via `bdata scraper heal` on schema drift. It then merges trial records with EMA patent dates using normalized active substance names.

Stack:

- **Framework**: Next.js 14 (App Router), TypeScript, Tailwind CSS, Lucide-react, Tremor / Recharts
- **Backend & Data**: Node.js / TypeScript, Zod for strict schema validation, Local JSON database / Prisma
- **Scraping & Healing**: Bright Data Scraper Studio (`@brightdata/cli`), Collector API (`https://api.brightdata.com/dca/trigger`), Autonomous `bdata scraper heal` daemon
- **Analytics**: Zero-cost Rule-Based correlation engine for Loss of Exclusivity (LOE) countdown, Generic Competitor Pressure, and Life-Cycle Evergreening Defense.

---

### Implementation Requirements

#### 1. Strict Contract Schemas (`packages/scraper-service/src/schema.ts`)

Define Zod validation schemas for all 4 raw sources and the unified models:

- **`RawEUCTRSchema`**: `eudraCtNumber`, `trialTitle`, `medicalCondition`, `trialPhase`, `sponsorName`, `trialStatus`.
- **`RawHealthCanadaSchema`**: `controlNumber`, `medicinalIngredient`, `trialPhase`, `medicalCondition`, `sponsorName`, `statusDate`.
- **`RawCenterWatchSchema`**: `studyTitle`, `therapeuticArea`, `drugName`, `phase`, `enrollmentStatus`, `sponsor`.
- **`RawEMASchema`**: `tradeName`, `activeSubstance`, `authHolder`, `authDate`, `patentExpiryDate`, `therapeuticArea`.
- **`NormalizedTrialSchema`**: `trialId`, `source`, `brandName`, `activeSubstance`, `indication`, `phase`, `status`, `sponsor`, `completionDate`.
- **`PatentCliffReportSchema`**: `activeSubstance`, `tradeName`, `authHolder`, `patentExpiryDate`, `daysToCliff`, `cliffStatus`, `originatorDefenseTrials`, `genericCompetitorTrials`, `threatLevel`, `insights`.

#### 2. Ingestion & Scraper Studio Runner (`packages/scraper-service/src/fetch-all.ts`)

- Build a fetcher script that triggers collectors via Bright Data REST API (`POST /dca/trigger?collector={id}` & polling `/dca/get_result?response_id={id}`) OR runs CLI commands (`bdata scraper run <collector_id>`).
- Save the extracted payloads directly to:
  - `packages/scraper-service/data/raw/euctr.json`
  - `packages/scraper-service/data/raw/health_canada.json`
  - `packages/scraper-service/data/raw/centerwatch.json`
  - `packages/scraper-service/data/raw/ema.json`
- Fallback mode: Include realistic mock seed files in `data/raw/` so the system functions immediately offline or with `USE_MOCK_DATA=true`.

#### 3. Autonomous Self-Healing Daemon (`packages/scraper-service/src/heal.agent.ts`)

- Ingest each raw JSON payload and validate against its corresponding Zod schema.
- If field extraction errors or empty arrays occur (>30% missing critical fields):
  - Formulate an automated diagnostic prompt detailing the failed selector/field (e.g., `"Field 'medicalCondition' missing from table rows."`).
  - Execute child process: `npx @brightdata/cli scraper heal <collectorId> "<diagnostic prompt>"`.
  - Log the event with status `AUTO_HEALED`, timestamp, prior error diff, and collector ID to a health history log file.

#### 4. Unified Correlation Pipeline (`packages/scraper-service/src/combine-pipeline.ts`)

- Implement `sanitizeMoleculeName(name: string): string` to normalize drug names (e.g. `"Keytruda (pembrolizumab)"` -> `"pembrolizumab"`).
- Normalize all 3 clinical trial sources into a unified trial list.
- Cross-reference the unified trial list with the EMA dataset using normalized `activeSubstance`.
- Compute:
  1. `daysToCliff`: Days remaining until `patentExpiryDate`.
  2. `cliffStatus`: `CRITICAL_CLIFF` if <= 730 days (2 years), `APPROACHING` if <= 1460 days, else `SECURE`.
  3. `genericCompetitorTrials`: Count of Phase 3 trials conducted by non-originator sponsors.
  4. `originatorDefenseTrials`: Count of new trials run by the patent holder to extend indication coverage.
  5. `insights`: Actionable, rule-generated summary strings.
- Export unified results to `apps/web/data/unified_dashboard_data.json`.

#### 5. Next.js 14 Dashboard UI (`apps/web/`)

Create a dark-mode biotech intelligence interface:

- **`app/dashboard/page.tsx`**:
  - Summary metrics: Total Trials Tracked, Active Patent Cliffs (<24mo), Generic Competitor Alerts, System Health (99.8%).
  - Multi-source Trial Explorer: Table/cards of normalized trials filterable by Source Registry (EU-CTR, Health Canada, CenterWatch), Phase, and Status.
- **`app/patent-cliffs/page.tsx`**:
  - Exclusivity countdown cards showing: Trade Name, Active Substance, Holder, Exclusivity progress bar, Defending Trials vs. Competitor Threats, and Sentinel Insights.
- **`app/sentinel-health/page.tsx` (Hackathon Showcase Track)**:
  - Scraper Health Matrix for all 4 collectors (`c_euctr_*`, `c_hc_*`, `c_cw_*`, `c_ema_*`).
  - Real-time audit log of healing events.
  - **"Simulate DOM Drift & Heal" interactive button**: Injects malformed HTML, triggers the healing daemon, and updates UI status badges from `🟢 Healthy` -> `🟡 Healing` -> `🟢 Auto-Healed`.

---

### Output Requirements:

1. Provide complete, working code for all schemas, data pipelines, correlation algorithms, and Next.js components.
2. Provide realistic mock data files for the 4 portals so the repository is turnkey and testable out of the box.
3. Include an `.env.example` file and run scripts in `package.json` (`npm run fetch`, `npm run combine`, `npm run dev`).
