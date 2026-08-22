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
const OUTPUT_DIR = join(
  import.meta.dirname,
  "..",
  "..",
  "..",
  "apps",
  "web",
  "data",
);

export function sanitizeMoleculeName(name: string): string {
  return name
    .replace(/\(.*?\)/g, "")
    .replace(/\b(Plus|and|\/)\b/gi, "")
    .replace(/\d+\s*mg/gi, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function buildMoleculeIndex(drugsRaw: any[]): Map<string, string> {
  const index = new Map<string, string>();
  for (const d of drugsRaw) {
    if (!d.activeSubstance) continue;
    const sanitized = sanitizeMoleculeName(d.activeSubstance);
    if (sanitized && !index.has(sanitized)) {
      index.set(sanitized, d.activeSubstance);
    }
  }
  return index;
}

let _moleculeIndex: Map<string, string> | null = null;
function getMoleculeIndex(drugsRaw: any[]): Map<string, string> {
  if (!_moleculeIndex) _moleculeIndex = buildMoleculeIndex(drugsRaw);
  return _moleculeIndex;
}

const DRUG_SUFFIX_RE = /\b([A-Za-z]{4,}(?:mab|zumab|ximab|tinib|nib|zomib|platin|ciclib|parib|fenib|lisib|rafib|latin|bolin|goneg|zant|usp|olol|pril|sartan|olone|lone|dipine|azole|mycin|oxacin|cillin|ril))\b/gi;

const DRUG_STOPWORDS = new Set([
  "disease", "medicine", "fluoride", "increase", "vaccine", "determine",
  "telemedicine", "refine", "artemide", "anthracycline", "hyoscine",
  "butylbromide", "treatment", "therapy", "cancer", "tumour", "tumor",
  "health", "effect", "phase", "trial", "study", "protocol", "protocol",
  "randomised", "randomized", "controlled", "comparison", "evaluation",
  "advanced", "hodgkin", "lymphoma", "myeloma", "chemotherapy",
  "radiotherapy", "immunotherapy", "checkpoint", "inhibitor", "antibody",
  "fusion", "conjugate", "bispecific", "monoclonal", "receptor",
  "interventional", "observational", "recruitment", "enrollment",
  "efficacy", "safety", "tolerability", "dose", "regimen", "cycle",
  "survival", "progression", "response", "toxicity", "adverse",
  "immune", "smallpox", "hydrogen", "progesterone", "estradiol",
]);

function extractDrugName(text: string, drugsRaw: any[]): string | undefined {
  if (!text) return undefined;
  const lower = text.toLowerCase();

  // 1. Try regex for known drug suffixes (skip common English words)
  const suffixMatches = text.match(DRUG_SUFFIX_RE);
  if (suffixMatches) {
    let best: string | undefined;
    let bestLen = 0;
    for (const m of suffixMatches) {
      const s = sanitizeMoleculeName(m);
      if (s.length >= 5 && !DRUG_STOPWORDS.has(s) && s.length > bestLen) {
        best = s;
        bestLen = s.length;
      }
    }
    if (best) return best;
  }

  // 2. Try Drugs.com molecule index
  const index = getMoleculeIndex(drugsRaw);
  let bestMatch: string | undefined;
  let bestLen = 0;
  for (const [sanitized, original] of index) {
    if (sanitized.length < 4 || DRUG_STOPWORDS.has(sanitized)) continue;
    if (lower.includes(sanitized) && sanitized.length > bestLen) {
      bestMatch = original;
      bestLen = sanitized.length;
    }
  }
  return bestMatch;
}

function cleanISRCTNRecord(record: any): any {
  return {
    ...record,
    isrctnNumber:
      record.isrctnNumber
        ?.replace(/\s+(Interventional|Observational)\s+(Yes|No)$/i, "")
        .trim() || "",
    sponsor:
      record.sponsor
        ?.replace(
          /\s+(Multicenter|Single|All|Parallel|pivotal device study).*$/i,
          "",
        )
        .trim() || "",
  };
}

function loadJSON<T>(filename: string): T[] {
  const filePath = join(DATA_DIR, filename);
  if (!existsSync(filePath)) {
    console.warn(`[combine] Missing: ${filename} skipping`);
    return [];
  }
  const raw = readFileSync(filePath, "utf-8");
  return JSON.parse(raw) as T[];
}

function normalizeCenterWatch(
  records: any[],
  drugsRaw: any[],
): NormalizedTrial[] {
  return records
    .filter((r) => RawCenterWatchSchema.safeParse(r).success)
    .map((r) => {
      const text = [r.studyTitle, r.studySummary].filter(Boolean).join(" ");
      const extracted = extractDrugName(text, drugsRaw);
      return {
        trialId: `CW-${r.studyTitle?.slice(0, 30).replace(/\s+/g, "-") || Date.now()}`,
        source: "CenterWatch" as const,
        brandName: r.drugName,
        activeSubstance: extracted,
        indication: r.therapeuticArea || r.cancerType,
        phase: r.phase || r.trialPhase,
        status: r.enrollmentStatus || r.recruitmentStatus,
        sponsor: r.sponsor || r.studyTitle?.slice(0, 50) || "Unknown",
        completionDate: undefined,
      };
    });
}

function normalizeISRCTN(records: any[], drugsRaw: any[]): NormalizedTrial[] {
  return records
    .filter((r) => RawISRCTNSchema.safeParse(r).success)
    .map((r) => {
      const cleaned = cleanISRCTNRecord(r);
      const text = [cleaned.trialTitle, cleaned.condition]
        .filter(Boolean)
        .join(" ");
      const extracted = extractDrugName(text, drugsRaw);
      return {
        trialId: `ISRCTN-${cleaned.isrctnNumber?.slice(0, 20) || Date.now()}`,
        source: "ISRCTN" as const,
        brandName: undefined,
        activeSubstance: extracted,
        indication: cleaned.condition,
        phase: cleaned.phase || "Not specified",
        status: cleaned.recruitmentStatus,
        sponsor: cleaned.sponsor,
        completionDate: undefined,
      };
    });
}

function normalizeCancerResearchUK(
  records: any[],
  drugsRaw: any[],
): NormalizedTrial[] {
  return records
    .filter((r) => RawCancerResearchUKSchema.safeParse(r).success)
    .map((r) => {
      const text = [r.studyTitle, r.studySummary].filter(Boolean).join(" ");
      const extracted = extractDrugName(text, drugsRaw);
      return {
        trialId: `CRUK-${r.studyTitle?.slice(0, 30).replace(/\s+/g, "-") || Date.now()}`,
        source: "Cancer Research UK" as const,
        brandName: undefined,
        activeSubstance: extracted,
        indication: r.cancerType,
        phase: r.trialPhase,
        status: r.recruitmentStatus,
        sponsor: "Cancer Research UK",
        completionDate: undefined,
      };
    });
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

function getThreatLevel(
  days: number,
  genericTrials: number,
): PatentCliffReport["threatLevel"] {
  if (days <= 730 && genericTrials > 0) return "HIGH";
  if (days <= 1460 || genericTrials > 2) return "MEDIUM";
  if (days <= 2190) return "LOW";
  return "NONE";
}

function generateInsights(report: PatentCliffReport): string {
  const parts: string[] = [];
  if (report.cliffStatus === "CRITICAL_CLIFF") {
    parts.push(
      `EXCLUSIVITY EXPIRES IN ${report.daysToCliff} DAYS, immediate revenue risk.`,
    );
  }
  if (report.genericCompetitorTrials > 0) {
    parts.push(
      `${report.genericCompetitorTrials} generic competitor trial(s) detected, biosimilar filings likely.`,
    );
  }
  if (report.originatorDefenseTrials > 0) {
    parts.push(
      `${report.originatorDefenseTrials} originator defense trial(s) underway, life-cycle evergreening in progress.`,
    );
  }
  if (report.threatLevel === "HIGH") {
    parts.push(
      "HIGH THREAT: combined cliff proximity and competitor activity.",
    );
  }
  return parts.join(" ") || "No immediate threats detected.";
}

async function main() {
  console.log("[combine] Loading raw data...");

  const cwRaw = loadJSON<any>("centerwatch.json");
  const isrctnRaw = loadJSON<any>("isrctn.json");
  const crukRaw = loadJSON<any>("cancer_research_uk.json");
  const drugsRaw = loadJSON<any>("drug_approvals.json");

  console.log(
    `[combine] CenterWatch: ${cwRaw.length}, ISRCTN: ${isrctnRaw.length}, CRUK: ${crukRaw.length}, Drugs.com: ${drugsRaw.length}`,
  );

  const cwTrials = normalizeCenterWatch(cwRaw, drugsRaw);
  const isrctnTrials = normalizeISRCTN(isrctnRaw, drugsRaw);
  const crukTrials = normalizeCancerResearchUK(crukRaw, drugsRaw);
  const drugTrials = normalizeDrugApprovals(drugsRaw);

  const allTrials = [
    ...cwTrials,
    ...isrctnTrials,
    ...crukTrials,
    ...drugTrials,
  ];
  console.log(`[combine] Normalized: ${allTrials.length} trials`);

  const trialMolecules = new Map<string, NormalizedTrial[]>();
  for (const t of allTrials) {
    if (!t.activeSubstance) continue;
    const key = sanitizeMoleculeName(t.activeSubstance);
    if (!key) continue;
    if (!trialMolecules.has(key)) trialMolecules.set(key, []);
    trialMolecules.get(key)!.push(t);
  }

  const cliffReports: PatentCliffReport[] = [];
  for (const [molecule, trials] of trialMolecules) {
    const phaseIIITrials = trials.filter(
      (t) => t.phase?.includes("III") || t.phase?.includes("3"),
    );
    const sponsors = [...new Set(trials.map((t) => t.sponsor).filter(Boolean))];
    const genericCompetitorTrials = phaseIIITrials.filter(
      (t) => sponsors.length > 1,
    ).length;
    const originatorDefenseTrials = trials.length - genericCompetitorTrials;

    const report: PatentCliffReport = {
      activeSubstance: trials[0].activeSubstance!,
      tradeName: trials[0].brandName || trials[0].activeSubstance,
      authHolder: sponsors[0] || "Unknown",
      patentExpiryDate: undefined,
      daysToCliff: undefined,
      cliffStatus: "SECURE",
      originatorDefenseTrials,
      genericCompetitorTrials,
      threatLevel: getThreatLevel(3650, genericCompetitorTrials),
      insights: "",
    };

    report.insights = generateInsights(report);
    cliffReports.push(report);
  }

  console.log(`[combine] Patent cliff reports: ${cliffReports.length}`);

  mkdirSync(OUTPUT_DIR, { recursive: true });
  const dashboardData = { trials: allTrials, patentCliffs: cliffReports };
  writeFileSync(
    join(OUTPUT_DIR, "unified_dashboard_data.json"),
    JSON.stringify(dashboardData, null, 2),
  );
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
