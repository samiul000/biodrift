import { readFileSync, existsSync } from "fs";
import { join } from "path";
import { PrismaClient } from "@prisma/client";
import {
  RawCenterWatchSchema,
  RawISRCTNSchema,
  RawCancerResearchUKSchema,
  RawDrugApprovalsSchema,
} from "./schema.js";

const prisma = new PrismaClient();
const DATA_DIR = join(import.meta.dirname, "..", "data", "raw");

async function seed() {
  console.log("[seed] Validating and seeding raw records...");

  const sources = [
    { file: "centerwatch.json", name: "CenterWatch", schema: RawCenterWatchSchema },
    { file: "isrctn.json", name: "ISRCTN", schema: RawISRCTNSchema },
    { file: "cancer_research_uk.json", name: "Cancer Research UK", schema: RawCancerResearchUKSchema },
    { file: "drug_approvals.json", name: "Drugs.com", schema: RawDrugApprovalsSchema },
  ];

  for (const { file, name, schema } of sources) {
    const path = join(DATA_DIR, file);
    if (!existsSync(path)) {
      console.error(`[seed] Missing: ${path}`);
      continue;
    }

    const records: any[] = JSON.parse(readFileSync(path, "utf-8"));
    let valid = 0;

    for (const record of records) {
      const result = schema.safeParse(record);
      if (result.success) {
        valid++;
        await prisma.rawTrial.upsert({
          where: { id: `${name}-${JSON.stringify(record).slice(0, 50)}` },
          create: {
            id: `${name}-${JSON.stringify(record).slice(0, 50)}`,
            source: name,
            recordId: record.studyTitle || record.isrctnNumber || record.drugTradeName || "",
            data: JSON.stringify(record),
          },
          update: { data: JSON.stringify(record) },
        });
      }
    }

    console.log(`[seed] ${name}: ${valid}/${records.length} valid records seeded`);
  }

  console.log("[seed] Done.");
  await prisma.$disconnect();
}

seed().catch(console.error);
