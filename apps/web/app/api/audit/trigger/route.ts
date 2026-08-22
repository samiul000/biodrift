import { NextResponse } from "next/server";
import { writeFileSync, readFileSync } from "fs";
import { join } from "path";

// ponytail: manual .env parse because Next.js only auto-loads apps/web/.env,
// and the token lives at the monorepo root. Swap to dotenv if more vars needed.
function loadApiToken(): string | undefined {
  if (process.env.BRIGHTDATA_API_TOKEN) return process.env.BRIGHTDATA_API_TOKEN;
  try {
    const raw = readFileSync(
      join(process.cwd(), "..", "..", ".env"),
      "utf-8"
    );
    return raw
      .split("\n")
      .find((l) => l.startsWith("BRIGHTDATA_API_TOKEN="))
      ?.split("=")[1]
      .trim();
  } catch {
    return undefined;
  }
}

const DATA_DIR = join(
  process.cwd(),
  "..",
  "..",
  "packages",
  "scraper-service",
  "data",
  "raw"
);

const COLLECTOR_CONFIG: Record<string, { id: string; url: string }> = {
  centerwatch: {
    id: "c_mt0jn6u0286pl2z2e1",
    url: "https://www.centerwatch.com/clinical-trials/listings",
  },
  isrctn: { id: "c_mt0284ap2o0gyzcbtt", url: "https://www.isrctn.com/search?q=cancer" },
  cancer_research_uk: {
    id: "c_mt01zjnf18cajob88f",
    url: "https://www.cancerresearchuk.org/about-cancer/find-a-clinical-trial/clinical-trials-search",
  },
  drug_approvals: { id: "c_mt01u66kqoea0u2bm", url: "https://www.drugs.com/newdrugs.html" },
};

const API_BASE = "https://api.brightdata.com/dca";

async function triggerCollector(
  collectorId: string,
  url: string,
  token: string
): Promise<string> {
  const res = await fetch(`${API_BASE}/trigger?collector=${collectorId}&queue_next=1`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify([{ url }]),
  });
  const body = await res.json();
  if (!res.ok) throw new Error(`Trigger failed (${res.status}): ${JSON.stringify(body)}`);
  return body.collection_id;
}

async function pollDataset(
  snapshotId: string,
  token: string,
  maxAttempts = 240
): Promise<unknown[]> {
  for (let i = 0; i < maxAttempts; i++) {
    try {
      const res = await fetch(`${API_BASE}/dataset?id=${snapshotId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const body = await res.json();
      if (Array.isArray(body)) return body;
    } catch {}
    // ponytail: adaptive backoff — 3s early, 10s cap. Fast first response, less API churn later.
    const delay = Math.min(3000 + i * 200, 10000);
    await new Promise((r) => setTimeout(r, delay));
  }
  return [];
}

async function healCollector(
  name: string,
  config: { id: string; url: string },
  token: string
): Promise<{ name: string; ok: boolean; records: number; message: string }> {
  try {
    const snapshotId = await triggerCollector(config.id, config.url, token);
    const data = await pollDataset(snapshotId, token);

    if (Array.isArray(data) && data.length > 0) {
      writeFileSync(join(DATA_DIR, `${name}.json`), JSON.stringify(data, null, 2));
      return { name, ok: true, records: data.length, message: `${name} (${data.length} records)` };
    }

    return { name, ok: false, records: 0, message: `${name} (empty)` };
  } catch (e: any) {
    return { name, ok: false, records: 0, message: `${name} (error: ${e.message})` };
  }
}

export async function POST(req: Request) {
  const { collector } = await req.json();
  const token = loadApiToken();

  if (!token) {
    return NextResponse.json(
      { error: "BRIGHTDATA_API_TOKEN not set" },
      { status: 500 }
    );
  }

  // Determine which collectors to heal: specific one, or all drifted
  const targets = collector
    ? { [collector]: COLLECTOR_CONFIG[collector] }
    : COLLECTOR_CONFIG;

  const invalidKeys = Object.keys(targets).filter((k) => !COLLECTOR_CONFIG[k]);
  if (invalidKeys.length) {
    return NextResponse.json(
      { error: `Unknown collector(s): ${invalidKeys.join(", ")}. Valid: ${Object.keys(COLLECTOR_CONFIG).join(", ")}` },
      { status: 400 }
    );
  }

  // Fire all collectors in parallel
  const results = await Promise.all(
    Object.entries(targets).map(([name, config]) => healCollector(name, config, token))
  );

  const healed = results.filter((r) => r.ok);
  const failed = results.filter((r) => !r.ok);

  let message: string;
  if (healed.length === results.length) {
    message = `Healed all ${healed.length} collectors: ${healed.map((r) => r.message).join(", ")}.`;
  } else if (healed.length > 0) {
    message = `Healed ${healed.length}/${results.length} collectors: ${healed.map((r) => r.message).join(", ")}. ${failed.map((r) => r.message).join(", ")}.`;
  } else {
    message = "Collector returned empty results — batch may still be processing. Try again shortly.";
  }

  return NextResponse.json({
    ok: healed.length > 0,
    healed: healed.length,
    total: results.length,
    message,
  });
}
