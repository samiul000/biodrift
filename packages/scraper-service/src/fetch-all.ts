import { readFileSync, writeFileSync, existsSync } from "fs";
import { join } from "path";
import dotenv from "dotenv";

dotenv.config({ path: join(import.meta.dirname, "..", "..", "..", ".env") });

const DATA_DIR = join(import.meta.dirname, "..", "data", "raw");

const COLLECTORS = {
  centerwatch: {
    id: process.env.BRIGHTDATA_COLLECTOR_CW || "",
    inputs: [{ url: "https://www.centerwatch.com/clinical-trials/listings" }],
  },
  isrctn: {
    id: process.env.BRIGHTDATA_COLLECTOR_ISRCTN || "",
    inputs: [{ url: "https://www.isrctn.com/search?q=cancer" }],
  },
  cancer_research_uk: {
    id: process.env.BRIGHTDATA_COLLECTOR_CRUK || "",
    inputs: [{ url: "https://www.cancerresearchuk.org/about-cancer/find-a-clinical-trial/clinical-trials-search" }],
  },
  drug_approvals: {
    id: process.env.BRIGHTDATA_COLLECTOR_DRUGS || "",
    inputs: [{ url: "https://www.drugs.com/newdrugs.html" }],
  },
};

const API_BASE = "https://api.brightdata.com/dca";
const AUTH_HEADER = { Authorization: `Bearer ${process.env.BRIGHTDATA_API_TOKEN}` };

async function triggerCollector(collectorId: string, inputs: unknown[]): Promise<string> {
  const url = `${API_BASE}/trigger?collector=${collectorId}&queue_next=1`;
  const res = await fetch(url, {
    method: "POST",
    headers: { ...AUTH_HEADER, "Content-Type": "application/json" },
    body: JSON.stringify(inputs),
  });

  const body = await res.json();

  if (!res.ok) {
    throw new Error(`Trigger failed (${res.status}): ${JSON.stringify(body)}`);
  }

  return body.collection_id;
}

async function pollDataset(snapshotId: string, maxAttempts = 240): Promise<unknown> {
  const url = `${API_BASE}/dataset?id=${snapshotId}`;

  for (let i = 0; i < maxAttempts; i++) {
    try {
      const res = await fetch(url, { headers: AUTH_HEADER });
      const body = await res.json();

      if (Array.isArray(body)) {
        return body;
      }

      if (i % 12 === 0) {
        console.log(`[fetch]   Still collecting... (attempt ${i + 1}/${maxAttempts})`);
      }
    } catch (e) {
      // ignore transient errors
    }
    await new Promise((r) => setTimeout(r, 5000));
  }

  return null;
}

async function fetchFromAPI(name: string, collectorId: string, inputs: unknown[]) {
  console.log(`[fetch] Triggering ${name} (collector: ${collectorId})...`);
  const snapshotId = await triggerCollector(collectorId, inputs);
  console.log(`[fetch]   Snapshot: ${snapshotId}`);

  const result = await pollDataset(snapshotId);
  const outPath = join(DATA_DIR, `${name}.json`);

  if (Array.isArray(result) && result.length > 0) {
    writeFileSync(outPath, JSON.stringify(result, null, 2));
    console.log(`[fetch] ${name} → ${outPath} (${result.length} records)`);
  } else {
    console.log(`[fetch] ${name} → No data yet (batch still processing)`);
  }
}

function loadMock(name: string) {
  const mockPath = join(DATA_DIR, `${name}.json`);
  if (!existsSync(mockPath)) {
    console.error(`[fetch] Mock file missing: ${mockPath}`);
    process.exit(1);
  }
  console.log(`[fetch] Loaded mock: ${name}`);
}

async function main() {
  const useMock = process.env.USE_MOCK_DATA !== "false";
  console.log(`[fetch] Mode: ${useMock ? "MOCK" : "LIVE API"}`);

  if (useMock) {
    for (const name of Object.keys(COLLECTORS)) loadMock(name);
  } else {
    const results: PromiseSettledResult<void>[] = [];

    for (const [name, { id, inputs }] of Object.entries(COLLECTORS)) {
      if (!id) {
        console.warn(`[fetch] Skipping ${name} — no collector ID set`);
        continue;
      }
      results.push(
        fetchFromAPI(name, id, inputs).then(() => {}).catch((e) => {
          console.error(`[fetch] ${name} failed: ${e.message}`);
        }) as Promise<void>
      );
    }

    await Promise.allSettled(results);
  }
  console.log("[fetch] Done.");
}

main().catch(console.error);
