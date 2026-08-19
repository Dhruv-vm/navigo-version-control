"use client"

import { useState, useEffect } from "react"

export default function AdminAuditLogsPage() {
  const [logs, setLogs] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch("/api/admin/audit-logs")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d?.logs) setLogs(d.logs)
      })
      .catch((err) => console.error(err))
      .finally(() => setLoading(false))
  }, [])

  return (
    <div className="space-y-6 font-mono text-xs">
      {/* ── HEADER ─────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="font-display text-2xl font-black text-white tracking-tight">
              Security & Operations Audit Trail
            </h1>
            <span className="text-[10px] font-mono font-bold bg-amber-400/15 text-amber-300 px-2 py-0.5 rounded-full border border-amber-400/30">
              IMMUTABLE LOGS
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Traceable chronological event record of all staff interventions, gate boarding scans, seat locks, and pricing modifications.
          </p>
        </div>

        <span className="text-slate-400 text-[11px]">
          Recorded <strong className="text-white">{logs.length}</strong> system events
        </span>
      </div>

      {/* ── AUDIT TABLE ────────────────────────────────────────────── */}
      <div className="bg-[#070D18] border border-white/[0.08] rounded-3xl overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-[#0A1424] border-b border-white/[0.08] text-slate-400 text-[10px] uppercase tracking-wider">
              <tr>
                <th className="py-3.5 px-4 font-bold">Timestamp</th>
                <th className="py-3.5 px-4 font-bold">Admin Operator</th>
                <th className="py-3.5 px-4 font-bold">Role</th>
                <th className="py-3.5 px-4 font-bold">Operation Action</th>
                <th className="py-3.5 px-4 font-bold">Target Entity</th>
                <th className="py-3.5 px-4 font-bold text-right">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.04]">
              {loading ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-500 font-mono">
                    Loading audit trail…
                  </td>
                </tr>
              ) : logs.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-500 font-mono">
                    No audit records recorded yet.
                  </td>
                </tr>
              ) : (
                logs.map((l) => (
                  <tr key={l.id} className="hover:bg-white/[0.02] transition-colors">
                    <td className="py-3.5 px-4 text-slate-400 text-[11px]">
                      {new Date(l.timestamp).toLocaleTimeString("en-IN", {
                        hour: "2-digit",
                        minute: "2-digit",
                        second: "2-digit",
                      })} · {new Date(l.timestamp).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
                    </td>
                    <td className="py-3.5 px-4 font-bold text-white">
                      {l.adminName}
                    </td>
                    <td className="py-3.5 px-4">
                      <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-white/[0.06] text-cyan-300 border border-white/[0.1]">
                        {l.role}
                      </span>
                    </td>
                    <td className="py-3.5 px-4">
                      <span className="text-amber-300 font-bold">{l.action}</span>
                    </td>
                    <td className="py-3.5 px-4 text-slate-300">
                      {l.target}
                    </td>
                    <td className="py-3.5 px-4 text-right text-[10px] text-slate-500 max-w-xs truncate">
                      {l.details ? JSON.stringify(l.details) : "—"}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
