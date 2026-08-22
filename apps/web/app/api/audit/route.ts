import { NextResponse } from "next/server";
import { readFileSync, existsSync } from "fs";
import { join } from "path";

// field-presence check instead of importing scraper-service zod
// schemas (cross-package TS/ESM friction). Swap to shared schemas if the two
// validations ever need to match exactly.
const DATA_DIR = join(
  process.cwd(),
  "..",
  "..",
  "packages",
  "scraper-service",
  "data",
  "raw",
);

const COLLECTORS = [
  {
    key: "centerwatch",
    name: "CenterWatch Clinical Listings",
    id: "c_mt0jn6u0286pl2z2e1",
    required: ["studyTitle", "trialPhase", "recruitmentStatus"],
  },
  {
    key: "isrctn",
    name: "ISRCTN Registry",
    id: "c_mt0284ap2o0gyzcbtt",
    required: ["trialTitle"],
  },
  {
    key: "cancer_research_uk",
    name: "Cancer Research UK Trials",
    id: "c_mt01zjnf18cajob88f",
    required: ["studyTitle", "trialPhase", "recruitmentStatus"],
  },
  {
    key: "drug_approvals",
    name: "Drugs.com Approvals",
    id: "c_mt01u66kqoea0u2bm",
    required: ["drugTradeName", "activeSubstance"],
  },
];

export async function GET() {
  const auditedAt = new Date().toISOString();

  const collectors = COLLECTORS.map((c) => {
    const filePath = join(DATA_DIR, `${c.key}.json`);

    if (!existsSync(filePath)) {
      return {
        ...c,
        status: "DRIFT_DETECTED" as const,
        records: 0,
        validRecords: 0,
        failureRate: 1,
        diagnostic:
          "No data file found! Collector may not have returned data yet.",
      };
    }

    let records: any[];
    try {
      records = JSON.parse(readFileSync(filePath, "utf-8"));
    } catch {
      return {
        ...c,
        status: "DRIFT_DETECTED" as const,
        records: 0,
        validRecords: 0,
        failureRate: 1,
        diagnostic: "Data file is not valid JSON.",
      };
    }

    if (!Array.isArray(records) || records.length === 0) {
      return {
        ...c,
        status: "DRIFT_DETECTED" as const,
        records: Array.isArray(records) ? 0 : -1,
        validRecords: 0,
        failureRate: 1,
        diagnostic: "Empty array returned from collector — no records found.",
      };
    }

    let failures = 0;
    const failedFields = new Set<string>();
    for (const record of records) {
      const missing = c.required.filter((f) => !record[f]);
      if (missing.length > 0) {
        failures++;
        missing.forEach((f) => failedFields.add(f));
      }
    }

    const failureRate = failures / records.length;

    if (failureRate > 0.3) {
      return {
        ...c,
        status: "DRIFT_DETECTED" as const,
        records: records.length,
        validRecords: records.length - failures,
        failureRate,
        diagnostic:
          `Field extraction errors detected. ${Math.round(failureRate * 100)}% of ` +
          `records failed validation. Missing fields: ${[...failedFields].join(", ")}. ` +
          `Check DOM selectors in the collector configuration.`,
      };
    }

    return {
      ...c,
      status: "HEALTHY" as const,
      records: records.length,
      validRecords: records.length - failures,
      failureRate,
      diagnostic:
        failures > 0
          ? `${failures} record(s) with missing fields (${[...failedFields].join(", ")}) within tolerance.`
          : `All ${records.length} records validated successfully.`,
    };
  });

  const healthy = collectors.filter((c) => c.status === "HEALTHY").length;

  return NextResponse.json({
    auditedAt,
    summary: {
      total: collectors.length,
      healthy,
      drifted: collectors.length - healthy,
      healthPct: Math.round((healthy / collectors.length) * 100),
    },
    collectors,
  });
}
