import { readFileSync, writeFileSync, mkdirSync, existsSync } from "fs";
import { join } from "path";
import { PrismaClient } from "@prisma/client";
import {
  RawCenterWatchSchema,
  RawISRCTNSchema,
  RawCancerResearchUKSchema,
  RawDrugApprovalsSchema,
  type NormalizedTrial,
  type PatentCliffReport,
} from "./schema.js";

const prisma = new PrismaClient();
const DATA_DIR = join(import.meta.dirname, "..", "data", "raw");
const OUTPUT_DIR = join(import.meta.dirname, "..", "..", "..", "apps", "web", "data");

export function sanitizeMoleculeName(name: string): string {
  return name
    .replace(/\(.*?\)/g, "")
    .replace(/\b(Plus|and|\/)\b/gi, "")
    .replace(/\d+\s*mg/gi, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function cleanISRCTNRecord(record: any): any {
  return {
    ...record,
    isrctnNumber: record.isrctnNumber?.replace(/\s+(Interventional|Observational)\s+(Yes|No)$/i, "").trim() || "",
    sponsor: record.sponsor?.replace(/\s+(Multicenter|Single|All|Parallel|pivotal device study).*$/i, "").trim() || "",
  };
}

function loadJSON<T>(filename: string): T[] {
  const filePath = join(DATA_DIR, filename);
  if (!existsSync(filePath)) {
    console.warn(`[combine] Missing: ${filename} — skipping`);
    return [];
  }
  const raw = readFileSync(filePath, "utf-8");
  return JSON.parse(raw) as T[];
}

function normalizeCenterWatch(records: any[]): NormalizedTrial[] {
  return records
    .filter((r) => RawCenterWatchSchema.safeParse(r).success)
    .map((r) => ({
      trialId: `CW-${r.studyTitle?.slice(0, 30).replace(/\s+/g, "-") || Date.now()}`,
      source: "CenterWatch" as const,
      brandName: r.drugName,
      activeSubstance: sanitizeMoleculeName(r.drugName || ""),
      indication: r.therapeuticArea,
      phase: r.phase,
      status: r.enrollmentStatus,
      sponsor: r.sponsor,
      completionDate: undefined,
    }));
}

function normalizeISRCTN(records: any[]): NormalizedTrial[] {
  return records
    .filter((r) => RawISRCTNSchema.safeParse(r).success)
    .map((r) => {
      const cleaned = cleanISRCTNRecord(r);
      return {
        trialId: `ISRCTN-${cleaned.isrctnNumber?.slice(0, 20) || Date.now()}`,
        source: "ISRCTN" as const,
        brandName: undefined,
        activeSubstance: undefined,
        indication: cleaned.condition,
        phase: cleaned.phase || "Not specified",
        status: cleaned.recruitmentStatus,
        sponsor: cleaned.sponsor,
        completionDate: undefined,
      };
    });
}

function normalizeCancerResearchUK(records: any[]): NormalizedTrial[] {
  return records
    .filter((r) => RawCancerResearchUKSchema.safeParse(r).success)
    .map((r) => ({
      trialId: `CRUK-${r.studyTitle?.slice(0, 30).replace(/\s+/g, "-") || Date.now()}`,
      source: "Cancer Research UK" as const,
      brandName: undefined,
      activeSubstance: undefined,
      indication: r.cancerType,
      phase: r.trialPhase,
      status: r.recruitmentStatus,
      sponsor: "Cancer Research UK",
      completionDate: undefined,
    }));
}

function normalizeDrugApprovals(records: any[]): NormalizedTrial[] {
  return records
    .filter((r) => RawDrugApprovalsSchema.safeParse(r).success)
    .map((r) => ({
      trialId: `DRUG-${r.drugTradeName?.replace(/\s+/g, "-") || Date.now()}`,
      source: "Drugs.com" as const,
      brandName: r.drugTradeName,
      activeSubstance: sanitizeMoleculeName(r.activeSubstance || ""),
      indication: r.therapeuticIndication,
      phase: "Approved",
      status: `Approved ${r.approvalDate}`,
      sponsor: r.companyName,
      completionDate: r.approvalDate,
    }));
}

function computeDaysToCliff(expiryDate: string): number {
  const now = new Date();
  const expiry = new Date(expiryDate);
  return Math.ceil((expiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
}

function getCliffStatus(days: number): PatentCliffReport["cliffStatus"] {
  if (days <= 730) return "CRITICAL_CLIFF";
  if (days <= 1460) return "APPROACHING";
  return "SECURE";
}

function getThreatLevel(days: number, genericTrials: number): PatentCliffReport["threatLevel"] {
  if (days <= 730 && genericTrials > 0) return "HIGH";
  if (days <= 1460 || genericTrials > 2) return "MEDIUM";
  if (days <= 2190) return "LOW";
  return "NONE";
}

function generateInsights(report: PatentCliffReport): string {
  const parts: string[] = [];
  if (report.cliffStatus === "CRITICAL_CLIFF") {
    parts.push(`EXCLUSIVITY EXPIRES IN ${report.daysToCliff} DAYS — immediate revenue risk.`);
  }
  if (report.genericCompetitorTrials > 0) {
    parts.push(`${report.genericCompetitorTrials} generic competitor trial(s) detected — biosimilar filings likely.`);
  }
  if (report.originatorDefenseTrials > 0) {
    parts.push(`${report.originatorDefenseTrials} originator defense trial(s) underway — life-cycle evergreening in progress.`);
  }
  if (report.threatLevel === "HIGH") {
    parts.push("HIGH THREAT: combined cliff proximity and competitor activity.");
  }
  return parts.join(" ") || "No immediate threats detected.";
}

async function main() {
  console.log("[combine] Loading raw data...");

  const cwRaw = loadJSON<any>("centerwatch.json");
  const isrctnRaw = loadJSON<any>("isrctn.json");
  const crukRaw = loadJSON<any>("cancer_research_uk.json");
  const drugsRaw = loadJSON<any>("drug_approvals.json");

  console.log(`[combine] CenterWatch: ${cwRaw.length}, ISRCTN: ${isrctnRaw.length}, CRUK: ${crukRaw.length}, Drugs.com: ${drugsRaw.length}`);

  const cwTrials = normalizeCenterWatch(cwRaw);
  const isrctnTrials = normalizeISRCTN(isrctnRaw);
  const crukTrials = normalizeCancerResearchUK(crukRaw);
  const drugTrials = normalizeDrugApprovals(drugsRaw);

  const allTrials = [...cwTrials, ...isrctnTrials, ...crukTrials, ...drugTrials];
  console.log(`[combine] Normalized: ${allTrials.length} trials`);

  const drugApprovalsValid = drugsRaw.filter((r: any) => RawDrugApprovalsSchema.safeParse(r).success);

  const cliffReports: PatentCliffReport[] = drugApprovalsValid.map((drug: any) => {
    const normalizedMolecule = sanitizeMoleculeName(drug.activeSubstance);

    const genericCompetitorTrials = allTrials.filter(
      (t) =>
        t.activeSubstance &&
        sanitizeMoleculeName(t.activeSubstance) === normalizedMolecule &&
        t.phase?.includes("III") &&
        t.sponsor !== drug.companyName
    ).length;

    const originatorDefenseTrials = allTrials.filter(
      (t) =>
        t.activeSubstance &&
        sanitizeMoleculeName(t.activeSubstance) === normalizedMolecule &&
        t.sponsor?.includes(drug.companyName.split(" ")[0])
    ).length;

    const report: PatentCliffReport = {
      activeSubstance: drug.activeSubstance,
      tradeName: drug.drugTradeName,
      authHolder: drug.companyName,
      patentExpiryDate: undefined,
      daysToCliff: undefined,
      cliffStatus: "SECURE",
      originatorDefenseTrials,
      genericCompetitorTrials,
      threatLevel: getThreatLevel(3650, genericCompetitorTrials),
      insights: "",
    };

    report.insights = generateInsights(report);
    return report;
  });

  console.log(`[combine] Patent cliff reports: ${cliffReports.length}`);

  mkdirSync(OUTPUT_DIR, { recursive: true });
  const dashboardData = { trials: allTrials, patentCliffs: cliffReports };
  writeFileSync(join(OUTPUT_DIR, "unified_dashboard_data.json"), JSON.stringify(dashboardData, null, 2));
  console.log(`[combine] Wrote unified_dashboard_data.json`);

  for (const trial of allTrials) {
    await prisma.normalizedTrial.upsert({
      where: { trialId: trial.trialId },
      create: trial,
      update: trial,
    });
  }

  for (const cliff of cliffReports) {
    await prisma.patentCliff.upsert({
      where: { activeSubstance: cliff.activeSubstance },
      create: cliff,
      update: cliff,
    });
  }

  console.log("[combine] Done. Database synced.");
  await prisma.$disconnect();
}

main().catch(console.error);
