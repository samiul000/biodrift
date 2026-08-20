"use client";

import { ShieldAlert, TrendingDown, Swords, Lightbulb } from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

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

function getStatusColor(status?: string) {
  switch (status) {
    case "CRITICAL_CLIFF":
      return "bg-red-500/20 text-red-400 border-red-500/30";
    case "APPROACHING":
      return "bg-amber-500/20 text-amber-400 border-amber-500/30";
    case "SECURE":
      return "bg-emerald-500/20 text-emerald-400 border-emerald-500/30";
    default:
      return "bg-gray-500/20 text-gray-400 border-gray-500/30";
  }
}

function getThreatColor(level?: string) {
  switch (level) {
    case "HIGH":
      return "text-red-400";
    case "MEDIUM":
      return "text-amber-400";
    case "LOW":
      return "text-blue-400";
    default:
      return "text-gray-400";
  }
}

function ProgressBar({ days }: { days: number }) {
  const maxDays = 365 * 10;
  const pct = Math.max(0, Math.min(100, (days / maxDays) * 100));
  const color =
    days <= 730 ? "bg-red-500" : days <= 1460 ? "bg-amber-500" : "bg-emerald-500";

  return (
    <div className="w-full h-2 bg-bio-700 rounded-full overflow-hidden">
      <div className={`h-full ${color} rounded-full`} style={{ width: `${pct}%` }} />
    </div>
  );
}

export function PatentCliffsClient({ cliffs }: { cliffs: CliffReport[] }) {
  const sorted = [...cliffs].sort(
    (a, b) => (a.daysToCliff ?? Infinity) - (b.daysToCliff ?? Infinity)
  );

  const chartData = sorted.map((c) => ({
    name: c.tradeName || c.activeSubstance,
    defense: c.originatorDefenseTrials,
    generic: c.genericCompetitorTrials,
  }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Patent Cliffs</h1>
        <p className="text-sm text-gray-400 mt-1">
          Exclusivity countdown and competitive threat analysis
        </p>
      </div>

      <div className="bg-bio-800 border border-bio-600 rounded-xl p-5">
        <h2 className="text-lg font-semibold mb-4">Defense vs Competitor Trials</h2>
        <ResponsiveContainer width="100%" height={250}>
          <BarChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#243044" />
            <XAxis dataKey="name" stroke="#9ca3af" fontSize={11} />
            <YAxis stroke="#9ca3af" fontSize={12} />
            <Tooltip contentStyle={{ background: "#1a2332", border: "1px solid #243044" }} />
            <Bar dataKey="defense" name="Originator Defense" fill="#22d3ee" radius={[4, 4, 0, 0]} />
            <Bar dataKey="generic" name="Generic Competitors" fill="#f87171" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {sorted.map((cliff) => (
          <div key={cliff.activeSubstance} className="bg-bio-800 border border-bio-600 rounded-xl p-5 space-y-4">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-lg font-semibold">{cliff.tradeName || cliff.activeSubstance}</h3>
                <p className="text-sm text-gray-400">{cliff.authHolder}</p>
                <p className="text-xs text-bio-300 mt-1">{cliff.activeSubstance}</p>
              </div>
              <span className={`px-2.5 py-1 rounded-full text-xs font-medium border ${getStatusColor(cliff.cliffStatus)}`}>
                {cliff.cliffStatus?.replace("_", " ")}
              </span>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm text-gray-400">Days to Exclusivity Loss</span>
                <span className={`text-xl font-bold ${getThreatColor(cliff.threatLevel)}`}>
                  {cliff.daysToCliff?.toLocaleString()}
                </span>
              </div>
              <ProgressBar days={cliff.daysToCliff ?? 3650} />
              {cliff.patentExpiryDate && (
                <p className="text-xs text-gray-500 mt-1">Expiry: {cliff.patentExpiryDate}</p>
              )}
            </div>

            <div className="flex items-center gap-6 text-sm">
              <div className="flex items-center gap-1.5">
                <Swords size={14} className="text-cyan-400" />
                <span className="text-gray-400">Defense:</span>
                <span className="font-medium">{cliff.originatorDefenseTrials}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <TrendingDown size={14} className="text-red-400" />
                <span className="text-gray-400">Competitors:</span>
                <span className="font-medium">{cliff.genericCompetitorTrials}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <ShieldAlert size={14} className={getThreatColor(cliff.threatLevel)} />
                <span className="text-gray-400">Threat:</span>
                <span className={`font-medium ${getThreatColor(cliff.threatLevel)}`}>{cliff.threatLevel}</span>
              </div>
            </div>

            {cliff.insights && (
              <div className="flex items-start gap-2 bg-bio-700/50 rounded-lg p-3">
                <Lightbulb size={14} className="text-amber-400 mt-0.5 shrink-0" />
                <p className="text-xs text-gray-300">{cliff.insights}</p>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
