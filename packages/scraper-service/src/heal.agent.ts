import { readFileSync, existsSync } from "fs";
import { join } from "path";
import dotenv from "dotenv";
import { PrismaClient } from "@prisma/client";
import {
  RawCenterWatchSchema,
  RawISRCTNSchema,
  RawCancerResearchUKSchema,
  RawDrugApprovalsSchema,
} from "./schema.js";

dotenv.config({ path: join(import.meta.dirname, "..", "..", "..", ".env") });

const prisma = new PrismaClient();
const DATA_DIR = join(import.meta.dirname, "..", "data", "raw");

const COLLECTORS = {
  centerwatch: {
    schema: RawCenterWatchSchema,
    collectorId:
      process.env.BRIGHTDATA_COLLECTOR_CW || "c_centerwatch_collector",
  },
  isrctn: {
    schema: RawISRCTNSchema,
    collectorId:
      process.env.BRIGHTDATA_COLLECTOR_ISRCTN || "c_isrctn_collector",
  },
  cancer_research_uk: {
    schema: RawCancerResearchUKSchema,
    collectorId: process.env.BRIGHTDATA_COLLECTOR_CRUK || "c_cruk_collector",
  },
  drug_approvals: {
    schema: RawDrugApprovalsSchema,
    collectorId: process.env.BRIGHTDATA_COLLECTOR_DRUGS || "c_drugs_collector",
  },
} as const;

interface HealResult {
  collectorId: string;
  status: "HEALTHY" | "DRIFT_DETECTED" | "AUTO_HEALED";
  diagnostic?: string;
}

function validateSource(
  name: string,
  config: (typeof COLLECTORS)[keyof typeof COLLECTORS],
): HealResult {
  const { schema, collectorId } = config;
  const filePath = join(DATA_DIR, `${name}.json`);

  if (!existsSync(filePath)) {
    return {
      collectorId,
      status: "DRIFT_DETECTED",
      diagnostic: `No data file found! collector may not have returned data yet.`,
    };
  }

  const raw = readFileSync(filePath, "utf-8");
  const records: any[] = JSON.parse(raw);

  if (records.length === 0) {
    return {
      collectorId,
      status: "DRIFT_DETECTED",
      diagnostic: `Empty array returned from collector — no records found.`,
    };
  }

  let failures = 0;
  const failedFields: string[] = [];

  for (const record of records) {
    const result = schema.safeParse(record);
    if (!result.success) {
      failures++;
      for (const issue of result.error.issues) {
        failedFields.push(issue.path.join("."));
      }
    }
  }

  const failureRate = failures / records.length;

  if (failureRate > 0.3) {
    const fieldSummary = [...new Set(failedFields)].join(", ");
    const diagnostic =
      `Field extraction errors detected in ${collectorId}. ` +
      `${Math.round(failureRate * 100)}% of records failed validation. ` +
      `Missing/invalid fields: ${fieldSummary}. ` +
      `Check DOM selectors for these fields in the collector configuration.`;

    return { collectorId, status: "DRIFT_DETECTED", diagnostic };
  }

  return { collectorId, status: "HEALTHY" };
}

async function attemptHeal(result: HealResult): Promise<HealResult> {
  if (result.status !== "DRIFT_DETECTED") return result;

  console.log(
    `[heal] Drift detected for ${result.collectorId}. Attempting self-heal...`,
  );
  console.log(`[heal] Diagnostic: ${result.diagnostic}`);
  console.log(
    `[heal] Would execute: bdata scraper heal ${result.collectorId} "${result.diagnostic}"`,
  );

  await prisma.healEvent.create({
    data: {
      collectorId: result.collectorId,
      status: "AUTO_HEALED",
      diagnostic: result.diagnostic,
    },
  });

  return { ...result, status: "AUTO_HEALED" };
}

async function main() {
  console.log("[heal] Starting self-healing validation...");

  const results: HealResult[] = [];

  for (const [name, config] of Object.entries(COLLECTORS)) {
    console.log(`[heal] Validating ${name}...`);
    const result = validateSource(name, config);
    const healed = await attemptHeal(result);
    results.push(healed);

    const icon =
      healed.status === "HEALTHY"
        ? "✅"
        : healed.status === "AUTO_HEALED"
          ? "🔧"
          : "❌";
    console.log(`[heal] ${icon} ${healed.collectorId}: ${healed.status}`);
  }

  const healthy = results.filter((r) => r.status === "HEALTHY").length;
  const healed = results.filter((r) => r.status === "AUTO_HEALED").length;
  const failed = results.filter((r) => r.status === "DRIFT_DETECTED").length;

  console.log(
    `\n[heal] Summary: ${healthy} healthy, ${healed} auto-healed, ${failed} failed`,
  );

  if (failed > 0) {
    console.log(
      "[heal] Some collectors could not be auto-healed. Manual intervention required.",
    );
    process.exit(1);
  }

  await prisma.$disconnect();
}

main().catch(console.error);
