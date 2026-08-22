"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Activity,
  CheckCircle,
  AlertTriangle,
  RefreshCw,
  Zap,
  Play,
} from "lucide-react";

type CollectorStatus = "HEALTHY" | "DRIFT_DETECTED";

interface Collector {
  key: string;
  id: string;
  name: string;
  status: CollectorStatus;
  records: number;
  validRecords: number;
  failureRate: number;
  diagnostic?: string;
}

interface AuditResponse {
  auditedAt: string;
  summary: {
    total: number;
    healthy: number;
    drifted: number;
    healthPct: number;
  };
  collectors: Collector[];
}

function StatusBadge({ status }: { status: string }) {
  const config = {
    healthy: {
      icon: CheckCircle,
      color: "text-emerald-400",
      bg: "bg-emerald-500/10",
      label: "Healthy",
    },
    drifted: {
      icon: AlertTriangle,
      color: "text-red-400",
      bg: "bg-red-500/10",
      label: "Drifted",
    },
  };
  const key = status === "DRIFT_DETECTED" ? "drifted" : "healthy";
  const c = config[key];
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${c.bg} ${c.color}`}
    >
      <c.icon size={12} /> {c.label}
    </span>
  );
}

export default function SentinelHealthPage() {
  const [data, setData] = useState<AuditResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [drifting, setDrifting] = useState(false);
  const [healing, setHealing] = useState(false);
  const [driftMsg, setDriftMsg] = useState<string | null>(null);
  const [healMsg, setHealMsg] = useState<string | null>(null);

  const runAudit = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/audit", { cache: "no-store" });
      if (!res.ok) throw new Error(`Audit failed: ${res.status}`);
      setData(await res.json());
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    runAudit();
  }, [runAudit]);

  const simulateDrift = async () => {
    setDrifting(true);
    setDriftMsg(null);
    setError(null);
    try {
      const res = await fetch("/api/audit/corrupt", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ collector: "drug_approvals" }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      setDriftMsg(json.message);
      await runAudit();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setDrifting(false);
    }
  };

  const triggerHeal = async () => {
    setHealing(true);
    setHealMsg(null);
    setError(null);
    try {
      const res = await fetch("/api/audit/trigger", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ collector: "drug_approvals" }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      setHealMsg(json.message);
      await runAudit();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setHealing(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold">Sentinel Health</h1>
          <p className="text-sm text-gray-400 mt-1">
            Real schema audit of collector output validated live from data files
          </p>
          {data && (
            <p className="text-xs text-gray-500 mt-1">
              Last audit: {new Date(data.auditedAt).toLocaleString()}
            </p>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={simulateDrift}
            disabled={loading || healing || drifting}
            className="flex items-center gap-2 px-5 py-2 bg-red-600 hover:bg-red-500 disabled:opacity-50 disabled:cursor-not-allowed rounded-full text-sm font-medium transition-colors"
          >
            <Zap size={16} className={drifting ? "animate-pulse" : ""} />
            {drifting ? "Corrupting..." : "Simulate Drift"}
          </button>
          <button
            onClick={triggerHeal}
            disabled={loading || drifting || healing}
            className="flex items-center gap-2 px-5 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed rounded-full text-sm font-medium transition-colors"
          >
            <Play size={16} className={healing ? "animate-pulse" : ""} />
            {healing ? "Healing..." : "Trigger Heal"}
          </button>
          <button
            onClick={runAudit}
            disabled={loading || drifting || healing}
            className="flex items-center gap-2 px-5 py-2 glass-chip hover:bg-white/10 disabled:opacity-50 disabled:cursor-not-allowed rounded-full text-sm font-medium transition-colors"
          >
            <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
            {loading ? "Auditing..." : "Run Audit"}
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-5 text-red-400 text-sm">
          {error}
        </div>
      )}
      {driftMsg && (
        <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-4 text-amber-400 text-sm">
          {driftMsg}
        </div>
      )}
      {healMsg && (
        <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-xl p-4 text-emerald-400 text-sm">
          {healMsg}
        </div>
      )}

      {data && (
        <div className="grid grid-cols-3 gap-4">
          <div className="glass-card p-5">
            <p className="text-xs text-on-surface-variant uppercase tracking-wide">
              Health Score
            </p>
            <p className="text-3xl font-bold mt-1">{data.summary.healthPct}%</p>
          </div>
          <div className="glass-card p-5">
            <p className="text-xs text-emerald-400 uppercase tracking-wide">
              Healthy
            </p>
            <p className="text-3xl font-bold mt-1">{data.summary.healthy}</p>
          </div>
          <div className="glass-card p-5">
            <p className="text-xs text-red-400 uppercase tracking-wide">
              Drifted
            </p>
            <p className="text-3xl font-bold mt-1">{data.summary.drifted}</p>
          </div>
        </div>
      )}

      <div className="glass-card p-5">
        <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <Activity size={18} /> Collector Health Matrix
        </h2>
        {loading && !data && (
          <p className="text-center text-gray-500 py-8">
            Running first audit...
          </p>
        )}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {data?.collectors.map((c) => (
            <div
              key={c.key}
              className="glass-inset p-4"
            >
              <div className="flex items-center justify-between mb-2">
                <span className="font-mono text-xs text-primary">{c.id}</span>
                <StatusBadge status={c.status} />
              </div>
              <p className="text-sm font-medium">{c.name}</p>
              <div className="flex items-center gap-4 mt-2 text-xs text-gray-400">
                <span>Records: {c.records >= 0 ? c.records : "?"}</span>
                <span>Valid: {c.validRecords}</span>
                <span>Failure: {(c.failureRate * 100).toFixed(0)}%</span>
              </div>
              {c.diagnostic && (
                <p
                  className={`text-xs mt-2 ${
                    c.status === "DRIFT_DETECTED"
                      ? "text-red-400"
                      : "text-gray-500"
                  }`}
                >
                  {c.diagnostic}
                </p>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
