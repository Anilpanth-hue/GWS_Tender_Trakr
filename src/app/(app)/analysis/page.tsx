'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import {
  Microscope, CheckCircle2, Clock, ExternalLink,
  Building2, Calendar, IndianRupee,
  ArrowUpRight, Sparkles,
} from 'lucide-react';
import { formatCurrency, formatDate } from '@/lib/utils';
import type { Tender, PaginatedResponse } from '@/types';
import Link from 'next/link';

/* ── Tender Card ─────────────────────────────────────────────── */
function TenderCard({ tender, index }: { tender: Tender; index: number }) {
  const rawAction = tender.l2Analysis?.recommendedAction?.split(/[\s—–]/)[0]?.toUpperCase() || '';
  const isBid     = rawAction.startsWith('BID') && !rawAction.includes('NO');
  const isNoBid   = rawAction.startsWith('NO');
  const isConsor  = rawAction.includes('CONSORTIUM');
  const actionLabel = isBid ? 'BID' : isNoBid ? 'NO-BID' : isConsor ? 'CONSORTIUM' : rawAction ? 'EVALUATE' : '';
  const actionColor = isBid ? '#16a34a' : isNoBid ? '#dc2626' : isConsor ? '#0284c7' : '#d97706';

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.035, duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
      className="group rounded-2xl p-5 transition-all duration-200"
      style={{
        background: '#ffffff',
        border: '1px solid #e2e8f0',
        boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
      }}
      onMouseEnter={e => {
        (e.currentTarget as HTMLElement).style.borderColor = 'rgba(124,58,237,0.25)';
        (e.currentTarget as HTMLElement).style.boxShadow = '0 8px 24px rgba(0,0,0,0.08)';
        (e.currentTarget as HTMLElement).style.transform = 'translateY(-1px)';
      }}
      onMouseLeave={e => {
        (e.currentTarget as HTMLElement).style.borderColor = '#e2e8f0';
        (e.currentTarget as HTMLElement).style.boxShadow = '0 1px 3px rgba(0,0,0,0.04)';
        (e.currentTarget as HTMLElement).style.transform = 'none';
      }}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">

          {/* Status icon + title */}
          <div className="flex items-start gap-2.5 mb-2.5">
            <div className="flex-shrink-0 mt-0.5">
              {tender.l2Analyzed ? (
                <div className="w-5 h-5 rounded-full flex items-center justify-center"
                  style={{ background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.2)' }}>
                  <CheckCircle2 className="w-3 h-3" style={{ color: '#16a34a' }} />
                </div>
              ) : (
                <div className="w-5 h-5 rounded-full flex items-center justify-center"
                  style={{ background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.2)' }}>
                  <Clock className="w-3 h-3" style={{ color: '#d97706' }} />
                </div>
              )}
            </div>
            <h3 className="text-[13.5px] font-semibold leading-snug line-clamp-2" style={{ color: '#0f172a' }}>
              {tender.title}
            </h3>
          </div>

          {/* Meta row */}
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-[12px] mb-2.5" style={{ color: '#94a3b8' }}>
            <span className="flex items-center gap-1.5">
              <Building2 className="w-3 h-3 flex-shrink-0" /> {tender.issuedBy || '—'}
            </span>
            {tender.estimatedValue ? (
              <span className="flex items-center gap-1">
                <IndianRupee className="w-3 h-3" /> {formatCurrency(tender.estimatedValue)}
              </span>
            ) : null}
            {tender.dueDate ? (
              <span className="flex items-center gap-1">
                <Calendar className="w-3 h-3" /> {formatDate(tender.dueDate)}
              </span>
            ) : null}
            <span style={{ color: 'rgba(124,58,237,0.4)', fontFamily: 'monospace' }}>
              T247-{tender.tenderNo}
            </span>
          </div>

          {/* L2 snippet */}
          {tender.l2Analyzed && tender.l2Analysis && (
            <div className="flex items-start gap-2">
              {actionLabel && (
                <span
                  className="text-[10.5px] font-bold px-2 py-0.5 rounded-full flex-shrink-0 mt-0.5"
                  style={{
                    background: `${actionColor}10`,
                    color: actionColor,
                    border: `1px solid ${actionColor}28`,
                  }}
                >
                  {actionLabel}
                </span>
              )}
              <p className="text-[12px] line-clamp-2" style={{ color: '#64748b' }}>
                {tender.l2Analysis.scopeOfWork}
              </p>
            </div>
          )}
        </div>

        {/* CTAs */}
        <div className="flex flex-col gap-2 flex-shrink-0">
          <Link
            href={`/analysis/${tender.id}`}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-[12px] font-semibold text-white transition-all"
            style={{
              background: tender.l2Analyzed
                ? 'linear-gradient(135deg, #7c3aed, #22d3ee)'
                : 'linear-gradient(135deg, #f59e0b, #f97316)',
              boxShadow: tender.l2Analyzed
                ? '0 2px 10px rgba(124,58,237,0.25)'
                : '0 2px 10px rgba(245,158,11,0.25)',
            }}
            onMouseEnter={e => (e.currentTarget.style.opacity = '0.88')}
            onMouseLeave={e => (e.currentTarget.style.opacity = '1')}
          >
            <Microscope className="w-3.5 h-3.5" />
            {tender.l2Analyzed ? 'View' : 'Analyze'}
            <ArrowUpRight className="w-3 h-3 opacity-70" />
          </Link>

          {tender.detailUrl && (
            <a
              href={tender.detailUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-[12px] transition-all"
              style={{
                background: '#f8fafc',
                border: '1px solid #e2e8f0',
                color: '#64748b',
              }}
              onMouseEnter={e => {
                (e.currentTarget as HTMLElement).style.color = '#7c3aed';
                (e.currentTarget as HTMLElement).style.borderColor = 'rgba(124,58,237,0.2)';
              }}
              onMouseLeave={e => {
                (e.currentTarget as HTMLElement).style.color = '#64748b';
                (e.currentTarget as HTMLElement).style.borderColor = '#e2e8f0';
              }}
            >
              <ExternalLink className="w-3.5 h-3.5" /> T247
            </a>
          )}
        </div>
      </div>
    </motion.div>
  );
}

/* ── Main Page ───────────────────────────────────────────────── */
export default function AnalysisPage() {
  const [data, setData] = useState<PaginatedResponse<Tender> | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/tenders?l1Decision=accepted&pageSize=50')
      .then(r => r.json())
      .then(json => setData(json.data))
      .finally(() => setLoading(false));
  }, []);

  const analyzed = data?.data.filter(t => t.l2Analyzed).length ?? 0;
  const total    = data?.data.length ?? 0;
  const pct      = total > 0 ? Math.round((analyzed / total) * 100) : 0;

  return (
    <div className="p-8 max-w-5xl mx-auto">

      {/* ── Header ──────────────────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35 }}
        className="flex items-start justify-between mb-7"
      >
        <div>
          <div className="flex items-center gap-2.5 mb-1">
            <div className="w-8 h-8 rounded-[9px] flex items-center justify-center"
              style={{ background: 'linear-gradient(135deg, #8b5cf6, #7c3aed)', boxShadow: '0 2px 10px rgba(124,58,237,0.3)' }}>
              <Microscope className="w-4 h-4 text-white" />
            </div>
            <h1 className="text-[26px] font-bold tracking-tight" style={{ color: '#0f172a' }}>
              L2 Analysis
            </h1>
          </div>
          <p className="text-[13.5px] ml-[42px]" style={{ color: '#64748b' }}>
            AI-powered deep-dive for accepted tenders
          </p>
        </div>

        {total > 0 && (
          <div className="flex flex-col items-end gap-2">
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl text-[12.5px] font-semibold"
              style={{ background: 'rgba(124,58,237,0.06)', border: '1px solid rgba(124,58,237,0.15)', color: '#7c3aed' }}>
              <Sparkles className="w-3.5 h-3.5" style={{ color: '#22c55e' }} />
              {analyzed}/{total} analyzed
            </div>
            {/* Progress bar */}
            <div className="w-32 h-1.5 rounded-full overflow-hidden" style={{ background: '#e2e8f0' }}>
              <motion.div
                className="h-full rounded-full"
                style={{ background: 'linear-gradient(90deg, #7c3aed, #22d3ee)' }}
                initial={{ width: 0 }}
                animate={{ width: `${pct}%` }}
                transition={{ delay: 0.3, duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
              />
            </div>
          </div>
        )}
      </motion.div>

      {/* ── Content ─────────────────────────────────────────── */}
      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="rounded-2xl p-5" style={{ background: '#ffffff', border: '1px solid #e2e8f0' }}>
              <div className="flex gap-3 mb-3">
                <div className="skeleton w-5 h-5 rounded-full flex-shrink-0" />
                <div className="skeleton h-4 flex-1" />
              </div>
              <div className="skeleton h-3 w-2/3 ml-8" />
            </div>
          ))}
        </div>
      ) : data?.data.length === 0 ? (
        <motion.div
          initial={{ opacity: 0 }} animate={{ opacity: 1 }}
          className="rounded-2xl p-14 flex flex-col items-center text-center"
          style={{ background: '#ffffff', border: '1px solid #e2e8f0' }}
        >
          <div className="w-14 h-14 rounded-2xl flex items-center justify-center mb-4"
            style={{ background: 'rgba(124,58,237,0.05)', border: '1px solid rgba(124,58,237,0.12)' }}>
            <Microscope className="w-7 h-7" style={{ color: 'rgba(124,58,237,0.35)' }} />
          </div>
          <p className="text-[15px] font-semibold mb-1" style={{ color: '#64748b' }}>
            No accepted tenders yet
          </p>
          <p className="text-[13px] mb-5" style={{ color: '#94a3b8' }}>
            Accept tenders from the Tenders screen first.
          </p>
          <Link href="/tenders" className="btn-primary text-[12.5px]">
            Go to Tenders <ArrowUpRight className="w-3.5 h-3.5" />
          </Link>
        </motion.div>
      ) : (
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.18em] mb-3.5"
            style={{ color: '#94a3b8' }}>
            Accepted Tenders — {total} total
          </p>
          <div className="space-y-3">
            {data?.data.map((tender, i) => (
              <TenderCard key={tender.id} tender={tender} index={i} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
