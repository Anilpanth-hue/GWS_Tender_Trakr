'use client';

import { useEffect, useState, useRef } from 'react';
import { motion } from 'framer-motion';
import {
  FileText, XCircle, Clock,
  RefreshCw, TrendingUp, Microscope, Zap,
  Activity, ArrowUpRight, Target, Sparkles,
} from 'lucide-react';
import Link from 'next/link';
import { formatDate } from '@/lib/utils';
import type { ScrapeRun } from '@/types';
import type { DashboardStats } from '@/app/api/dashboard/route';
import {
  AreaChart, Area, XAxis, YAxis, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell,
} from 'recharts';

/* ── Animated counter ─────────────────────────────────────────── */
function useCounter(target: number, ms = 900) {
  const [val, setVal] = useState(0);
  const ref = useRef<ReturnType<typeof setInterval> | null>(null);
  useEffect(() => {
    if (ref.current) clearInterval(ref.current);
    if (target === 0) { setVal(0); return; }
    const steps = 40;
    let cur = 0;
    ref.current = setInterval(() => {
      cur += target / steps;
      if (cur >= target) { setVal(target); clearInterval(ref.current!); }
      else setVal(Math.round(cur));
    }, ms / steps);
    return () => { if (ref.current) clearInterval(ref.current); };
  }, [target, ms]);
  return val;
}

/* ── Stat Card ────────────────────────────────────────────────── */
function StatCard({
  label, value, icon: Icon, color, href, delay = 0, sub,
}: {
  label: string; value: number; icon: React.ElementType;
  color: string; href?: string; delay?: number; sub?: string;
}) {
  const count = useCounter(value);
  const rgb = hexToRgb(color);

  const inner = (
    <motion.div
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.48, ease: [0.22, 1, 0.36, 1] }}
      className="grad-card p-5 group cursor-pointer relative overflow-hidden"
    >
      {/* Corner ambient glow */}
      <div
        className="absolute -top-8 -right-8 w-36 h-36 rounded-full pointer-events-none transition-opacity duration-300 opacity-30 group-hover:opacity-60"
        style={{ background: `radial-gradient(circle, rgba(${rgb},0.18) 0%, transparent 70%)` }}
      />
      {/* Bottom shimmer line */}
      <div
        className="absolute bottom-0 left-0 right-0 h-px opacity-0 group-hover:opacity-100 transition-opacity duration-400"
        style={{ background: `linear-gradient(90deg, transparent 5%, rgba(${rgb},0.5) 50%, transparent 95%)` }}
      />

      {/* Icon badge */}
      <div
        className="w-9 h-9 rounded-xl flex items-center justify-center mb-5 relative z-10"
        style={{
          background: `rgba(${rgb},0.08)`,
          border: `1px solid rgba(${rgb},0.18)`,
        }}
      >
        <Icon className="w-[17px] h-[17px]" style={{ color }} />
      </div>

      {/* Counter */}
      <p className="text-[32px] font-bold leading-none tracking-tight mb-1.5 relative z-10" style={{ color: '#0f172a' }}>
        {count.toLocaleString()}
      </p>

      {/* Label */}
      <p className="text-[12.5px] font-medium relative z-10" style={{ color: '#64748b' }}>
        {label}
      </p>
      {sub && (
        <p className="text-[11px] mt-0.5 relative z-10" style={{ color: '#94a3b8' }}>{sub}</p>
      )}

      {/* Arrow */}
      {href && (
        <ArrowUpRight
          className="absolute top-4 right-4 w-4 h-4 z-10 opacity-0 group-hover:opacity-50 transition-all duration-200 group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
          style={{ color }}
        />
      )}
    </motion.div>
  );

  return href ? <Link href={href} className="block">{inner}</Link> : inner;
}

function hexToRgb(hex: string): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `${r},${g},${b}`;
}

/* ── Donut ─────────────────────────────────────────────────────── */
const DONUT_COLORS = ['#7c3aed', '#ef4444', '#f59e0b', '#22c55e'];

function QualDonut({ q, r, p, l2 }: { q: number; r: number; p: number; l2: number }) {
  const data = [
    { name: 'Qualified', value: q  || 0.01 },
    { name: 'Rejected',  value: r  || 0.01 },
    { name: 'Pending',   value: p  || 0.01 },
    { name: 'L2 Done',   value: l2 || 0.01 },
  ];
  const total = q + r + p + l2;
  return (
    <div>
      <div className="relative w-[156px] h-[156px] mx-auto">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={data} cx="50%" cy="50%"
              innerRadius={48} outerRadius={70}
              strokeWidth={0} dataKey="value" paddingAngle={3}>
              {data.map((_, i) => <Cell key={i} fill={DONUT_COLORS[i]} opacity={0.9} />)}
            </Pie>
          </PieChart>
        </ResponsiveContainer>
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          <p className="text-[22px] font-bold" style={{ color: '#0f172a' }}>{total}</p>
          <p className="text-[9.5px] font-bold uppercase tracking-wider" style={{ color: '#94a3b8' }}>Total</p>
        </div>
      </div>
      <div className="mt-4 space-y-2">
        {data.map((d, i) => (
          <div key={d.name} className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full" style={{ background: DONUT_COLORS[i] }} />
              <span className="text-[12px]" style={{ color: '#64748b' }}>{d.name}</span>
            </div>
            <span className="text-[12px] font-bold" style={{ color: '#0f172a' }}>
              {Math.round(d.value === 0.01 ? 0 : d.value)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ── Area chart ─────────────────────────────────────────────────── */
function RunsChart({ runs }: { runs: ScrapeRun[] }) {
  const data = [...runs].reverse().slice(-10).map(r => ({
    d: formatDate(r.startedAt)?.slice(0, 5) || '',
    Found: r.totalFound,
    Qualified: r.totalQualified,
  }));
  if (!data.length) return (
    <div className="flex flex-col items-center justify-center h-full gap-2">
      <Activity className="w-6 h-6 opacity-20" style={{ color: '#7c3aed' }} />
      <p className="text-[12px]" style={{ color: '#94a3b8' }}>No runs yet</p>
    </div>
  );
  return (
    <ResponsiveContainer width="100%" height="100%">
      <AreaChart data={data} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
        <defs>
          <linearGradient id="gF" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#7c3aed" stopOpacity={0.25} />
            <stop offset="100%" stopColor="#7c3aed" stopOpacity={0.02} />
          </linearGradient>
          <linearGradient id="gQ" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#22d3ee" stopOpacity={0.25} />
            <stop offset="100%" stopColor="#22d3ee" stopOpacity={0.02} />
          </linearGradient>
        </defs>
        <XAxis dataKey="d" tick={{ fill:'#94a3b8', fontSize:11 }} axisLine={false} tickLine={false} />
        <YAxis tick={{ fill:'#94a3b8', fontSize:11 }} axisLine={false} tickLine={false} allowDecimals={false} />
        <Tooltip
          contentStyle={{
            background: '#ffffff',
            border: '1px solid #e2e8f0',
            borderRadius: '10px',
            fontSize: 12,
            color: '#0f172a',
            boxShadow: '0 8px 24px rgba(0,0,0,0.1)',
          }}
          cursor={{ stroke:'rgba(124,58,237,0.12)', strokeWidth:1 }}
        />
        <Area type="monotone" dataKey="Found"     stroke="#7c3aed" strokeWidth={2} fill="url(#gF)" dot={false} />
        <Area type="monotone" dataKey="Qualified" stroke="#22d3ee" strokeWidth={2} fill="url(#gQ)" dot={false} />
      </AreaChart>
    </ResponsiveContainer>
  );
}

/* ── Dashboard page ─────────────────────────────────────────────── */
export default function DashboardPage() {
  const [stats, setStats]     = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [scraping, setScraping] = useState(false);

  useEffect(() => { fetchData(); }, []);

  async function fetchData() {
    setLoading(true);
    try {
      const res = await fetch('/api/dashboard');
      const { data } = await res.json();
      setStats(data);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }

  async function triggerScrape() {
    setScraping(true);
    try {
      const res = await fetch('/api/scrape', {
        method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ session:'manual' }),
      });
      const d = await res.json();
      alert(d.message || 'Scrape started!');
      setTimeout(fetchData, 3000);
    } catch { alert('Failed to start scrape'); }
    finally { setScraping(false); }
  }

  if (loading) return (
    <div className="p-8 max-w-[1380px] mx-auto">
      <div className="flex items-center justify-between mb-8">
        <div>
          <div className="skeleton h-8 w-52 mb-3" />
          <div className="skeleton h-4 w-72" />
        </div>
        <div className="skeleton h-10 w-36 rounded-xl" />
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {Array.from({length:8}).map((_,i) => (
          <div key={i} className="grad-card p-5">
            <div className="skeleton h-9 w-9 rounded-xl mb-5" />
            <div className="skeleton h-8 w-16 mb-2" />
            <div className="skeleton h-4 w-24" />
          </div>
        ))}
      </div>
    </div>
  );

  const CARDS = [
    { label:'Total Tenders',     value:stats?.totalTenders    ||0, icon:FileText,   color:'#7c3aed', href:'/tenders',                                              delay:0 },
    { label:'Auto-Qualified',    value:stats?.qualifiedTenders||0, icon:TrendingUp, color:'#22d3ee', href:'/tenders?l1Status=qualified',                           delay:0.05 },
    { label:'Awaiting Review',   value:stats?.pendingDecision ||0, icon:Clock,      color:'#f59e0b', href:'/tenders?l1Status=qualified&l1Decision=pending',        delay:0.10,
      sub: stats?.pendingDecision ? 'Needs your attention' : undefined },
    { label:'Accepted for L2',   value:stats?.acceptedL1      ||0, icon:Target,     color:'#8b5cf6', href:'/analysis',                                             delay:0.15 },
    { label:'Auto-Rejected',     value:stats?.rejectedTenders ||0, icon:XCircle,    color:'#ef4444', href:'/tenders?l1Status=rejected',                           delay:0.20 },
    { label:'Manually Rejected', value:stats?.rejectedL1      ||0, icon:XCircle,    color:'#f97316', href:'/tenders?l1Decision=rejected',                         delay:0.25 },
    { label:'L2 AI Analyzed',    value:stats?.l2Analyzed      ||0, icon:Microscope, color:'#22c55e', href:'/analysis',                                             delay:0.30 },
    { label:'Last Run Found',    value:stats?.todayFound       ||0, icon:RefreshCw, color:'#64748b',                                                                delay:0.35, sub:'Most recent scrape' },
  ];

  return (
    <div className="p-8 max-w-[1380px] mx-auto">

      {/* ── Header ─────────────────────────────────────────── */}
      <motion.div
        initial={{ opacity:0, y:-12 }} animate={{ opacity:1, y:0 }}
        transition={{ duration:0.45, ease:[0.22,1,0.36,1] }}
        className="flex items-start justify-between mb-8"
      >
        <div>
          {/* Eyebrow */}
          <div className="flex items-center gap-2 mb-2">
            <Sparkles className="w-3.5 h-3.5" style={{ color:'#7c3aed' }} />
            <span className="text-[11px] font-bold uppercase tracking-[0.22em]" style={{ color:'rgba(124,58,237,0.6)' }}>
              GWS Tender Intelligence
            </span>
          </div>
          {/* Gradient headline */}
          <h1 className="text-[30px] font-bold tracking-tight leading-tight text-gradient mb-1.5">
            Command Centre
          </h1>
          <p className="text-[13.5px]" style={{ color:'#64748b' }}>
            Live overview of all scraped and screened tenders
          </p>
        </div>

        <motion.button
          onClick={triggerScrape}
          disabled={scraping}
          className="btn-amber"
          whileHover={{ scale:1.03, y:-1 }}
          whileTap={{ scale:0.97 }}
        >
          <RefreshCw className={`w-3.5 h-3.5 ${scraping ? 'animate-spin' : ''}`} />
          {scraping ? 'Scraping…' : 'Run Scrape'}
          <Zap className="w-3.5 h-3.5 opacity-80" />
        </motion.button>
      </motion.div>

      {/* ── Pending alert banner ─────────────────────────── */}
      {(stats?.pendingDecision ?? 0) > 0 && (
        <motion.div
          initial={{ opacity:0, y:-6 }} animate={{ opacity:1, y:0 }}
          transition={{ delay:0.1 }}
          className="mb-6 rounded-xl px-5 py-3.5 flex items-center justify-between"
          style={{
            background: 'rgba(245,158,11,0.05)',
            border: '1px solid rgba(245,158,11,0.2)',
          }}
        >
          <div className="flex items-center gap-3">
            <span className="w-2 h-2 rounded-full pulse-dot" style={{ background:'#f59e0b' }} />
            <p className="text-[13px] font-semibold" style={{ color:'#d97706' }}>
              {stats?.pendingDecision} tender{stats!.pendingDecision > 1 ? 's' : ''} waiting for your Accept / Reject decision
            </p>
          </div>
          <Link href="/tenders?l1Status=qualified&l1Decision=pending"
            className="flex items-center gap-1 text-[12px] font-bold transition-opacity hover:opacity-75"
            style={{ color:'#f59e0b' }}>
            Review now <ArrowUpRight className="w-3.5 h-3.5" />
          </Link>
        </motion.div>
      )}

      {/* ── KPI Grid ───────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-5">
        {CARDS.map(c => <StatCard key={c.label} {...c} />)}
      </div>

      {/* ── Bottom charts row ───────────────────────────────── */}
      <div className="grid grid-cols-12 gap-4">

        {/* Area chart — 7 cols */}
        <motion.div
          initial={{ opacity:0, y:14 }} animate={{ opacity:1, y:0 }}
          transition={{ delay:0.42, duration:0.4, ease:[0.22,1,0.36,1] }}
          className="col-span-12 lg:col-span-7 grad-card p-6"
        >
          <div className="flex items-center justify-between mb-5">
            <div>
              <p className="text-[14px] font-semibold" style={{ color:'#0f172a' }}>Scrape Activity</p>
              <p className="text-[12px] mt-0.5" style={{ color:'#64748b' }}>Found vs Qualified · last 10 runs</p>
            </div>
            <div className="flex gap-5 text-[11.5px]">
              <span className="flex items-center gap-2" style={{ color:'#64748b' }}>
                <span className="w-8 h-[2px] rounded-full inline-block" style={{ background:'#7c3aed' }} /> Found
              </span>
              <span className="flex items-center gap-2" style={{ color:'#64748b' }}>
                <span className="w-8 h-[2px] rounded-full inline-block" style={{ background:'#22d3ee' }} /> Qualified
              </span>
            </div>
          </div>
          <div className="h-[196px]"><RunsChart runs={stats?.recentRuns || []} /></div>
        </motion.div>

        {/* Donut — 2 cols */}
        <motion.div
          initial={{ opacity:0, y:14 }} animate={{ opacity:1, y:0 }}
          transition={{ delay:0.48, duration:0.4, ease:[0.22,1,0.36,1] }}
          className="col-span-12 lg:col-span-2 grad-card p-5"
        >
          <p className="text-[14px] font-semibold mb-4" style={{ color:'#0f172a' }}>Breakdown</p>
          <QualDonut
            q={stats?.qualifiedTenders ||0}
            r={stats?.rejectedTenders  ||0}
            p={stats?.pendingDecision  ||0}
            l2={stats?.l2Analyzed      ||0}
          />
        </motion.div>

        {/* Recent Runs — 3 cols */}
        <motion.div
          initial={{ opacity:0, y:14 }} animate={{ opacity:1, y:0 }}
          transition={{ delay:0.54, duration:0.4, ease:[0.22,1,0.36,1] }}
          className="col-span-12 lg:col-span-3 grad-card overflow-hidden"
        >
          <div className="px-5 py-4 flex items-center justify-between"
            style={{ borderBottom:'1px solid #e2e8f0' }}>
            <p className="text-[14px] font-semibold" style={{ color:'#0f172a' }}>Recent Runs</p>
            <Link href="/scrape-runs"
              className="text-[11.5px] font-semibold flex items-center gap-0.5 transition-opacity hover:opacity-70"
              style={{ color:'#7c3aed' }}>
              All <ArrowUpRight className="w-3 h-3" />
            </Link>
          </div>
          <div>
            {!(stats?.recentRuns?.length) ? (
              <div className="px-5 py-10 flex flex-col items-center gap-2">
                <Activity className="w-5 h-5 opacity-20" style={{ color:'#7c3aed' }} />
                <p className="text-[12px]" style={{ color:'#94a3b8' }}>No runs yet</p>
              </div>
            ) : stats.recentRuns.slice(0, 6).map((run, i) => {
              const sc = run.status === 'completed' ? '#22c55e' : run.status === 'failed' ? '#ef4444' : '#7c3aed';
              return (
                <motion.div
                  key={run.id}
                  initial={{ opacity:0, x:8 }}
                  animate={{ opacity:1, x:0 }}
                  transition={{ delay:0.54+i*0.03 }}
                  className="px-5 py-3 flex items-center gap-3 transition-colors"
                  style={{ borderBottom:'1px solid #f1f5f9' }}
                  onMouseEnter={e => (e.currentTarget.style.background = '#f8fafc')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                >
                  <span className="w-2 h-2 rounded-full flex-shrink-0"
                    style={{ background:sc, boxShadow:`0 0 6px ${sc}55` }} />
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] font-semibold capitalize" style={{ color:'#0f172a' }}>{run.session}</p>
                    <p className="text-[11px]" style={{ color:'#94a3b8' }}>{formatDate(run.startedAt)}</p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-[14px] font-bold" style={{ color:'#0f172a' }}>{run.totalFound}</p>
                    <p className="text-[11px] font-semibold" style={{ color:'#22d3ee' }}>{run.totalQualified} qual</p>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </motion.div>
      </div>
    </div>
  );
}
