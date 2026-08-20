"use client";

import { useState } from "react";
import { Activity, CheckCircle, AlertTriangle, RefreshCw } from "lucide-react";

type CollectorStatus = "healthy" | "healing" | "healed" | "drifted";

interface Collector {
  id: string;
  name: string;
  status: CollectorStatus;
  lastCheck: string;
  records: number;
}

interface HealEvent {
  id: string;
  collectorId: string;
  status: string;
  diagnostic: string;
  timestamp: string;
}

const INITIAL_COLLECTORS: Collector[] = [
  { id: "c_mt0jn6u0286pl2z2e1", name: "CenterWatch Clinical Listings", status: "healthy", lastCheck: new Date().toISOString(), records: 16 },
  { id: "c_mt0284ap2o0gyzcbtt", name: "ISRCTN Registry", status: "healthy", lastCheck: new Date().toISOString(), records: 1846 },
  { id: "c_mt01zjnf18cajob88f", name: "Cancer Research UK Trials", status: "healthy", lastCheck: new Date().toISOString(), records: 16 },
  { id: "c_mt01u66kqoea0u2bm", name: "Drugs.com Approvals", status: "healthy", lastCheck: new Date().toISOString(), records: 5572 },
];

const MOCK_EVENTS: HealEvent[] = [
  {
    id: "evt-001",
    collectorId: "c_mt01zjnf18cajob88f",
    status: "HEALTHY",
    diagnostic: "All 16 records validated successfully against schema.",
    timestamp: new Date(Date.now() - 3600000).toISOString(),
  },
  {
    id: "evt-002",
    collectorId: "c_mt0jn6u0286pl2z2e1",
    status: "HEALTHY",
    diagnostic: "All 16 records validated successfully against schema.",
    timestamp: new Date(Date.now() - 7200000).toISOString(),
  },
  {
    id: "evt-003",
    collectorId: "c_mt0284ap2o0gyzcbtt",
    status: "DRIFT_DETECTED",
    diagnostic: "No data file found — collector may not have returned data yet.",
    timestamp: new Date(Date.now() - 10800000).toISOString(),
  },
  {
    id: "evt-004",
    collectorId: "c_mt01u66kqoea0u2bm",
    status: "DRIFT_DETECTED",
    diagnostic: "No data file found — collector may not have returned data yet.",
    timestamp: new Date(Date.now() - 14400000).toISOString(),
  },
];

function StatusBadge({ status }: { status: CollectorStatus }) {
  const config = {
    healthy: { icon: CheckCircle, color: "text-emerald-400", bg: "bg-emerald-500/10", label: "Healthy" },
    healing: { icon: RefreshCw, color: "text-amber-400", bg: "bg-amber-500/10", label: "Healing..." },
    healed: { icon: CheckCircle, color: "text-cyan-400", bg: "bg-cyan-500/10", label: "Auto-Healed" },
    drifted: { icon: AlertTriangle, color: "text-red-400", bg: "bg-red-500/10", label: "Drifted" },
  };
  const c = config[status];
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${c.bg} ${c.color}`}>
      <c.icon size={12} />
      {c.label}
    </span>
  );
}

export default function SentinelHealthPage() {
  const [collectors, setCollectors] = useState<Collector[]>(INITIAL_COLLECTORS);
  const [events, setEvents] = useState<HealEvent[]>(MOCK_EVENTS);
  const [simulating, setSimulating] = useState(false);

  const simulateDriftAndHeal = async () => {
    setSimulating(true);

    // Step 1: Inject drift
    setCollectors((prev) =>
      prev.map((c) => ({ ...c, status: "drifted" as CollectorStatus }))
    );

    // Step 2: Start healing
    await new Promise((r) => setTimeout(r, 1500));
    setCollectors((prev) =>
      prev.map((c) => ({ ...c, status: "healing" as CollectorStatus }))
    );

    // Step 3: Heal each collector sequentially
    for (let i = 0; i < 4; i++) {
      await new Promise((r) => setTimeout(r, 1000));
      const collectorId = INITIAL_COLLECTORS[i].id;

      setCollectors((prev) =>
        prev.map((c) =>
          c.id === collectorId
            ? { ...c, status: "healed" as CollectorStatus, lastCheck: new Date().toISOString() }
            : c
        )
      );

      setEvents((prev) => [
        {
          id: `evt-${Date.now()}-${i}`,
          collectorId,
          status: "AUTO_HEALED",
          diagnostic: `DOM drift detected in selector for field 'medicalCondition'. Automated selector repair applied.`,
          timestamp: new Date().toISOString(),
        },
        ...prev,
      ]);
    }

    // Step 4: Back to healthy
    await new Promise((r) => setTimeout(r, 800));
    setCollectors((prev) =>
      prev.map((c) => ({ ...c, status: "healthy" as CollectorStatus }))
    );

    setSimulating(false);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Sentinel Health</h1>
        <p className="text-sm text-gray-400 mt-1">
          Scraper health matrix and autonomous healing audit
        </p>
      </div>

      {/* Health Matrix */}
      <div className="bg-bio-800 border border-bio-600 rounded-xl p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">Collector Health Matrix</h2>
          <button
            onClick={simulateDriftAndHeal}
            disabled={simulating}
            className="flex items-center gap-2 px-4 py-2 bg-bio-600 hover:bg-bio-500 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg text-sm font-medium transition-colors"
          >
            <Activity size={16} className={simulating ? "animate-spin" : ""} />
            {simulating ? "Simulating..." : "Simulate DOM Drift & Heal"}
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {collectors.map((c) => (
            <div
              key={c.id}
              className="bg-bio-700/50 border border-bio-600 rounded-lg p-4"
            >
              <div className="flex items-center justify-between mb-2">
                <span className="font-mono text-xs text-bio-300">{c.id}</span>
                <StatusBadge status={c.status} />
              </div>
              <p className="text-sm font-medium">{c.name}</p>
              <div className="flex items-center gap-4 mt-2 text-xs text-gray-400">
                <span>Records: {c.records}</span>
                <span>
                  Last check:{" "}
                  {new Date(c.lastCheck).toLocaleTimeString()}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Audit Log */}
      <div className="bg-bio-800 border border-bio-600 rounded-xl p-5">
        <h2 className="text-lg font-semibold mb-4">Healing Audit Log</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-bio-600 text-gray-400">
                <th className="text-left py-2 px-3">Timestamp</th>
                <th className="text-left py-2 px-3">Collector</th>
                <th className="text-left py-2 px-3">Status</th>
                <th className="text-left py-2 px-3">Diagnostic</th>
              </tr>
            </thead>
            <tbody>
              {events.map((evt) => (
                <tr
                  key={evt.id}
                  className="border-b border-bio-700 hover:bg-bio-700/50"
                >
                  <td className="py-2 px-3 font-mono text-xs text-gray-400">
                    {new Date(evt.timestamp).toLocaleString()}
                  </td>
                  <td className="py-2 px-3 font-mono text-xs text-bio-300">
                    {evt.collectorId}
                  </td>
                  <td className="py-2 px-3">
                    <span
                      className={`px-2 py-0.5 rounded-full text-xs ${
                        evt.status === "AUTO_HEALED"
                          ? "bg-cyan-500/20 text-cyan-400"
                          : evt.status === "DRIFT_DETECTED"
                          ? "bg-red-500/20 text-red-400"
                          : "bg-emerald-500/20 text-emerald-400"
                      }`}
                    >
                      {evt.status}
                    </span>
                  </td>
                  <td className="py-2 px-3 text-gray-300 text-xs max-w-md truncate">
                    {evt.diagnostic}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {events.length === 0 && (
            <p className="text-center text-gray-500 py-8">No healing events recorded.</p>
          )}
        </div>
      </div>
    </div>
  );
}
