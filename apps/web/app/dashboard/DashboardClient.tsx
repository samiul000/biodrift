"use client";

import { useState } from "react";
import {
  Activity,
  ShieldAlert,
  Users,
  HeartPulse,
  Filter,
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

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

function MetricCard({
  label,
  value,
  icon: Icon,
  color,
}: {
  label: string;
  value: string | number;
  icon: React.ElementType;
  color: string;
}) {
  return (
    <div className="bg-bio-800 border border-bio-600 rounded-xl p-5">
      <div className="flex items-center gap-3 mb-2">
        <Icon size={20} className={color} />
        <span className="text-sm text-gray-400">{label}</span>
      </div>
      <div className="text-2xl font-bold">{value}</div>
    </div>
  );
}

export function DashboardClient({ data }: { data: DashboardData }) {
  const { trials, patentCliffs } = data;

  const [sourceFilter, setSourceFilter] = useState("ALL");
  const [phaseFilter, setPhaseFilter] = useState("ALL");
  const [statusFilter, setStatusFilter] = useState("ALL");

  const sources = ["ALL", ...new Set(trials.map((t) => t.source))];
  const phases = ["ALL", ...new Set(trials.map((t) => t.phase).filter(Boolean))];
  const statuses = ["ALL", ...new Set(trials.map((t) => t.status).filter(Boolean))];

  const filtered = trials.filter((t) => {
    if (sourceFilter !== "ALL" && t.source !== sourceFilter) return false;
    if (phaseFilter !== "ALL" && t.phase !== phaseFilter) return false;
    if (statusFilter !== "ALL" && t.status !== statusFilter) return false;
    return true;
  });

  const criticalCliffs = patentCliffs.filter(
    (c) => c.cliffStatus === "CRITICAL_CLIFF"
  ).length;
  const genericAlerts = patentCliffs.reduce(
    (sum, c) => sum + (c.genericCompetitorTrials || 0),
    0
  );

  const sourceBreakdown = sources
    .filter((s) => s !== "ALL")
    .map((s) => ({
      name: s,
      count: trials.filter((t) => t.source === s).length,
    }));

  const totalCollectors = 4;
  const activeCollectors = new Set(trials.map((t) => t.source)).size;
  const systemHealth = `${Math.round((activeCollectors / totalCollectors) * 100)}%`;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <p className="text-sm text-gray-400 mt-1">
          Clinical trial intelligence overview
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard label="Total Trials Tracked" value={trials.length} icon={Activity} color="text-blue-400" />
        <MetricCard label="Active Patent Cliffs (<24mo)" value={criticalCliffs} icon={ShieldAlert} color="text-red-400" />
        <MetricCard label="Generic Competitor Alerts" value={genericAlerts} icon={Users} color="text-amber-400" />
        <MetricCard label="System Health" value={systemHealth} icon={HeartPulse} color="text-emerald-400" />
      </div>

      <div className="bg-bio-800 border border-bio-600 rounded-xl p-5">
        <h2 className="text-lg font-semibold mb-4">Trials by Source Registry</h2>
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={sourceBreakdown}>
            <CartesianGrid strokeDasharray="3 3" stroke="#243044" />
            <XAxis dataKey="name" stroke="#9ca3af" fontSize={12} />
            <YAxis stroke="#9ca3af" fontSize={12} />
            <Tooltip contentStyle={{ background: "#1a2332", border: "1px solid #243044" }} />
            <Bar dataKey="count" fill="#22d3ee" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="bg-bio-800 border border-bio-600 rounded-xl p-5">
        <div className="flex items-center gap-2 mb-4">
          <Filter size={16} className="text-gray-400" />
          <h2 className="text-lg font-semibold">Trial Explorer</h2>
        </div>

        <div className="flex gap-3 mb-4 flex-wrap">
          <select value={sourceFilter} onChange={(e) => setSourceFilter(e.target.value)} className="bg-bio-700 border border-bio-600 rounded-lg px-3 py-1.5 text-sm text-gray-200">
            {sources.map((s) => (<option key={s} value={s}>Source: {s}</option>))}
          </select>
          <select value={phaseFilter} onChange={(e) => setPhaseFilter(e.target.value)} className="bg-bio-700 border border-bio-600 rounded-lg px-3 py-1.5 text-sm text-gray-200">
            {phases.map((p) => (<option key={p} value={p}>Phase: {p}</option>))}
          </select>
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="bg-bio-700 border border-bio-600 rounded-lg px-3 py-1.5 text-sm text-gray-200">
            {statuses.map((s) => (<option key={s} value={s}>Status: {s}</option>))}
          </select>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-bio-600 text-gray-400">
                <th className="text-left py-2 px-3">Trial ID</th>
                <th className="text-left py-2 px-3">Source</th>
                <th className="text-left py-2 px-3">Drug</th>
                <th className="text-left py-2 px-3">Indication</th>
                <th className="text-left py-2 px-3">Phase</th>
                <th className="text-left py-2 px-3">Status</th>
                <th className="text-left py-2 px-3">Sponsor</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((t) => (
                <tr key={t.trialId} className="border-b border-bio-700 hover:bg-bio-700/50">
                  <td className="py-2 px-3 font-mono text-xs text-bio-300">{t.trialId}</td>
                  <td className="py-2 px-3">
                    <span className="px-2 py-0.5 rounded-full text-xs bg-bio-600 text-bio-100">{t.source}</span>
                  </td>
                  <td className="py-2 px-3">{t.brandName || t.activeSubstance}</td>
                  <td className="py-2 px-3 text-gray-300">{t.indication}</td>
                  <td className="py-2 px-3">{t.phase}</td>
                  <td className="py-2 px-3 text-gray-300">{t.status}</td>
                  <td className="py-2 px-3 text-gray-400">{t.sponsor}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {filtered.length === 0 && (
            <p className="text-center text-gray-500 py-8">No trials match the selected filters.</p>
          )}
        </div>
      </div>
    </div>
  );
}
