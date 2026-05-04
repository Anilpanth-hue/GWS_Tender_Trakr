'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import Link from 'next/link';
import { useSession } from 'next-auth/react';
import {
  Bookmark, CheckCircle2, Clock, Building2, Calendar,
  IndianRupee, ArrowUpRight, UserCircle, AlertCircle,
  TrendingUp, ShieldCheck,
} from 'lucide-react';
import { formatCurrency, formatDate } from '@/lib/utils';
import type { Tender } from '@/types';

function formatRelativeDate(dateStr: string | null): string {
  if (!dateStr) return '—';
  const date = new Date(dateStr);
  const now = new Date();
  const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays} days ago`;
  return date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

function ActionBadge({ action }: { action: string }) {
  const raw = action.split(/[\s—–]/)[0].toUpperCase();
  const isBid     = raw.startsWith('BID') && !raw.includes('NO');
  const isNoBid   = raw.startsWith('NO');
  const isConsor  = raw.includes('CONSORTIUM');
  const label     = isBid ? 'BID' : isNoBid ? 'NO-BID' : isConsor ? 'CONSORTIUM' : 'EVALUATE';
  const bg        = isBid ? 'rgba(22,163,74,0.08)'  : isNoBid ? 'rgba(220,38,38,0.08)'  : isConsor ? 'rgba(2,132,199,0.08)'  : 'rgba(217,119,6,0.08)';
  const border    = isBid ? 'rgba(22,163,74,0.25)'  : isNoBid ? 'rgba(220,38,38,0.25)'  : isConsor ? 'rgba(2,132,199,0.25)'  : 'rgba(217,119,6,0.25)';
  const color     = isBid ? '#16a34a' : isNoBid ? '#dc2626' : isConsor ? '#0284c7' : '#d97706';
  return (
    <span className="text-[10.5px] font-bold px-2 py-0.5 rounded-full"
      style={{ background: bg, border: `1px solid ${border}`, color }}>
      {label}
    </span>
  );
}

function ScoreBadge({ score }: { score: number }) {
  const color = score >= 7 ? '#16a34a' : score >= 4 ? '#d97706' : '#dc2626';
  const bg    = score >= 7 ? 'rgba(22,163,74,0.08)' : score >= 4 ? 'rgba(217,119,6,0.08)' : 'rgba(220,38,38,0.08)';
  return (
    <span className="flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full"
      style={{ background: bg, color }}>
      <TrendingUp className="w-3 h-3" /> {score}/10
    </span>
  );
}

function TenderCard({ tender, index }: { tender: Tender; index: number }) {
  const analysis = tender.l2Analysis;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.06, duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
      className="rounded-2xl overflow-hidden"
      style={{ background: '#ffffff', border: '1px solid #e2e8f0', boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}
      onMouseEnter={e => {
        (e.currentTarget as HTMLElement).style.borderColor = 'rgba(124,58,237,0.2)';
        (e.currentTarget as HTMLElement).style.boxShadow = '0 8px 24px rgba(0,0,0,0.08)';
        (e.currentTarget as HTMLElement).style.transform = 'translateY(-1px)';
      }}
      onMouseLeave={e => {
        (e.currentTarget as HTMLElement).style.borderColor = '#e2e8f0';
        (e.currentTarget as HTMLElement).style.boxShadow = '0 1px 4px rgba(0,0,0,0.04)';
        (e.currentTarget as HTMLElement).style.transform = 'none';
      }}
    >
      {/* Assigned-by banner */}
      <div className="px-5 py-2.5 flex items-center gap-2 text-[11.5px]"
        style={{ background: 'rgba(124,58,237,0.04)', borderBottom: '1px solid rgba(124,58,237,0.08)' }}>
        <UserCircle className="w-3.5 h-3.5 flex-shrink-0" style={{ color: '#7c3aed' }} />
        <span style={{ color: '#64748b' }}>
          Assigned by{' '}
          <span className="font-semibold" style={{ color: '#7c3aed' }}>
            {tender.assignedByName || tender.assignedByEmail || 'Unknown'}
          </span>
        </span>
        <span className="ml-auto" style={{ color: '#94a3b8' }}>
          {formatRelativeDate(tender.ownerAssignedAt)}
        </span>
      </div>

      {/* Main card body */}
      <div className="p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">

            {/* Status + title */}
            <div className="flex items-start gap-2.5 mb-3">
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
            <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11.5px] mb-3" style={{ color: '#94a3b8' }}>
              <span className="flex items-center gap-1.5">
                <Building2 className="w-3 h-3" /> {tender.issuedBy || '—'}
              </span>
              {tender.estimatedValue ? (
                <span className="flex items-center gap-1">
                  <IndianRupee className="w-3 h-3" /> {formatCurrency(tender.estimatedValue)}
                </span>
              ) : null}
              {tender.dueDate ? (
                <span className="flex items-center gap-1">
                  <Calendar className="w-3 h-3" /> Due {formatDate(tender.dueDate)}
                </span>
              ) : null}
            </div>

            {/* L2 badges */}
            {analysis && (
              <div className="flex flex-wrap gap-2 mb-3">
                <ActionBadge action={analysis.recommendedAction || ''} />
                <ScoreBadge score={analysis.gwsRelevanceScore || 0} />
                {analysis.winProbabilityAssessment && (
                  <span className="flex items-center gap-1 text-[10.5px] px-2 py-0.5 rounded-full font-medium"
                    style={{ background: 'rgba(15,23,42,0.04)', color: '#64748b', border: '1px solid #e2e8f0' }}>
                    <ShieldCheck className="w-3 h-3" />
                    {analysis.winProbabilityAssessment.split(/[—–]/)[0].trim()}
                  </span>
                )}
              </div>
            )}

            {/* Scope of work */}
            {analysis?.scopeOfWork && (
              <p className="text-[12px] leading-relaxed line-clamp-2 mb-1" style={{ color: '#475569' }}>
                {analysis.scopeOfWork}
              </p>
            )}

            {!tender.l2Analyzed && (
              <p className="text-[12px] italic" style={{ color: '#94a3b8' }}>
                L2 analysis not yet run for this tender.
              </p>
            )}
          </div>

          {/* View Analysis button */}
          <div className="flex-shrink-0">
            <Link href={`/analysis/${tender.id}`}>
              <motion.div
                whileHover={{ scale: 1.04 }}
                whileTap={{ scale: 0.97 }}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-[12px] font-semibold cursor-pointer"
                style={{
                  background: 'rgba(124,58,237,0.08)',
                  border: '1px solid rgba(124,58,237,0.2)',
                  color: '#7c3aed',
                }}
              >
                View <ArrowUpRight className="w-3.5 h-3.5" />
              </motion.div>
            </Link>
          </div>
        </div>

        {/* PQC snapshot — only if L2 done */}
        {analysis?.pqcRequirements && (
          <div className="mt-4 pt-4 grid grid-cols-3 gap-3"
            style={{ borderTop: '1px solid #f1f5f9' }}>
            {[
              { label: 'Turnover', value: analysis.pqcRequirements.turnoverCriteria },
              { label: 'Experience', value: analysis.pqcRequirements.experienceCriteria },
              { label: 'Technical', value: analysis.pqcRequirements.technicalCriteria },
            ].map(({ label, value }) => (
              <div key={label} className="rounded-xl p-3"
                style={{ background: '#f8fafc', border: '1px solid #e2e8f0' }}>
                <p className="text-[9.5px] font-bold uppercase tracking-wide mb-1" style={{ color: '#94a3b8' }}>{label}</p>
                <p className="text-[11px] leading-snug line-clamp-2" style={{ color: '#334155' }}>
                  {value && !value.toLowerCase().includes('not mentioned') && !value.toLowerCase().includes('no criteria')
                    ? value : <span style={{ color: '#94a3b8', fontStyle: 'italic' }}>Not specified</span>}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>
    </motion.div>
  );
}

/* ── Main Page ─────────────────────────────────────────────────── */
export default function MyTendersPage() {
  const { data: session } = useSession();
  const [tenders, setTenders] = useState<Tender[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/tenders/mine')
      .then(r => r.json())
      .then(json => {
        if (json.error) throw new Error(json.error);
        setTenders(json.data || []);
      })
      .catch(err => setError((err as Error).message))
      .finally(() => setLoading(false));
  }, []);

  const analyzed   = tenders.filter(t => t.l2Analyzed).length;
  const pending    = tenders.length - analyzed;

  return (
    <div className="px-8 py-8 max-w-4xl mx-auto">

      {/* Header */}
      <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}
        className="mb-8">
        <div className="flex items-center gap-3 mb-1">
          <div className="w-9 h-9 rounded-[12px] flex items-center justify-center flex-shrink-0"
            style={{ background: 'rgba(124,58,237,0.1)', border: '1px solid rgba(124,58,237,0.2)' }}>
            <Bookmark className="w-4.5 h-4.5" style={{ color: '#7c3aed' }} />
          </div>
          <div>
            <h1 className="text-[22px] font-bold" style={{ color: '#0f172a' }}>My Tenders</h1>
            <p className="text-[12.5px]" style={{ color: '#94a3b8' }}>
              Tenders assigned to {session?.user?.name || session?.user?.email || 'you'}
            </p>
          </div>
        </div>
      </motion.div>

      {/* Stats bar */}
      {!loading && tenders.length > 0 && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.1 }}
          className="flex gap-4 mb-6">
          {[
            { label: 'Assigned', value: tenders.length, color: '#7c3aed' },
            { label: 'L2 Done', value: analyzed, color: '#16a34a' },
            { label: 'Pending Analysis', value: pending, color: '#d97706' },
          ].map(({ label, value, color }) => (
            <div key={label} className="rounded-xl px-4 py-2.5 flex items-center gap-2.5"
              style={{ background: '#ffffff', border: '1px solid #e2e8f0' }}>
              <span className="text-[18px] font-bold" style={{ color }}>{value}</span>
              <span className="text-[12px]" style={{ color: '#94a3b8' }}>{label}</span>
            </div>
          ))}
        </motion.div>
      )}

      {/* States */}
      {loading && (
        <div className="flex flex-col items-center justify-center py-24 gap-3">
          <div className="w-7 h-7 border-2 border-t-transparent rounded-full animate-spin"
            style={{ borderColor: 'rgba(124,58,237,0.2)', borderTopColor: '#7c3aed' }} />
          <p className="text-[13px]" style={{ color: '#94a3b8' }}>Loading your tenders…</p>
        </div>
      )}

      {!loading && error && (
        <div className="rounded-2xl p-6 flex items-center gap-3"
          style={{ background: 'rgba(220,38,38,0.04)', border: '1px solid rgba(220,38,38,0.15)' }}>
          <AlertCircle className="w-5 h-5 flex-shrink-0" style={{ color: '#dc2626' }} />
          <p className="text-[13px]" style={{ color: '#dc2626' }}>{error}</p>
        </div>
      )}

      {!loading && !error && tenders.length === 0 && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2 }}
          className="flex flex-col items-center justify-center py-24 gap-4">
          <div className="w-16 h-16 rounded-2xl flex items-center justify-center"
            style={{ background: 'rgba(124,58,237,0.06)', border: '1px solid rgba(124,58,237,0.12)' }}>
            <Bookmark className="w-7 h-7" style={{ color: 'rgba(124,58,237,0.4)' }} />
          </div>
          <div className="text-center">
            <p className="text-[15px] font-semibold mb-1" style={{ color: '#334155' }}>No tenders assigned yet</p>
            <p className="text-[13px]" style={{ color: '#94a3b8' }}>
              When someone assigns a tender to you from the L2 Analysis page, it will appear here.
            </p>
          </div>
        </motion.div>
      )}

      {/* Tender list */}
      {!loading && !error && tenders.length > 0 && (
        <div className="space-y-4">
          {tenders.map((tender, i) => (
            <TenderCard key={tender.id} tender={tender} index={i} />
          ))}
        </div>
      )}
    </div>
  );
}