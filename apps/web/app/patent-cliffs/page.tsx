import { readFileSync } from "fs";
import { join } from "path";
import { PatentCliffsClient } from "./PatentCliffsClient";

type CliffReport = {
  activeSubstance: string;
  tradeName?: string;
  authHolder?: string;
  patentExpiryDate?: string;
  daysToCliff?: number;
  cliffStatus?: string;
  originatorDefenseTrials: number;
  genericCompetitorTrials: number;
  threatLevel?: string;
  insights?: string;
};

function loadData(): CliffReport[] {
  try {
    const raw = readFileSync(
      join(process.cwd(), "data", "unified_dashboard_data.json"),
      "utf-8"
    );
    return JSON.parse(raw).patentCliffs || [];
  } catch {
    return [];
  }
}

export default function PatentCliffsPage() {
  const cliffs = loadData();
  return <PatentCliffsClient cliffs={cliffs} />;
}
