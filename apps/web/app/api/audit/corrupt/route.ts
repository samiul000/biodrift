import { NextResponse } from "next/server";
import { readFileSync, writeFileSync, existsSync, copyFileSync } from "fs";
import { join } from "path";

const DATA_DIR = join(
  process.cwd(),
  "..",
  "..",
  "packages",
  "scraper-service",
  "data",
  "raw",
);

const CORRUPT_MAP: Record<string, string[]> = {
  centerwatch: ["trialPhase", "recruitmentStatus"],
  isrctn: ["trialTitle"],
  cancer_research_uk: ["trialPhase", "recruitmentStatus"],
  drug_approvals: ["activeSubstance"],
};

const SEED_VALUES: Record<string, Record<string, string>> = {
  drug_approvals: { activeSubstance: "Unknown Substance" },
  centerwatch: { trialPhase: "Phase I", recruitmentStatus: "Recruiting" },
  cancer_research_uk: {
    trialPhase: "Phase I",
    recruitmentStatus: "Recruiting",
  },
  isrctn: { trialTitle: "Untitled Trial" },
};

export async function POST(req: Request) {
  const { collector } = await req.json();

  if (!collector || !CORRUPT_MAP[collector]) {
    return NextResponse.json(
      {
        error: `Unknown collector. Valid: ${Object.keys(CORRUPT_MAP).join(", ")}`,
      },
      { status: 400 },
    );
  }

  const filePath = join(DATA_DIR, `${collector}.json`);
  if (!existsSync(filePath)) {
    return NextResponse.json({ error: "Data file not found" }, { status: 404 });
  }

  // Backup original before first corruption
  const backupPath = join(DATA_DIR, `${collector}.bak.json`);
  if (!existsSync(backupPath)) {
    copyFileSync(filePath, backupPath);
  }

  const records = JSON.parse(readFileSync(filePath, "utf-8"));
  const fieldsToCorrupt = CORRUPT_MAP[collector];
  const seeds = SEED_VALUES[collector] || {};

  // Ensure all records have the fields (so corruption is visible)
  for (const field of fieldsToCorrupt) {
    if (seeds[field]) {
      for (const rec of records) {
        if (!(field in rec)) rec[field] = seeds[field];
      }
    }
  }

  const corruptCount = Math.max(Math.ceil(records.length * 0.35) + 1, 5);

  for (let i = 0; i < corruptCount; i++) {
    for (const field of fieldsToCorrupt) {
      delete records[i][field];
    }
  }

  writeFileSync(filePath, JSON.stringify(records, null, 2));

  return NextResponse.json({
    ok: true,
    collector,
    corrupted: corruptCount,
    total: records.length,
    fieldsRemoved: fieldsToCorrupt,
    message: `Corrupted ${corruptCount}/${records.length} records removed: ${fieldsToCorrupt.join(", ")}`,
  });
}
