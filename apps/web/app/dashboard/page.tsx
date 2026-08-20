import { readFileSync } from "fs";
import { join } from "path";
import { DashboardClient } from "./DashboardClient";

type Trial = {
  trialId: string;
  source: string;
  brandName?: string;
  activeSubstance?: string;
  indication?: string;
  phase?: string;
  status?: string;
  sponsor?: string;
};

type DashboardData = { trials: Trial[]; patentCliffs: any[] };

function loadData(): DashboardData {
  try {
    const raw = readFileSync(
      join(process.cwd(), "data", "unified_dashboard_data.json"),
      "utf-8"
    );
    return JSON.parse(raw);
  } catch {
    return { trials: [], patentCliffs: [] };
  }
}

export default function DashboardPage() {
  const data = loadData();
  return <DashboardClient data={data} />;
}
