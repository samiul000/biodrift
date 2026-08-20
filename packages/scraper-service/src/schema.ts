import { z } from "zod";

// --- Raw Source Schemas ---

export const RawCenterWatchSchema = z.object({
  studyTitle: z.string().min(1),
  cancerType: z.string().optional(),
  trialPhase: z.string().min(1),
  recruitmentStatus: z.string().min(1),
  studySummary: z.string().optional(),
  product_page_url: z.string().optional(),
});

export const RawISRCTNSchema = z.object({
  isrctnNumber: z.string().optional(),
  trialTitle: z.string().min(1),
  condition: z.string().optional(),
  phase: z.string().optional().default("Not specified"),
  sponsor: z.string().optional(),
  recruitmentStatus: z.string().optional(),
}).passthrough();

export const RawCancerResearchUKSchema = z.object({
  studyTitle: z.string().min(1),
  cancerType: z.string().optional(),
  trialPhase: z.string().min(1),
  recruitmentStatus: z.string().min(1),
  studySummary: z.string().optional(),
  product_page_url: z.string().optional(),
});

export const RawDrugApprovalsSchema = z.object({
  drugTradeName: z.string().min(1),
  activeSubstance: z.string().min(1),
  approvalDate: z.string().optional(),
  companyName: z.string().optional(),
  therapeuticIndication: z.string().optional(),
}).passthrough();

// --- Unified Schemas ---

export const NormalizedTrialSchema = z.object({
  trialId: z.string().min(1),
  source: z.enum(["CenterWatch", "ISRCTN", "Cancer Research UK", "Drugs.com"]),
  brandName: z.string().optional(),
  activeSubstance: z.string().optional(),
  indication: z.string().optional(),
  phase: z.string().optional(),
  status: z.string().optional(),
  sponsor: z.string().optional(),
  completionDate: z.string().optional(),
});

export const PatentCliffReportSchema = z.object({
  activeSubstance: z.string().min(1),
  tradeName: z.string().optional(),
  authHolder: z.string().optional(),
  patentExpiryDate: z.string().optional(),
  daysToCliff: z.number().optional(),
  cliffStatus: z.enum(["CRITICAL_CLIFF", "APPROACHING", "SECURE"]).optional(),
  originatorDefenseTrials: z.number().default(0),
  genericCompetitorTrials: z.number().default(0),
  threatLevel: z.enum(["HIGH", "MEDIUM", "LOW", "NONE"]).optional(),
  insights: z.string().optional(),
});

// --- Types ---

export type RawCenterWatch = z.infer<typeof RawCenterWatchSchema>;
export type RawISRCTN = z.infer<typeof RawISRCTNSchema>;
export type RawCancerResearchUK = z.infer<typeof RawCancerResearchUKSchema>;
export type RawDrugApprovals = z.infer<typeof RawDrugApprovalsSchema>;
export type NormalizedTrial = z.infer<typeof NormalizedTrialSchema>;
export type PatentCliffReport = z.infer<typeof PatentCliffReportSchema>;
