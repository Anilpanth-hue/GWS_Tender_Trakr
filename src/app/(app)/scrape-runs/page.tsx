'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { RefreshCw, CheckCircle2, XCircle, Loader2, Activity, Zap } from 'lucide-react';
import { formatDate } from '@/lib/utils';
import type { ScrapeRun } from '@/types';

const CARD_STYLE = {
  background: '#ffffff',
  border: '1px solid #e2e8f0',
  boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
};

function StatusBadge({ status }: { status: string }) {
  if (status === 'completed') return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-semibold"
      style={{ background: 'rgba(22,163,74,0.07)', border: '1px solid rgba(22,163,74,0.18)', color: '#16a34a' }}>
      <CheckCircle2 className="w-3 h-3" /> Completed
    </span>
  );
  if (status === 'failed') return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-semibold"
      style={{ background: 'rgba(239,68,68,0.07)', border: '1px solid rgba(239,68,68,0.18)', color: '#dc2626' }}>
      <XCircle className="w-3 h-3" /> Failed
    </span>
  );
  return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-semibold"
      style={{ background: 'rgba(124,58,237,0.07)', border: '1px solid rgba(124,58,237,0.2)', color: '#7c3aed' }}>
      <Loader2 className="w-3 h-3 animate-spin" /> Running
    </span>
  );
}

function SessionBadge({ session }: { session: string }) {
  const map: Record<string, { color: string; bg: string; border: string }> = {
    morning:   { color: '#d97706', bg: 'rgba(245,158,11,0.07)',   border: 'rgba(245,158,11,0.18)' },
    afternoon: { color: '#ea580c', bg: 'rgba(249,115,22,0.07)',   border: 'rgba(249,115,22,0.18)' },
    live:      { color: '#7c3aed', bg: 'rgba(124,58,237,0.07)',   border: 'rgba(124,58,237,0.18)' },
    manual:    { color: '#7c3aed', bg: 'rgba(124,58,237,0.07)',   border: 'rgba(124,58,237,0.18)' },
  };
  const s = map[session] || { color: '#64748b', bg: '#f8fafc', border: '#e2e8f0' };
  return (
    <span className="inline-flex items-center px-2.5 py-1 rounded-md text-[11px] font-semibold capitalize"
      style={{ background: s.bg, color: s.color, border: `1px solid ${s.border}` }}>
      {session}
    </span>
  );
}

// Mini bar for qualification rate
function QualBar({ found, qualified }: { found: number; qualified: number }) {
  const pct = found > 0 ? Math.min((qualified / found) * 100, 100) : 0;
  return (
    <div className="flex items-center gap-2.5">
      <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background: '#e2e8f0', width: 64 }}>
        <div className="h-full rounded-full transition-all duration-700"
          style={{ width: `${pct}%`, background: 'linear-gradient(90deg, #7c3aed, #22d3ee)' }} />
      </div>
      <span className="text-[11px] font-semibold" style={{ color: '#7c3aed' }}>{Math.round(pct)}%</span>
    </div>
  );
}

export default function ScrapeRunsPage() {
  const [runs, setRuns]       = useState<ScrapeRun[]>([]);
  const [loading, setLoading] = useState(true);
  const [scraping, setScraping] = useState(false);

  useEffect(() => { fetchRuns(); }, []);

  async function fetchRuns() {
    setLoading(true);
    const res  = await fetch('/api/scrape');
    const json = await res.json();
    setRuns(json.data || []);
    setLoading(false);
  }

  async function triggerScrape() {
    setScraping(true);
    try {
      const res  = await fetch('/api/scrape', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ session: 'manual' }),
      });
      const json = await res.json();
      alert(json.message);
      setTimeout(fetchRuns, 2000);
    } finally { setScraping(false); }
  }

  // Summary stats from runs
  const totalFound = runs.reduce((s, r) => s + (r.totalFound || 0), 0);
  const totalQual  = runs.reduce((s, r) => s + (r.totalQualified || 0), 0);
  const successRate = runs.length > 0
    ? Math.round((runs.filter(r => r.status === 'completed').length / runs.length) * 100) : 0;

  return (
    <div className="p-7 max-w-6xl mx-auto">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }}
        className="flex items-center justify-between mb-7"
      >
        <div>
          <div className="flex items-center gap-3 mb-1">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center"
              style={{ background: 'linear-gradient(135deg, #34d399, #22d3ee)', boxShadow: '0 2px 8px rgba(52,211,153,0.3)' }}>
              <RefreshCw className="w-4 h-4 text-white" />
            </div>
            <h1 className="text-[26px] font-bold tracking-tight" style={{ color: '#0f172a' }}>Scrape Runs</h1>
          </div>
          <p className="text-sm ml-11" style={{ color: '#64748b' }}>
            History of all Tender247 scraping sessions
          </p>
        </div>
        <div className="flex gap-2.5">
          <button onClick={fetchRuns}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-[12px] font-semibold transition-all"
            style={{ background: 'rgba(124,58,237,0.05)', border: '1px solid rgba(124,58,237,0.15)', color: '#7c3aed' }}
            onMouseEnter={e => { e.currentTarget.style.background = 'rgba(124,58,237,0.09)'; }}
            onMouseLeave={e => { e.currentTarget.style.background = 'rgba(124,58,237,0.05)'; }}>
            <RefreshCw className="w-3.5 h-3.5" /> Refresh
          </button>
          <button
            onClick={triggerScrape} disabled={scraping}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-[12px] font-semibold text-white disabled:opacity-60 transition-opacity"
            style={{ background: 'linear-gradient(135deg, #d97706, #b45309)', boxShadow: '0 2px 10px rgba(245,158,11,0.3)' }}>
            <RefreshCw className={`w-3.5 h-3.5 ${scraping ? 'animate-spin' : ''}`} />
            {scraping ? 'Starting…' : 'Run Manual Scrape'}
            <Zap className="w-3 h-3 opacity-80" />
          </button>
        </div>
      </motion.div>

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        {[
          { label: 'Total Runs',      value: runs.length,  color: '#7c3aed', glow: 'rgba(124,58,237,0.1)',  icon: Activity },
          { label: 'Total Scraped',   value: totalFound,   color: '#0284c7', glow: 'rgba(2,132,199,0.1)',   icon: RefreshCw },
          { label: 'Total Qualified', value: totalQual,    color: '#7c3aed', glow: 'rgba(124,58,237,0.1)',   icon: CheckCircle2 },
        ].map(({ label, value, color, glow, icon: Icon }, i) => (
          <motion.div
            key={label}
            initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.08 * i, duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
            className="rounded-2xl p-5 relative overflow-hidden"
            style={CARD_STYLE}
          >
            <div className="absolute -top-6 -right-6 w-28 h-28 rounded-full pointer-events-none"
              style={{ background: `radial-gradient(circle, ${glow} 0%, transparent 70%)`, opacity: 0.8 }} />
            <div className="absolute left-0 top-4 bottom-4 w-[3px] rounded-r-full"
              style={{ background: `linear-gradient(180deg, ${color}, ${color}55)` }} />
            <div className="w-9 h-9 rounded-xl flex items-center justify-center mb-3"
              style={{ background: `${color}10`, border: `1px solid ${color}22` }}>
              <Icon className="w-4 h-4" style={{ color }} />
            </div>
            <p className="text-[28px] font-bold leading-none mb-1" style={{ color: '#0f172a' }}>{value.toLocaleString()}</p>
            <p className="text-[12px]" style={{ color: '#64748b' }}>{label}</p>
          </motion.div>
        ))}
      </div>

      {/* Table */}
      <motion.div
        initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}
        className="rounded-2xl overflow-hidden"
        style={CARD_STYLE}
      >
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="flex flex-col items-center gap-3">
              <div className="w-9 h-9 rounded-xl flex items-center justify-center"
                style={{ background: 'rgba(124,58,237,0.06)', border: '1px solid rgba(124,58,237,0.15)' }}>
                <Loader2 className="w-4 h-4 animate-spin" style={{ color: '#7c3aed' }} />
              </div>
              <p className="text-[13px]" style={{ color: '#94a3b8' }}>Loading runs…</p>
            </div>
          </div>
        ) : runs.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <div className="w-12 h-12 rounded-2xl flex items-center justify-center"
              style={{ background: 'rgba(124,58,237,0.05)', border: '1px solid rgba(124,58,237,0.12)' }}>
              <RefreshCw className="w-5 h-5" style={{ color: 'rgba(124,58,237,0.35)' }} />
            </div>
            <p className="text-[13px]" style={{ color: '#64748b' }}>No scrape runs yet</p>
            <p className="text-[11px]" style={{ color: '#94a3b8' }}>Click &quot;Run Manual Scrape&quot; to get started</p>
          </div>
        ) : (
          <table className="w-full text-[13px]">
            <thead>
              <tr style={{ borderBottom: '1px solid #e2e8f0', background: '#f8fafc' }}>
                {['Run', 'Status', 'Session', 'Started', 'Completed', 'Found', 'Qualified', 'Rejected', 'Qual Rate'].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-[10.5px] font-bold uppercase tracking-wide"
                    style={{ color: '#94a3b8' }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {runs.map((run, i) => (
                <motion.tr
                  key={run.id}
                  initial={{ opacity: 0, x: -4 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.02 * i, duration: 0.25 }}
                  className="transition-colors"
                  style={{ borderBottom: '1px solid #f1f5f9' }}
                  onMouseEnter={e => (e.currentTarget.style.background = 'rgba(124,58,237,0.03)')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                >
                  <td className="px-4 py-3">
                    <span className="text-[12px] font-mono" style={{ color: 'rgba(124,58,237,0.45)' }}>#{run.id}</span>
                  </td>
                  <td className="px-4 py-3"><StatusBadge status={run.status} /></td>
                  <td className="px-4 py-3"><SessionBadge session={run.session} /></td>
                  <td className="px-4 py-3 text-[12px]" style={{ color: '#64748b' }}>
                    {formatDate(run.startedAt)}
                  </td>
                  <td className="px-4 py-3 text-[12px]" style={{ color: '#94a3b8' }}>
                    {run.completedAt ? formatDate(run.completedAt) : <span style={{ color: '#cbd5e1' }}>—</span>}
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-[14px] font-bold" style={{ color: '#0f172a' }}>{run.totalFound}</span>
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-[14px] font-bold" style={{ color: '#16a34a' }}>{run.totalQualified}</span>
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-[14px] font-bold" style={{ color: '#dc2626' }}>{run.totalRejected}</span>
                  </td>
                  <td className="px-4 py-3">
                    <QualBar found={run.totalFound} qualified={run.totalQualified} />
                  </td>
                </motion.tr>
              ))}
            </tbody>
          </table>
        )}

        {/* Footer stats */}
        {runs.length > 0 && (
          <div className="px-5 py-3 flex items-center gap-6 text-[11px]"
            style={{ borderTop: '1px solid #e2e8f0', color: '#94a3b8', background: '#f8fafc' }}>
            <span>{runs.length} total runs</span>
            <span style={{ color: '#16a34a' }}>{successRate}% success rate</span>
            <span>{totalFound.toLocaleString()} total tenders scraped</span>
          </div>
        )}
      </motion.div>
    </div>
  );
}
