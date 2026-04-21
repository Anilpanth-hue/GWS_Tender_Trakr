'use client';

import { useEffect, useState, useCallback, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Search, Filter, ExternalLink, ChevronLeft, ChevronRight,
  CheckCircle2, XCircle, Clock, X, Building2, MapPin,
  Calendar, DollarSign, FileText, Microscope, AlertCircle,
  ArrowRight, ChevronDown, ChevronUp, Zap, Loader2, Hash,
  SlidersHorizontal,
} from 'lucide-react';
import { formatCurrency, formatDate, getDaysUntilDue, cn } from '@/lib/utils';
import type { Tender, PaginatedResponse } from '@/types';
import Link from 'next/link';

/* ── Helpers ──────────────────────────────────────────────────── */
function dueDateStyle(d: string | null) {
  if (!d) return { color: '#94a3b8', label: null };
  const days = getDaysUntilDue(d);
  if (days === null) return { color: '#94a3b8', label: null };
  if (days < 0)  return { color: '#ef4444', label: 'Expired' };
  if (days <= 3) return { color: '#f97316', label: `${days}d left` };
  if (days <= 7) return { color: '#f59e0b', label: `${days}d left` };
  return { color: '#64748b', label: `${days}d` };
}

/* ── Badges ─────────────────────────────────────────────────── */
function DecisionBadge({ d }: { d: string }) {
  if (d === 'accepted') return (
    <span className="badge" style={{ background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.2)', color: '#16a34a' }}>
      <CheckCircle2 className="w-3 h-3" /> Accepted
    </span>
  );
  if (d === 'rejected') return (
    <span className="badge" style={{ background: 'rgba(239,68,68,0.07)', border: '1px solid rgba(239,68,68,0.18)', color: '#dc2626' }}>
      <XCircle className="w-3 h-3" /> Rejected
    </span>
  );
  return (
    <span className="badge" style={{ background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.2)', color: '#d97706' }}>
      <Clock className="w-3 h-3" /> Pending
    </span>
  );
}

function L1Badge({ status }: { status: string }) {
  if (status === 'qualified') return (
    <span className="badge" style={{ background: 'rgba(124,58,237,0.08)', border: '1px solid rgba(124,58,237,0.2)', color: '#7c3aed' }}>
      Qualified
    </span>
  );
  return (
    <span className="badge" style={{ background: '#f1f5f9', border: '1px solid #e2e8f0', color: '#64748b' }}>
      Excluded
    </span>
  );
}

/* ── Preview Panel ─────────────────────────────────────────── */
function PreviewPanel({
  tender, onClose, onAccept, onReject, updating,
}: {
  tender: Tender; onClose: () => void;
  onAccept: () => void; onReject: () => void; updating: boolean;
}) {
  const { color: dateColor } = dueDateStyle(tender.dueDate);
  const days = getDaysUntilDue(tender.dueDate);

  return (
    <div className="fixed inset-0 z-40 flex">
      {/* Backdrop */}
      <motion.div
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="flex-1"
        style={{ background: 'rgba(15,23,42,0.4)', backdropFilter: 'blur(4px)' }}
        onClick={onClose}
      />

      {/* Panel */}
      <motion.div
        initial={{ x: '100%' }}
        animate={{ x: 0 }}
        exit={{ x: '100%' }}
        transition={{ type: 'spring', damping: 30, stiffness: 280 }}
        className="w-full max-w-[500px] flex flex-col h-full"
        style={{
          background: '#ffffff',
          borderLeft: '1px solid #e2e8f0',
          boxShadow: '-20px 0 60px rgba(0,0,0,0.1)',
        }}
      >
        {/* Header */}
        <div className="px-6 py-5" style={{ borderBottom: '1px solid #e2e8f0' }}>
          <div className="flex items-start gap-3">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-2.5 flex-wrap">
                <L1Badge status={tender.l1Status} />
                <DecisionBadge d={tender.l1Decision} />
              </div>
              <h2 className="text-[14.5px] font-semibold leading-snug capitalize" style={{ color: '#0f172a' }}>
                {tender.title}
              </h2>
            </div>
            <button
              onClick={onClose}
              className="flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center transition-colors"
              style={{ background: '#f8fafc', border: '1px solid #e2e8f0' }}
              onMouseEnter={e => (e.currentTarget.style.background = '#f1f5f9')}
              onMouseLeave={e => (e.currentTarget.style.background = '#f8fafc')}
            >
              <X className="w-4 h-4" style={{ color: '#64748b' }} />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">

          {/* Key facts grid */}
          <div className="grid grid-cols-2 gap-3">
            {[
              { icon: FileText,   label: 'Tender No',  value: tender.tenderNo, mono: true },
              { icon: DollarSign, label: 'Est. Value',  value: tender.estimatedValue ? formatCurrency(tender.estimatedValue) : (tender.estimatedValueRaw || '—') },
              { icon: Calendar,   label: 'Due Date',    value: formatDate(tender.dueDate) || '—',
                sub: days !== null && days >= 0 ? `${days} days remaining` : undefined, color: dateColor },
              { icon: MapPin,     label: 'Location',   value: tender.location || '—' },
            ].map(({ icon: Icon, label, value, mono, sub, color }) => (
              <div
                key={label}
                className="rounded-xl p-3"
                style={{ background: '#f8fafc', border: '1px solid #e2e8f0' }}
              >
                <div className="flex items-center gap-1.5 text-[10.5px] font-bold uppercase tracking-wide mb-1.5"
                  style={{ color: '#94a3b8' }}>
                  <Icon className="w-3 h-3" /> {label}
                </div>
                <p className={cn('text-[13px] font-semibold', mono && 'font-mono')} style={{ color: color || '#0f172a' }}>
                  {value}
                </p>
                {sub && <p className="text-[11px] mt-0.5" style={{ color: '#94a3b8' }}>{sub}</p>}
              </div>
            ))}
          </div>

          {/* Issuing authority */}
          <div className="rounded-xl p-4 flex items-start gap-3"
            style={{ background: 'rgba(56,189,248,0.05)', border: '1px solid rgba(56,189,248,0.15)' }}>
            <Building2 className="w-4 h-4 flex-shrink-0 mt-0.5" style={{ color: '#38bdf8' }} />
            <div>
              <p className="text-[10.5px] font-bold uppercase tracking-wide mb-1" style={{ color: 'rgba(56,189,248,0.7)' }}>
                Issuing Authority
              </p>
              <p className="text-[13.5px] font-semibold" style={{ color: '#0f172a' }}>{tender.issuedBy}</p>
            </div>
          </div>

          {/* L1 reasons */}
          {tender.l1Status === 'qualified' && tender.l1QualificationReasons?.length > 0 && (
            <div className="rounded-xl p-4"
              style={{ background: 'rgba(124,58,237,0.04)', border: '1px solid rgba(124,58,237,0.15)' }}>
              <p className="text-[10.5px] font-bold uppercase tracking-wide mb-2.5" style={{ color: 'rgba(124,58,237,0.6)' }}>
                Why auto-qualified
              </p>
              <ul className="space-y-1.5">
                {tender.l1QualificationReasons.map((r, i) => (
                  <li key={i} className="flex items-start gap-2 text-[12.5px]" style={{ color: '#334155' }}>
                    <CheckCircle2 className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" style={{ color: '#7c3aed' }} />
                    {r}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {tender.l1Status === 'rejected' && tender.l1ExclusionReason && (
            <div className="rounded-xl p-4"
              style={{ background: 'rgba(239,68,68,0.04)', border: '1px solid rgba(239,68,68,0.15)' }}>
              <p className="text-[10.5px] font-bold uppercase tracking-wide mb-1.5" style={{ color: 'rgba(239,68,68,0.65)' }}>
                Why auto-excluded
              </p>
              <p className="text-[12.5px]" style={{ color: '#475569' }}>{tender.l1ExclusionReason}</p>
            </div>
          )}

          {tender.l1Decision === 'rejected' && tender.l1DecisionReason && (
            <div className="rounded-xl p-4"
              style={{ background: 'rgba(249,115,22,0.05)', border: '1px solid rgba(249,115,22,0.15)' }}>
              <p className="text-[10.5px] font-bold uppercase tracking-wide mb-1.5" style={{ color: 'rgba(249,115,22,0.65)' }}>
                Rejection reason
              </p>
              <p className="text-[12.5px]" style={{ color: '#475569' }}>{tender.l1DecisionReason}</p>
            </div>
          )}

          {/* What happens next */}
          <div className="rounded-xl p-4"
            style={{ background: 'rgba(124,58,237,0.04)', border: '1px solid rgba(124,58,237,0.14)' }}>
            <p className="text-[10.5px] font-bold uppercase tracking-wide mb-3" style={{ color: 'rgba(124,58,237,0.6)' }}>
              What happens next
            </p>
            {[
              'Accept → enters L2 Analysis queue',
              'Gemini AI reads document, produces GWS intelligence report',
              'Output: scope, PQC, fit score, BID / NO-BID recommendation',
            ].map((s, i) => (
              <div key={i} className="flex items-start gap-2.5 mb-2 last:mb-0">
                <span className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold flex-shrink-0 mt-0.5"
                  style={{ background: 'rgba(124,58,237,0.1)', color: '#7c3aed' }}>{i + 1}</span>
                <p className="text-[12.5px]" style={{ color: '#475569' }}>{s}</p>
              </div>
            ))}
          </div>

          {tender.detailUrl && (
            <a href={tender.detailUrl} target="_blank" rel="noopener noreferrer"
              className="flex items-center justify-between gap-3 rounded-xl px-4 py-3 transition-colors group"
              style={{ background: '#f8fafc', border: '1px solid #e2e8f0' }}
              onMouseEnter={e => (e.currentTarget.style.borderColor = 'rgba(124,58,237,0.25)')}
              onMouseLeave={e => (e.currentTarget.style.borderColor = '#e2e8f0')}>
              <span className="text-[13px] font-medium" style={{ color: '#64748b' }}>
                View on Tender247
              </span>
              <ExternalLink className="w-4 h-4 opacity-40 group-hover:opacity-70 transition-opacity" style={{ color: '#7c3aed' }} />
            </a>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4" style={{ borderTop: '1px solid #e2e8f0', background: '#f8fafc' }}>
          {tender.l1Decision === 'accepted' ? (
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2 text-[13px] font-medium flex-1" style={{ color: '#16a34a' }}>
                <CheckCircle2 className="w-4 h-4" /> Accepted for L2 Analysis
              </div>
              <Link href={`/analysis/${tender.id}`}
                className="btn-primary text-[12px]">
                <Microscope className="w-3.5 h-3.5" /> Open L2
              </Link>
            </div>
          ) : tender.l1Status === 'qualified' ? (
            <div className="space-y-2.5">
              <p className="text-[11px] font-bold uppercase tracking-wide" style={{ color: '#94a3b8' }}>
                Your Decision
              </p>
              <div className="flex gap-2.5">
                <button
                  disabled={updating} onClick={onAccept}
                  className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-[13px] font-bold text-white disabled:opacity-50 transition-all hover:opacity-90"
                  style={{ background: 'linear-gradient(135deg, #f59e0b, #f97316)', boxShadow: '0 2px 12px rgba(245,158,11,0.3)' }}
                >
                  <CheckCircle2 className="w-4 h-4" /> Accept → L2
                </button>
                <button
                  disabled={updating} onClick={onReject}
                  className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-[13px] font-bold disabled:opacity-50 transition-all"
                  style={{ background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.2)', color: '#dc2626' }}
                  onMouseEnter={e => (e.currentTarget.style.background = 'rgba(239,68,68,0.1)')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'rgba(239,68,68,0.06)')}
                >
                  <XCircle className="w-4 h-4" /> Reject
                </button>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-2 text-[13px]" style={{ color: '#94a3b8' }}>
              <AlertCircle className="w-4 h-4" /> Auto-excluded — no L2 available
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
}

/* ── Reject Modal ──────────────────────────────────────────── */
function RejectModal({ tender, onConfirm, onCancel }: {
  tender: Tender; onConfirm: (r: string) => void; onCancel: () => void;
}) {
  const [reason, setReason] = useState('');
  return (
    <div className="fixed inset-0 flex items-center justify-center z-50 p-4"
      style={{ background: 'rgba(15,23,42,0.5)', backdropFilter: 'blur(8px)' }}>
      <motion.div
        initial={{ scale: 0.94, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.94, opacity: 0 }}
        transition={{ type: 'spring', duration: 0.3, bounce: 0.15 }}
        className="w-full max-w-md rounded-2xl p-6"
        style={{
          background: '#ffffff',
          border: '1px solid #e2e8f0',
          boxShadow: '0 24px 60px rgba(0,0,0,0.15)',
        }}
      >
        <h3 className="font-bold text-[15px] mb-1" style={{ color: '#0f172a' }}>Reject this tender?</h3>
        <p className="text-[12.5px] mb-4 line-clamp-2 capitalize" style={{ color: '#64748b' }}>
          {tender.title}
        </p>
        <textarea
          autoFocus rows={3} value={reason}
          onChange={e => setReason(e.target.value)}
          className="w-full rounded-xl p-3 text-[13px] resize-none focus:outline-none transition-all"
          placeholder="Why is this not relevant for GWS? (wrong sector, too small, geography…)"
          style={{
            background: '#f8fafc',
            border: '1px solid #e2e8f0',
            color: '#0f172a', caretColor: '#7c3aed',
          }}
          onFocus={e => {
            e.target.style.borderColor = 'rgba(124,58,237,0.4)';
            e.target.style.boxShadow = '0 0 0 3px rgba(124,58,237,0.06)';
          }}
          onBlur={e => {
            e.target.style.borderColor = '#e2e8f0';
            e.target.style.boxShadow = 'none';
          }}
        />
        <div className="flex gap-2.5 mt-4 justify-end">
          <button onClick={onCancel} className="btn-ghost px-4 py-2 text-[13px]">
            Cancel
          </button>
          <button
            disabled={!reason.trim()} onClick={() => onConfirm(reason)}
            className="px-4 py-2 rounded-xl text-[13px] font-bold text-white disabled:opacity-40 transition-opacity hover:opacity-90"
            style={{ background: '#ef4444' }}
          >
            Confirm Rejection
          </button>
        </div>
      </motion.div>
    </div>
  );
}

/* ── Fetch by T247 ID Panel ─────────────────────────────────── */
type FetchState = 'idle' | 'fetching' | 'done' | 'error' | 'exists';

function FetchByIdPanel({ onFetched }: { onFetched: () => void }) {
  const [open, setOpen]       = useState(false);
  const [t247Id, setT247Id]   = useState('');
  const [state, setState]     = useState<FetchState>('idle');
  const [message, setMessage] = useState('');

  async function handleFetch() {
    const id = t247Id.trim();
    if (!id || !/^\d+$/.test(id)) {
      setState('error');
      setMessage('Enter a valid numeric T247 ID, e.g. 98884609');
      return;
    }
    setState('fetching');
    setMessage('');
    try {
      const res = await fetch('/api/tenders/fetch-single', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ t247Id: id }),
      });
      const json = await res.json();
      if (!res.ok) { setState('error'); setMessage(json.error || 'Failed'); return; }
      setState(json.data.isNew ? 'done' : 'exists');
      setMessage(json.message || 'Done.');
      onFetched();
    } catch (err) {
      setState('error');
      setMessage((err as Error).message || 'Network error');
    }
  }

  return (
    <div className="mb-5">
      <button
        onClick={() => { setOpen(o => !o); setState('idle'); setMessage(''); }}
        className="flex items-center gap-2 px-3.5 py-2 rounded-[9px] text-[12.5px] font-semibold transition-all"
        style={{
          background: open ? 'rgba(245,158,11,0.08)' : 'rgba(245,158,11,0.05)',
          border: `1px solid ${open ? 'rgba(245,158,11,0.25)' : 'rgba(245,158,11,0.18)'}`,
          color: '#d97706',
        }}
        onMouseEnter={e => {
          (e.currentTarget as HTMLButtonElement).style.background = 'rgba(245,158,11,0.08)';
          (e.currentTarget as HTMLButtonElement).style.borderColor = 'rgba(245,158,11,0.25)';
        }}
        onMouseLeave={e => {
          if (!open) {
            (e.currentTarget as HTMLButtonElement).style.background = 'rgba(245,158,11,0.05)';
            (e.currentTarget as HTMLButtonElement).style.borderColor = 'rgba(245,158,11,0.18)';
          }
        }}
      >
        <Hash className="w-3.5 h-3.5" />
        Fetch by T247 ID
        {open ? <ChevronUp className="w-3.5 h-3.5 ml-0.5" /> : <ChevronDown className="w-3.5 h-3.5 ml-0.5" />}
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, height: 0, marginTop: 0 }}
            animate={{ opacity: 1, height: 'auto', marginTop: 10 }}
            exit={{ opacity: 0, height: 0, marginTop: 0 }}
            className="overflow-hidden"
          >
            <div
              className="rounded-2xl p-5"
              style={{ background: '#ffffff', border: '1px solid #e2e8f0', boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}
            >
              <p className="text-[12.5px] mb-3.5" style={{ color: '#64748b' }}>
                Enter a Tender247 numeric ID to fetch, screen and download documents. It appears below for your review.
              </p>
              <div className="flex gap-2.5 mb-3">
                <div className="relative flex-1">
                  <Hash className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5" style={{ color: 'rgba(245,158,11,0.5)' }} />
                  <input
                    type="text" value={t247Id}
                    onChange={e => { setT247Id(e.target.value); setState('idle'); setMessage(''); }}
                    onKeyDown={e => e.key === 'Enter' && state !== 'fetching' && handleFetch()}
                    placeholder="e.g. 98884609"
                    disabled={state === 'fetching'}
                    className="w-full pl-9 pr-4 py-2.5 rounded-xl text-[13px] disabled:opacity-50 transition-all"
                    style={{
                      background: '#f8fafc',
                      border: '1px solid rgba(245,158,11,0.2)',
                      color: '#0f172a',
                      outline: 'none',
                    }}
                    onFocus={e => {
                      e.target.style.borderColor = 'rgba(245,158,11,0.5)';
                      e.target.style.boxShadow = '0 0 0 3px rgba(245,158,11,0.06)';
                    }}
                    onBlur={e => {
                      e.target.style.borderColor = 'rgba(245,158,11,0.2)';
                      e.target.style.boxShadow = 'none';
                    }}
                  />
                </div>
                <button
                  onClick={handleFetch}
                  disabled={state === 'fetching' || !t247Id.trim()}
                  className="btn-amber flex-shrink-0"
                >
                  {state === 'fetching'
                    ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Fetching…</>
                    : <><Zap className="w-3.5 h-3.5" /> Fetch</>}
                </button>
              </div>

              {state === 'fetching' && (
                <div className="rounded-xl px-4 py-3 text-[12.5px]"
                  style={{ background: 'rgba(245,158,11,0.05)', border: '1px solid rgba(245,158,11,0.15)' }}>
                  <div className="flex items-center gap-2 mb-1" style={{ color: '#d97706' }}>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    Logging in, scraping tender, downloading documents…
                  </div>
                  <p style={{ color: 'rgba(217,119,6,0.6)' }}>Takes ~30–60 seconds. Please wait.</p>
                </div>
              )}

              {(state === 'done' || state === 'exists') && (
                <div className="rounded-xl px-4 py-2.5 flex items-center gap-2 text-[12.5px]"
                  style={{
                    background: state === 'exists' ? 'rgba(56,189,248,0.05)' : 'rgba(34,197,94,0.05)',
                    border: `1px solid ${state === 'exists' ? 'rgba(56,189,248,0.18)' : 'rgba(34,197,94,0.18)'}`,
                    color: state === 'exists' ? '#0284c7' : '#16a34a',
                  }}>
                  <CheckCircle2 className="w-3.5 h-3.5 flex-shrink-0" /> {message}
                  {state === 'done' && <span style={{ color: '#94a3b8' }}>· Scroll down to find it.</span>}
                </div>
              )}

              {state === 'error' && (
                <div className="rounded-xl px-4 py-2.5 flex items-center gap-2 text-[12.5px]"
                  style={{ background: 'rgba(239,68,68,0.05)', border: '1px solid rgba(239,68,68,0.18)', color: '#dc2626' }}>
                  <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" /> {message}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ── Filter select style ───────────────────────────────────── */
const selStyle: React.CSSProperties = {
  background: '#ffffff',
  border: '1px solid #e2e8f0',
  color: '#475569',
  borderRadius: '9px',
  fontSize: '12.5px',
  padding: '8px 12px',
  outline: 'none',
  cursor: 'pointer',
  transition: 'border-color 0.15s',
};

const SESSION_OPTIONS = ['all', 'morning', 'afternoon', 'live', 'manual'];
const L1_STATUS_OPTIONS = [
  { value: 'all',       label: 'All Status' },
  { value: 'qualified', label: 'Auto-Qualified' },
  { value: 'rejected',  label: 'Auto-Rejected' },
];
const DECISION_OPTIONS = [
  { value: 'all',      label: 'All Decisions' },
  { value: 'pending',  label: 'Pending Review' },
  { value: 'accepted', label: 'Accepted' },
  { value: 'rejected', label: 'Rejected' },
];

/* ── Main Content ──────────────────────────────────────────── */
function TendersContent() {
  const searchParams = useSearchParams();
  const [data, setData]             = useState<PaginatedResponse<Tender> | null>(null);
  const [loading, setLoading]       = useState(true);
  const [search, setSearch]         = useState('');
  const [l1Status, setL1Status]     = useState(searchParams.get('l1Status') || 'qualified');
  const [l1Decision, setL1Decision] = useState(searchParams.get('l1Decision') || 'all');
  const [session, setSession]       = useState('all');
  const [page, setPage]             = useState(1);
  const [updatingId, setUpdatingId] = useState<number | null>(null);
  const [previewTender, setPreviewTender] = useState<Tender | null>(null);
  const [rejectTender, setRejectTender]   = useState<Tender | null>(null);

  const fetchTenders = useCallback(async () => {
    setLoading(true);
    try {
      const p = new URLSearchParams({ page: String(page), pageSize: '25' });
      if (l1Status !== 'all')   p.set('l1Status', l1Status);
      if (l1Decision !== 'all') p.set('l1Decision', l1Decision);
      if (session !== 'all')    p.set('session', session);
      if (search)               p.set('search', search);
      const res = await fetch(`/api/tenders?${p}`);
      const json = await res.json();
      setData(json.data);
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }, [page, l1Status, l1Decision, session, search]);

  useEffect(() => { fetchTenders(); }, [fetchTenders]);

  async function updateDecision(id: number, decision: 'accepted' | 'rejected' | 'pending', reason?: string) {
    setUpdatingId(id);
    try {
      await fetch(`/api/tenders/${id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ l1Decision: decision, l1DecisionReason: reason }),
      });
      await fetchTenders();
      if (previewTender?.id === id)
        setPreviewTender(prev => prev ? { ...prev, l1Decision: decision, l1DecisionReason: reason || null } : null);
    } finally { setUpdatingId(null); setRejectTender(null); }
  }

  const pendingCount = data?.data.filter(t => t.l1Decision === 'pending' && t.l1Status === 'qualified').length ?? 0;

  return (
    <div className="p-8 max-w-full">

      {/* ── Header ─────────────────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.38, ease: [0.22, 1, 0.36, 1] }}
        className="mb-6"
      >
        <div className="flex items-start justify-between mb-4">
          <div>
            <h1 className="text-[26px] font-bold tracking-tight" style={{ color: '#0f172a' }}>
              Tender Screening
            </h1>
            <p className="text-[13.5px] mt-1" style={{ color: '#64748b' }}>
              Level 1 · Click a row to preview and make your Accept / Reject decision
            </p>
          </div>
          {pendingCount > 0 && (
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}
              className="flex items-center gap-2 px-3.5 py-2 rounded-xl text-[12.5px] font-bold"
              style={{ background: 'rgba(245,158,11,0.07)', border: '1px solid rgba(245,158,11,0.2)', color: '#d97706' }}
            >
              <span className="w-1.5 h-1.5 rounded-full pulse-dot" style={{ background: '#f59e0b' }} />
              {pendingCount} pending review
            </motion.div>
          )}
        </div>

        {/* Workflow strip */}
        <div
          className="rounded-xl px-4 py-3 flex items-center gap-2 flex-wrap"
          style={{ background: '#ffffff', border: '1px solid #e2e8f0' }}
        >
          {[
            { icon: Filter,       label: 'BRD Auto-Screen',  color: '#7c3aed' },
            { icon: CheckCircle2, label: 'Accept / Reject',   color: '#f59e0b' },
            { icon: Microscope,   label: 'L2 AI Analysis',    color: '#7c3aed' },
            { icon: FileText,     label: 'BID / NO-BID',      color: '#22c55e' },
          ].map(({ icon: Icon, label, color }, i, arr) => (
            <div key={label} className="flex items-center gap-2">
              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold"
                style={{ background: `${color}0e`, color, border: `1px solid ${color}25` }}>
                <Icon className="w-3 h-3" /> {label}
              </div>
              {i < arr.length - 1 && <ArrowRight className="w-3 h-3 flex-shrink-0" style={{ color: '#cbd5e1' }} />}
            </div>
          ))}
        </div>
      </motion.div>

      {/* ── Fetch by ID ─────────────────────────────────────── */}
      <FetchByIdPanel onFetched={fetchTenders} />

      {/* ── Filters ─────────────────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.1 }}
        className="rounded-xl p-3.5 mb-4 flex flex-wrap gap-2.5 items-center"
        style={{ background: '#ffffff', border: '1px solid #e2e8f0' }}
      >
        <SlidersHorizontal className="w-4 h-4 flex-shrink-0" style={{ color: '#94a3b8' }} />

        {/* Search */}
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: '#94a3b8' }} />
          <input
            className="w-full pl-9 pr-4 py-2 rounded-lg text-[13px] transition-all"
            style={{
              background: '#f8fafc',
              border: '1px solid #e2e8f0',
              color: '#0f172a',
              outline: 'none',
            }}
            placeholder="Search tenders, issuers, IDs…"
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(1); }}
            onFocus={e => { e.target.style.borderColor = 'rgba(124,58,237,0.35)'; e.target.style.boxShadow = '0 0 0 3px rgba(124,58,237,0.05)'; }}
            onBlur={e => { e.target.style.borderColor = '#e2e8f0'; e.target.style.boxShadow = 'none'; }}
          />
        </div>

        {[
          { val: l1Status,   fn: (v: string) => { setL1Status(v); setPage(1); },   opts: L1_STATUS_OPTIONS },
          { val: l1Decision, fn: (v: string) => { setL1Decision(v); setPage(1); }, opts: DECISION_OPTIONS },
          {
            val: session, fn: (v: string) => { setSession(v); setPage(1); },
            opts: SESSION_OPTIONS.map(s => ({ value: s, label: s === 'all' ? 'All Sessions' : s.charAt(0).toUpperCase() + s.slice(1) })),
          },
        ].map((sel, i) => (
          <select key={i} value={sel.val} onChange={e => sel.fn(e.target.value)} style={selStyle}
            onFocus={e => (e.target.style.borderColor = 'rgba(124,58,237,0.35)')}
            onBlur={e => (e.target.style.borderColor = '#e2e8f0')}>
            {sel.opts.map(o => <option key={o.value} value={o.value} style={{ background: '#ffffff' }}>{o.label}</option>)}
          </select>
        ))}

        {data && (
          <span className="ml-auto text-[12px] font-medium" style={{ color: '#94a3b8' }}>
            {data.total.toLocaleString()} tenders
          </span>
        )}
      </motion.div>

      {/* ── Table ───────────────────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}
        className="rounded-2xl overflow-hidden"
        style={{ background: '#ffffff', border: '1px solid #e2e8f0', boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}
      >
        {loading ? (
          <div className="p-8">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex gap-4 mb-4 items-center">
                <div className="skeleton h-4 flex-1 max-w-[360px]" />
                <div className="skeleton h-4 w-36" />
                <div className="skeleton h-4 w-24" />
                <div className="skeleton h-4 w-20" />
                <div className="skeleton h-5 w-20 rounded-full" />
                <div className="skeleton h-5 w-20 rounded-full" />
              </div>
            ))}
          </div>
        ) : data?.data.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <div className="w-12 h-12 rounded-2xl flex items-center justify-center"
              style={{ background: 'rgba(124,58,237,0.05)', border: '1px solid rgba(124,58,237,0.12)' }}>
              <Filter className="w-5 h-5" style={{ color: 'rgba(124,58,237,0.4)' }} />
            </div>
            <p className="text-[14px] font-medium" style={{ color: '#64748b' }}>No tenders match your filters</p>
            <p className="text-[12.5px]" style={{ color: '#94a3b8' }}>Try adjusting the filters above</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  {['Tender', 'Issuing Authority', 'Value', 'Due Date', 'Status', 'Decision'].map(h => (
                    <th key={h}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data?.data.map((tender, rowIdx) => {
                  const { color: dateColor } = dueDateStyle(tender.dueDate);
                  const days = getDaysUntilDue(tender.dueDate);
                  const isSelected = previewTender?.id === tender.id;
                  return (
                    <motion.tr
                      key={tender.id}
                      initial={{ opacity: 0, y: 4 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: rowIdx * 0.018, duration: 0.25 }}
                      onClick={() => setPreviewTender(isSelected ? null : tender)}
                      className={isSelected ? 'row-selected' : ''}
                      style={{ opacity: tender.l1Decision === 'rejected' ? 0.55 : 1 }}
                    >
                      <td className="max-w-[360px]">
                        <p className="font-semibold leading-snug line-clamp-2 capitalize mb-1.5 text-[13.5px]"
                          style={{ color: '#0f172a' }}>
                          {tender.title}
                        </p>
                        <div className="flex flex-wrap gap-1">
                          {tender.l1QualificationReasons?.slice(0, 2).map((r, i) => (
                            <span key={i} className="text-[10.5px] px-1.5 py-0.5 rounded-md"
                              style={{ background: 'rgba(124,58,237,0.07)', color: '#7c3aed', border: '1px solid rgba(124,58,237,0.15)' }}>
                              {r.length > 30 ? r.slice(0, 30) + '…' : r}
                            </span>
                          ))}
                          {tender.l1Status === 'rejected' && tender.l1ExclusionReason && (
                            <span className="text-[10.5px] px-1.5 py-0.5 rounded-md"
                              style={{ background: 'rgba(239,68,68,0.06)', color: '#dc2626', border: '1px solid rgba(239,68,68,0.14)' }}>
                              {tender.l1ExclusionReason.slice(0, 40)}…
                            </span>
                          )}
                          {tender.l1Decision === 'accepted' && (
                            <span className="text-[10.5px] px-1.5 py-0.5 rounded-md flex items-center gap-1"
                              style={{ background: 'rgba(124,58,237,0.07)', color: '#7c3aed', border: '1px solid rgba(124,58,237,0.15)' }}>
                              <Microscope className="w-2.5 h-2.5" />
                              {tender.l2Analyzed ? 'L2 done' : 'L2 pending'}
                            </span>
                          )}
                        </div>
                      </td>

                      <td>
                        <p className="font-medium text-[13px]" style={{ color: '#334155' }}>
                          {tender.issuedBy}
                        </p>
                        {tender.location && (
                          <p className="text-[11.5px] mt-0.5 flex items-center gap-1" style={{ color: '#94a3b8' }}>
                            <MapPin className="w-3 h-3" /> {tender.location}
                          </p>
                        )}
                      </td>

                      <td className="whitespace-nowrap font-semibold text-[13px]" style={{ color: '#0f172a' }}>
                        {tender.estimatedValue
                          ? formatCurrency(tender.estimatedValue)
                          : <span style={{ color: '#94a3b8', fontSize: 12 }}>{tender.estimatedValueRaw || '—'}</span>}
                      </td>

                      <td>
                        <span className="font-semibold whitespace-nowrap text-[13px]" style={{ color: dateColor }}>
                          {formatDate(tender.dueDate)}
                        </span>
                        {days !== null && days >= 0 && (
                          <p className="text-[11px] mt-0.5" style={{ color: '#94a3b8' }}>{days}d left</p>
                        )}
                      </td>

                      <td><L1Badge status={tender.l1Status} /></td>

                      <td>
                        <div className="flex items-center gap-2">
                          <DecisionBadge d={tender.l1Decision} />
                          {isSelected
                            ? <ChevronUp className="w-3.5 h-3.5" style={{ color: '#7c3aed' }} />
                            : <ChevronDown className="w-3.5 h-3.5" style={{ color: '#cbd5e1' }} />}
                        </div>
                      </td>
                    </motion.tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {data && data.totalPages > 1 && (
          <div
            className="flex items-center justify-between px-6 py-3.5"
            style={{ borderTop: '1px solid #e2e8f0' }}
          >
            <p className="text-[12.5px]" style={{ color: '#94a3b8' }}>
              Page {data.page} of {data.totalPages} · {data.total.toLocaleString()} total
            </p>
            <div className="flex gap-2">
              {[
                { disabled: page === 1,               action: () => setPage(p => p - 1), icon: ChevronLeft },
                { disabled: page === data.totalPages,  action: () => setPage(p => p + 1), icon: ChevronRight },
              ].map(({ disabled, action, icon: Icon }, i) => (
                <button key={i} disabled={disabled}
                  onClick={e => { e.stopPropagation(); action(); }}
                  className="w-8 h-8 rounded-lg flex items-center justify-center disabled:opacity-30 transition-colors"
                  style={{ background: '#f8fafc', border: '1px solid #e2e8f0' }}
                  onMouseEnter={e => { if (!disabled) (e.currentTarget as HTMLElement).style.background = '#f1f5f9'; }}
                  onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = '#f8fafc'}
                >
                  <Icon className="w-4 h-4" style={{ color: '#7c3aed' }} />
                </button>
              ))}
            </div>
          </div>
        )}
      </motion.div>

      {/* Side panel + modals */}
      <AnimatePresence>
        {previewTender && (
          <PreviewPanel
            tender={previewTender}
            onClose={() => setPreviewTender(null)}
            onAccept={() => updateDecision(previewTender.id, 'accepted')}
            onReject={() => setRejectTender(previewTender)}
            updating={updatingId === previewTender.id}
          />
        )}
      </AnimatePresence>
      <AnimatePresence>
        {rejectTender && (
          <RejectModal
            tender={rejectTender}
            onConfirm={reason => updateDecision(rejectTender.id, 'rejected', reason)}
            onCancel={() => setRejectTender(null)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

export default function TendersPage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center h-full">
        <p className="text-[13px]" style={{ color: '#94a3b8' }}>Loading…</p>
      </div>
    }>
      <TendersContent />
    </Suspense>
  );
}
