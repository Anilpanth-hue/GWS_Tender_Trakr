'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Link from 'next/link';
import { useSession } from 'next-auth/react';
import {
  Bookmark, CheckCircle2, Clock, Building2, Calendar,
  IndianRupee, ArrowUpRight, UserCircle, AlertCircle,
  TrendingUp, ShieldCheck, ChevronRight, X, Trophy,
  XCircle, MinusCircle, Loader2, ClipboardEdit, Search,
} from 'lucide-react';
import { formatCurrency, formatDate } from '@/lib/utils';
import type { Tender, BidStatus } from '@/types';

// ── Bid Status Config ──────────────────────────────────────────────────────────

const PIPELINE_STAGES = [
  { key: 'bid_evaluated',    label: 'Bid Evaluated'   },
  { key: 'bid_participated', label: 'Bid Participated' },
  { key: 'tender_awarded',   label: 'Tender Awarded'  },
] as const;

const TERMINAL: BidStatus[] = ['rejected', 'bid_dropped', 'not_awarded', 'tender_awarded'];

type NextAction = { status: BidStatus; label: string; color: string; icon: React.ReactNode; isTerminal?: boolean };

function getNextActions(current: BidStatus | null): NextAction[] {
  switch (current) {
    case null:
    case 'assigned':
      return [
        { status: 'bid_evaluated', label: 'Mark Bid Evaluated', color: '#7c3aed', icon: <CheckCircle2 className="w-4 h-4" /> },
        { status: 'rejected',      label: 'Reject Tender',      color: '#dc2626', icon: <XCircle className="w-4 h-4" />, isTerminal: true },
      ];
    case 'bid_evaluated':
      return [
        { status: 'bid_participated', label: 'Bid Participated', color: '#0284c7', icon: <CheckCircle2 className="w-4 h-4" /> },
        { status: 'bid_dropped',      label: 'Bid Dropped',      color: '#dc2626', icon: <MinusCircle className="w-4 h-4" />, isTerminal: true },
      ];
    case 'bid_participated':
      return [
        { status: 'tender_awarded', label: 'Tender Awarded',  color: '#16a34a', icon: <Trophy className="w-4 h-4" /> },
        { status: 'not_awarded',    label: 'Not Awarded',     color: '#94a3b8', icon: <XCircle className="w-4 h-4" />, isTerminal: true },
      ];
    default:
      return [];
  }
}

function stageIndex(status: BidStatus | null): number {
  if (!status || status === 'assigned') return -1;
  if (status === 'rejected') return -2;
  if (status === 'bid_evaluated') return 0;
  if (status === 'bid_dropped') return 0.5; // between 0 and 1, shown as dropped
  if (status === 'bid_participated') return 1;
  if (status === 'not_awarded') return 1.5;
  if (status === 'tender_awarded') return 2;
  return -1;
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function BidStatusBadge({ status }: { status: BidStatus | null }) {
  if (!status || status === 'assigned') return (
    <span className="text-[10.5px] font-bold px-2.5 py-0.5 rounded-full"
      style={{ background: 'rgba(100,116,139,0.08)', color: '#64748b', border: '1px solid rgba(100,116,139,0.2)' }}>
      Awaiting Action
    </span>
  );
  const map: Record<BidStatus, { label: string; color: string; bg: string }> = {
    assigned:         { label: 'Awaiting Action',  color: '#64748b', bg: 'rgba(100,116,139,0.08)' },
    rejected:         { label: 'Rejected',          color: '#dc2626', bg: 'rgba(220,38,38,0.08)'   },
    bid_evaluated:    { label: 'Bid Evaluated',     color: '#7c3aed', bg: 'rgba(124,58,237,0.08)'  },
    bid_dropped:      { label: 'Bid Dropped',       color: '#dc2626', bg: 'rgba(220,38,38,0.08)'   },
    bid_participated: { label: 'Bid Participated',  color: '#0284c7', bg: 'rgba(2,132,199,0.08)'   },
    tender_awarded:   { label: 'Tender Awarded',    color: '#16a34a', bg: 'rgba(22,163,74,0.08)'   },
    not_awarded:      { label: 'Not Awarded',       color: '#94a3b8', bg: 'rgba(100,116,139,0.08)' },
  };
  const m = map[status];
  return (
    <span className="text-[10.5px] font-bold px-2.5 py-0.5 rounded-full"
      style={{ background: m.bg, color: m.color, border: `1px solid ${m.color}30` }}>
      {m.label}
    </span>
  );
}

function PipelineBar({ status }: { status: BidStatus | null }) {
  const idx = stageIndex(status);
  const isDropped = status === 'bid_dropped';
  const isRejected = status === 'rejected';
  const isNotAwarded = status === 'not_awarded';

  if (isRejected) return (
    <div className="flex items-center gap-2 py-2">
      <XCircle className="w-4 h-4 flex-shrink-0" style={{ color: '#dc2626' }} />
      <span className="text-[12px] font-semibold" style={{ color: '#dc2626' }}>Tender Rejected</span>
    </div>
  );

  return (
    <div className="flex items-center gap-0 py-2">
      {PIPELINE_STAGES.map((stage, i) => {
        const done = idx >= i;
        const current = Math.floor(idx) === i && !TERMINAL.includes(status!);
        const dropped = isDropped && i === 1;
        const notAwarded = isNotAwarded && i === 2;

        return (
          <div key={stage.key} className="flex items-center gap-0 flex-1">
            {/* Node */}
            <div className="flex flex-col items-center gap-1">
              <div className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 transition-all"
                style={{
                  background: dropped || notAwarded ? 'rgba(220,38,38,0.1)'
                    : done ? (current ? 'rgba(124,58,237,0.12)' : 'rgba(22,163,74,0.1)')
                    : '#f1f5f9',
                  border: `2px solid ${dropped || notAwarded ? '#dc2626'
                    : done ? (current ? '#7c3aed' : '#16a34a')
                    : '#e2e8f0'}`,
                }}>
                {(dropped || notAwarded) ? (
                  <X className="w-3 h-3" style={{ color: '#dc2626' }} />
                ) : done ? (
                  current
                    ? <div className="w-2 h-2 rounded-full" style={{ background: '#7c3aed' }} />
                    : <CheckCircle2 className="w-3.5 h-3.5" style={{ color: '#16a34a' }} />
                ) : (
                  <div className="w-2 h-2 rounded-full" style={{ background: '#cbd5e1' }} />
                )}
              </div>
              <span className="text-[9.5px] font-semibold whitespace-nowrap"
                style={{ color: dropped || notAwarded ? '#dc2626' : done ? (current ? '#7c3aed' : '#16a34a') : '#94a3b8' }}>
                {dropped && i === 1 ? 'Bid Dropped' : notAwarded && i === 2 ? 'Not Awarded' : stage.label}
              </span>
            </div>
            {/* Connector */}
            {i < PIPELINE_STAGES.length - 1 && (
              <div className="flex-1 h-0.5 mx-1 mb-4 transition-all"
                style={{ background: idx > i ? '#16a34a' : '#e2e8f0' }} />
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── Update Status Modal ────────────────────────────────────────────────────────

const REMARK_LABEL: Record<string, { label: string; required: boolean; placeholder: string }> = {
  rejected:         { label: 'Rejection Reason',  required: true,  placeholder: 'Why is this tender being rejected?' },
  bid_dropped:      { label: 'Drop Reason',        required: true,  placeholder: 'Why was the bid dropped?' },
  not_awarded:      { label: 'Remark',             required: true,  placeholder: 'e.g. Lost to L1 bidder at lower price' },
  bid_evaluated:    { label: 'Evaluation Remark',  required: false, placeholder: 'Any notes on the bid evaluation… (optional)' },
  bid_participated: { label: 'Bid Remark',         required: false, placeholder: 'e.g. Submitted bid at ₹4.2 Cr… (optional)' },
  tender_awarded:   { label: 'Award Remark',       required: false, placeholder: 'Notes on the award… (optional)' },
};

function UpdateModal({ tender, onClose, onUpdated }: {
  tender: Tender;
  onClose: () => void;
  onUpdated: () => void;
}) {
  const actions = getNextActions(tender.bidStatus);
  const [selected, setSelected] = useState<NextAction | null>(actions[0] ?? null);
  const [remark, setRemark]     = useState('');
  const [bidAmount, setBidAmount] = useState('');
  const [saving, setSaving]     = useState(false);
  const [error, setError]       = useState('');

  const remarkCfg = selected ? REMARK_LABEL[selected.status] : null;

  async function submit() {
    if (!selected) return;
    if (remarkCfg?.required && !remark.trim()) { setError(`${remarkCfg.label} is required.`); return; }
    setSaving(true); setError('');
    try {
      const res = await fetch(`/api/tenders/${tender.id}/bid-status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: selected.status,
          remark: remark.trim() || undefined,
          bidAmount: bidAmount.trim() || undefined,
        }),
      });
      const json = await res.json();
      if (json.error) { setError(json.error); setSaving(false); return; }
      onUpdated();
      onClose();
    } catch { setError('Network error.'); setSaving(false); }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.4)' }}>
      <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
        className="w-full max-w-md rounded-2xl overflow-hidden"
        style={{ background: '#fff', boxShadow: '0 24px 64px rgba(0,0,0,0.15)' }}>

        {/* Header */}
        <div className="px-5 py-4 flex items-center justify-between"
          style={{ borderBottom: '1px solid #f1f5f9' }}>
          <div>
            <h3 className="text-[14px] font-bold" style={{ color: '#0f172a' }}>Update Bid Status</h3>
            <p className="text-[11.5px] mt-0.5 line-clamp-1" style={{ color: '#94a3b8' }}>{tender.title}</p>
          </div>
          <button onClick={onClose} className="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-slate-100">
            <X className="w-4 h-4" style={{ color: '#64748b' }} />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {/* Current status */}
          <div className="flex items-center gap-2">
            <span className="text-[12px]" style={{ color: '#64748b' }}>Current:</span>
            <BidStatusBadge status={tender.bidStatus} />
          </div>

          {/* Action selection */}
          <div>
            <p className="text-[11.5px] font-semibold mb-2" style={{ color: '#334155' }}>Next Action</p>
            <div className="space-y-2">
              {actions.map(action => (
                <button key={action.status} onClick={() => { setSelected(action); setRemark(''); setBidAmount(''); setError(''); }}
                  className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-left transition-all"
                  style={{
                    border: `2px solid ${selected?.status === action.status ? action.color : '#e2e8f0'}`,
                    background: selected?.status === action.status ? `${action.color}08` : '#fff',
                  }}>
                  <span style={{ color: action.color }}>{action.icon}</span>
                  <span className="text-[13px] font-semibold flex-1" style={{ color: action.isTerminal ? '#dc2626' : '#0f172a' }}>
                    {action.label}
                  </span>
                  {selected?.status === action.status && (
                    <div className="w-4 h-4 rounded-full flex items-center justify-center" style={{ background: action.color }}>
                      <CheckCircle2 className="w-3 h-3 text-white" />
                    </div>
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* Bid amount — shown when marking bid participated */}
          {selected?.status === 'bid_participated' && (
            <div>
              <label className="text-[11.5px] font-semibold mb-1.5 block" style={{ color: '#334155' }}>
                Our Bid Amount <span style={{ color: '#94a3b8' }}>(optional)</span>
              </label>
              <input
                value={bidAmount}
                onChange={e => setBidAmount(e.target.value)}
                placeholder="e.g. ₹4.2 Cr or 4,20,00,000"
                className="w-full rounded-xl px-3.5 py-2.5 text-[13px] outline-none"
                style={{ border: '1.5px solid #e2e8f0', background: '#f8fafc', color: '#0f172a' }}
              />
            </div>
          )}

          {/* Remark — shown for all transitions */}
          {remarkCfg && (
            <div>
              <label className="text-[11.5px] font-semibold mb-1.5 block" style={{ color: '#334155' }}>
                {remarkCfg.label}
                {remarkCfg.required
                  ? <span style={{ color: '#dc2626' }}> *</span>
                  : <span style={{ color: '#94a3b8' }}> (optional)</span>}
              </label>
              <textarea
                value={remark}
                onChange={e => { setRemark(e.target.value); setError(''); }}
                rows={3}
                placeholder={remarkCfg.placeholder}
                className="w-full rounded-xl px-3.5 py-2.5 text-[13px] resize-none outline-none transition-all"
                style={{ border: `1.5px solid ${error ? '#dc2626' : '#e2e8f0'}`, background: '#f8fafc', color: '#0f172a' }}
              />
              {error && <p className="text-[11.5px] mt-1" style={{ color: '#dc2626' }}>{error}</p>}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 pb-5 flex gap-3">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-xl text-[13px] font-semibold"
            style={{ background: '#f1f5f9', color: '#64748b' }}>Cancel</button>
          <button onClick={submit} disabled={saving || !selected}
            className="flex-1 py-2.5 rounded-xl text-[13px] font-semibold flex items-center justify-center gap-2"
            style={{ background: selected?.color || '#7c3aed', color: '#fff', opacity: saving ? 0.7 : 1 }}>
            {saving && <Loader2 className="w-4 h-4 animate-spin" />}
            {saving ? 'Saving…' : 'Confirm'}
          </button>
        </div>
      </motion.div>
    </div>
  );
}

// ── Bidder Fill Modal ──────────────────────────────────────────────────────────

function BidderFillModal({ tender, onClose, onSaved }: {
  tender: Tender; onClose: () => void; onSaved: () => void;
}) {
  const [l1Name, setL1Name] = useState(tender.l1Bidder || '');
  const [l1Price, setL1Price] = useState(tender.l1Price || '');
  const [l2Name, setL2Name] = useState(tender.l2Bidder || '');
  const [l2Price, setL2Price] = useState(tender.l2Price || '');
  const [l3Name, setL3Name] = useState(tender.l3Bidder || '');
  const [l3Price, setL3Price] = useState(tender.l3Price || '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function save() {
    if (!l1Name.trim()) { setError('L1 Bidder name is required.'); return; }
    setSaving(true); setError('');
    const res = await fetch(`/api/tenders/${tender.id}/bid-status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        status: 'fill_bidders',
        l1Bidder: l1Name, l1Price,
        l2Bidder: l2Name, l2Price,
        l3Bidder: l3Name, l3Price,
      }),
    });
    const json = await res.json();
    if (json.error) { setError(json.error); setSaving(false); return; }
    onSaved(); onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.45)' }}>
      <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
        className="w-full max-w-lg rounded-2xl overflow-hidden"
        style={{ background: '#fff', boxShadow: '0 24px 64px rgba(0,0,0,0.18)' }}>

        <div className="px-5 py-4 flex items-center justify-between"
          style={{ borderBottom: '1px solid #f1f5f9' }}>
          <div>
            <h3 className="text-[14px] font-bold" style={{ color: '#0f172a' }}>Fill Bidder Details</h3>
            <p className="text-[11.5px] mt-0.5 line-clamp-1" style={{ color: '#94a3b8' }}>{tender.title}</p>
          </div>
          <button onClick={onClose} className="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-slate-100">
            <X className="w-4 h-4" style={{ color: '#64748b' }} />
          </button>
        </div>

        <div className="p-5 space-y-3">
          {[
            { rank: 'L1', name: l1Name, setName: setL1Name, price: l1Price, setPrice: setL1Price },
            { rank: 'L2', name: l2Name, setName: setL2Name, price: l2Price, setPrice: setL2Price },
            { rank: 'L3', name: l3Name, setName: setL3Name, price: l3Price, setPrice: setL3Price },
          ].map(({ rank, name, setName, price, setPrice }) => (
            <div key={rank} className="rounded-xl p-3.5" style={{ background: '#f8fafc', border: '1px solid #e2e8f0' }}>
              <p className="text-[10.5px] font-bold uppercase tracking-wide mb-2.5"
                style={{ color: rank === 'L1' ? '#16a34a' : '#94a3b8' }}>{rank} Bidder</p>
              <div className="space-y-2">
                <input value={name} onChange={e => setName(e.target.value)}
                  placeholder="Bidder name / company"
                  className="w-full rounded-lg px-3 py-2 text-[12.5px] outline-none"
                  style={{ border: '1.5px solid #e2e8f0', background: '#fff', color: '#0f172a' }} />
                <input value={price} onChange={e => setPrice(e.target.value)}
                  placeholder="Price / quote (e.g. ₹4.2 Cr)"
                  className="w-full rounded-lg px-3 py-2 text-[12.5px] outline-none"
                  style={{ border: '1.5px solid #e2e8f0', background: '#fff', color: '#0f172a' }} />
              </div>
            </div>
          ))}
          {error && <p className="text-[12px]" style={{ color: '#dc2626' }}>{error}</p>}
        </div>

        <div className="px-5 pb-5 flex gap-3">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-xl text-[13px] font-semibold"
            style={{ background: '#f1f5f9', color: '#64748b' }}>Cancel</button>
          <button onClick={save} disabled={saving}
            className="flex-1 py-2.5 rounded-xl text-[13px] font-semibold flex items-center justify-center gap-2"
            style={{ background: '#16a34a', color: '#fff', opacity: saving ? 0.7 : 1 }}>
            {saving && <Loader2 className="w-4 h-4 animate-spin" />}
            {saving ? 'Saving…' : 'Save Bidder Details'}
          </button>
        </div>
      </motion.div>
    </div>
  );
}

// ── Bidder Details Section (shown when tender_awarded) ─────────────────────────

function BidderDetails({ tender, isAdmin, onFilled }: {
  tender: Tender; isAdmin: boolean; onFilled: () => void;
}) {
  const [showFill, setShowFill] = useState(false);
  if (tender.bidStatus !== 'tender_awarded') return null;
  const hasBidders = tender.l1Bidder || tender.l2Bidder || tender.l3Bidder;

  return (
    <>
      <div className="mt-4 pt-4" style={{ borderTop: '1px solid #f1f5f9' }}>
        <div className="flex items-center gap-2 mb-3">
          <Trophy className="w-3.5 h-3.5" style={{ color: '#16a34a' }} />
          <p className="text-[11px] font-bold uppercase tracking-wide flex-1" style={{ color: '#16a34a' }}>
            Bidder Rankings
          </p>
          {isAdmin && (
            <motion.button whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.97 }}
              onClick={() => setShowFill(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11.5px] font-semibold"
              style={{ background: 'rgba(234,88,12,0.1)', color: '#ea580c', border: '1px solid rgba(234,88,12,0.3)' }}>
              <ClipboardEdit className="w-3 h-3" />
              {hasBidders ? 'Edit Bidders' : '⚠ Fill Details'}
            </motion.button>
          )}
        </div>

        {hasBidders ? (
          <div className="grid grid-cols-3 gap-2">
            {[
              { rank: 'L1', name: tender.l1Bidder, price: tender.l1Price },
              { rank: 'L2', name: tender.l2Bidder, price: tender.l2Price },
              { rank: 'L3', name: tender.l3Bidder, price: tender.l3Price },
            ].map(({ rank, name, price }) => (
              <div key={rank} className="rounded-xl p-3" style={{ background: '#f8fafc', border: '1px solid #e2e8f0' }}>
                <p className="text-[9.5px] font-bold uppercase tracking-wide mb-1.5"
                  style={{ color: rank === 'L1' ? '#16a34a' : '#94a3b8' }}>{rank} Bidder</p>
                <p className="text-[11.5px] font-semibold leading-snug" style={{ color: '#334155' }}>
                  {name || <span className="italic" style={{ color: '#94a3b8' }}>Not filled</span>}
                </p>
                {price && <p className="text-[11px] mt-0.5 font-medium" style={{ color: '#64748b' }}>{price}</p>}
              </div>
            ))}
          </div>
        ) : (
          <div className="flex items-center gap-3 py-3 px-4 rounded-xl"
            style={{ background: 'rgba(22,163,74,0.04)', border: '1px dashed rgba(22,163,74,0.25)' }}>
            <Trophy className="w-4 h-4 flex-shrink-0" style={{ color: 'rgba(22,163,74,0.4)' }} />
            <p className="text-[12px]" style={{ color: '#64748b' }}>
              {isAdmin
                ? 'Click "Fill Details" to record L1, L2, L3 bidder names and pricing.'
                : 'Bidder details not yet filled. Admin will update this soon.'}
            </p>
          </div>
        )}

        {tender.awardRemark && (
          <p className="text-[11.5px] mt-2 leading-relaxed" style={{ color: '#64748b' }}>
            <span className="font-semibold">Remark:</span> {tender.awardRemark}
          </p>
        )}
      </div>

      <AnimatePresence>
        {showFill && (
          <BidderFillModal
            tender={tender}
            onClose={() => setShowFill(false)}
            onSaved={() => { setShowFill(false); onFilled(); }}
          />
        )}
      </AnimatePresence>
    </>
  );
}

// ── Tender Card ────────────────────────────────────────────────────────────────

function TenderCard({ tender, index, onStatusUpdated, isAdmin }: {
  tender: Tender; index: number; onStatusUpdated: () => void; isAdmin: boolean;
}) {
  const [showModal, setShowModal] = useState(false);
  const analysis = tender.l2Analysis;
  const canUpdate = !TERMINAL.includes(tender.bidStatus as BidStatus);
  const nextActions = getNextActions(tender.bidStatus);

  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: index * 0.06, duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
        className="rounded-2xl overflow-hidden"
        style={{ background: '#ffffff', border: '1px solid #e2e8f0', boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}
      >
        {/* Assigned-by banner */}
        <div className="px-5 py-2.5 flex items-center gap-2 text-[11.5px]"
          style={{ background: 'rgba(124,58,237,0.04)', borderBottom: '1px solid rgba(124,58,237,0.08)' }}>
          <UserCircle className="w-3.5 h-3.5 flex-shrink-0" style={{ color: '#7c3aed' }} />
          <span style={{ color: '#64748b' }}>
            Assigned by <span className="font-semibold" style={{ color: '#7c3aed' }}>
              {tender.assignedByName || tender.assignedByEmail || 'Unknown'}
            </span>
          </span>
          <span className="ml-auto flex items-center gap-2">
            <BidStatusBadge status={tender.bidStatus} />
          </span>
        </div>

        <div className="p-5">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 min-w-0">
              {/* Title row */}
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

              {/* Meta */}
              <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11.5px] mb-3" style={{ color: '#94a3b8' }}>
                <span className="flex items-center gap-1.5"><Building2 className="w-3 h-3" /> {tender.issuedBy || '—'}</span>
                {tender.estimatedValue && (
                  <span className="flex items-center gap-1"><IndianRupee className="w-3 h-3" /> {formatCurrency(tender.estimatedValue)}</span>
                )}
                {tender.dueDate && (
                  <span className="flex items-center gap-1"><Calendar className="w-3 h-3" /> Due {formatDate(tender.dueDate)}</span>
                )}
              </div>

              {/* L2 badges */}
              {analysis && (
                <div className="flex flex-wrap gap-2 mb-3">
                  {analysis.recommendedAction && (
                    <span className="text-[10.5px] font-bold px-2 py-0.5 rounded-full"
                      style={{ background: 'rgba(22,163,74,0.08)', color: '#16a34a', border: '1px solid rgba(22,163,74,0.2)' }}>
                      {analysis.recommendedAction.split(/[\s—–]/)[0].toUpperCase()}
                    </span>
                  )}
                  {analysis.gwsRelevanceScore && (
                    <span className="flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full"
                      style={{ background: 'rgba(124,58,237,0.08)', color: '#7c3aed' }}>
                      <TrendingUp className="w-3 h-3" /> {analysis.gwsRelevanceScore}/10
                    </span>
                  )}
                  {analysis.winProbabilityAssessment && (
                    <span className="flex items-center gap-1 text-[10.5px] px-2 py-0.5 rounded-full font-medium"
                      style={{ background: 'rgba(15,23,42,0.04)', color: '#64748b', border: '1px solid #e2e8f0' }}>
                      <ShieldCheck className="w-3 h-3" />
                      {analysis.winProbabilityAssessment.split(/[—–]/)[0].trim()}
                    </span>
                  )}
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="flex flex-col gap-2 flex-shrink-0">
              <Link href={`/analysis/${tender.id}`}>
                <motion.div whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.97 }}
                  className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-[12px] font-semibold cursor-pointer"
                  style={{ background: 'rgba(124,58,237,0.08)', border: '1px solid rgba(124,58,237,0.2)', color: '#7c3aed' }}>
                  View <ArrowUpRight className="w-3.5 h-3.5" />
                </motion.div>
              </Link>
              {canUpdate && nextActions.length > 0 && (
                <motion.button whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.97 }}
                  onClick={() => setShowModal(true)}
                  className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-[12px] font-semibold cursor-pointer"
                  style={{ background: 'rgba(22,163,74,0.08)', border: '1px solid rgba(22,163,74,0.2)', color: '#16a34a' }}>
                  Update <ChevronRight className="w-3.5 h-3.5" />
                </motion.button>
              )}
            </div>
          </div>

          {/* Pipeline Bar */}
          <div className="mt-3 pt-3" style={{ borderTop: '1px solid #f8fafc' }}>
            <PipelineBar status={tender.bidStatus} />
          </div>

          {/* Remarks / notes per status */}
          {tender.bidStatus === 'rejected' && tender.rejectedReason && (
            <div className="mt-2 px-3.5 py-2.5 rounded-xl" style={{ background: 'rgba(220,38,38,0.04)', border: '1px solid rgba(220,38,38,0.1)' }}>
              <p className="text-[11.5px]" style={{ color: '#dc2626' }}>
                <span className="font-semibold">Rejection reason:</span> {tender.rejectedReason}
              </p>
            </div>
          )}
          {tender.bidStatus === 'bid_evaluated' && tender.bidEvaluatedRemark && (
            <div className="mt-2 px-3.5 py-2.5 rounded-xl" style={{ background: 'rgba(124,58,237,0.04)', border: '1px solid rgba(124,58,237,0.12)' }}>
              <p className="text-[11.5px]" style={{ color: '#7c3aed' }}>
                <span className="font-semibold">Evaluation note:</span> {tender.bidEvaluatedRemark}
              </p>
            </div>
          )}
          {tender.bidStatus === 'bid_participated' && (
            <div className="mt-2 px-3.5 py-2.5 rounded-xl space-y-1" style={{ background: 'rgba(2,132,199,0.04)', border: '1px solid rgba(2,132,199,0.12)' }}>
              {tender.bidAmount && (
                <p className="text-[11.5px]" style={{ color: '#0284c7' }}>
                  <span className="font-semibold">Our bid:</span> {tender.bidAmount}
                </p>
              )}
              {tender.bidParticipatedRemark && (
                <p className="text-[11.5px]" style={{ color: '#0284c7' }}>
                  <span className="font-semibold">Remark:</span> {tender.bidParticipatedRemark}
                </p>
              )}
            </div>
          )}
          {tender.bidStatus === 'bid_dropped' && tender.bidDroppedReason && (
            <div className="mt-2 px-3.5 py-2.5 rounded-xl" style={{ background: 'rgba(220,38,38,0.04)', border: '1px solid rgba(220,38,38,0.1)' }}>
              <p className="text-[11.5px]" style={{ color: '#dc2626' }}>
                <span className="font-semibold">Drop reason:</span> {tender.bidDroppedReason}
              </p>
            </div>
          )}
          {tender.bidStatus === 'not_awarded' && tender.awardRemark && (
            <div className="mt-2 px-3.5 py-2.5 rounded-xl" style={{ background: 'rgba(100,116,139,0.04)', border: '1px solid rgba(100,116,139,0.1)' }}>
              <p className="text-[11.5px]" style={{ color: '#64748b' }}>
                <span className="font-semibold">Remark:</span> {tender.awardRemark}
              </p>
            </div>
          )}

          {/* Updated-by / when */}
          {tender.bidStatusUpdatedBy && tender.bidStatus && tender.bidStatus !== 'assigned' && (
            <p className="text-[10.5px] mt-2" style={{ color: '#94a3b8' }}>
              Last updated by <span className="font-medium">{tender.bidStatusUpdatedBy}</span>
              {tender.bidStatusUpdatedAt && ` · ${formatDate(tender.bidStatusUpdatedAt)}`}
            </p>
          )}

          {/* Bidder details if awarded */}
          <BidderDetails tender={tender} isAdmin={isAdmin} onFilled={onStatusUpdated} />

          {/* PQC snapshot */}
          {analysis?.pqcRequirements && (
            <div className="mt-4 pt-4 grid grid-cols-3 gap-3" style={{ borderTop: '1px solid #f1f5f9' }}>
              {[
                { label: 'Turnover',   value: analysis.pqcRequirements.turnoverCriteria  },
                { label: 'Experience', value: analysis.pqcRequirements.experienceCriteria },
                { label: 'Technical',  value: analysis.pqcRequirements.technicalCriteria  },
              ].map(({ label, value }) => (
                <div key={label} className="rounded-xl p-3" style={{ background: '#f8fafc', border: '1px solid #e2e8f0' }}>
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

      {/* Update Modal */}
      <AnimatePresence>
        {showModal && (
          <UpdateModal tender={tender} onClose={() => setShowModal(false)} onUpdated={onStatusUpdated} />
        )}
      </AnimatePresence>
    </>
  );
}

// ── Main Page ──────────────────────────────────────────────────────────────────

type FilterTab = 'all' | 'active' | 'awarded' | 'closed';

export default function MyTendersPage() {
  const { data: session } = useSession();
  const [tenders, setTenders] = useState<Tender[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<FilterTab>('all');
  const [search, setSearch] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch('/api/tenders/mine');
      const json = await r.json();
      if (json.error) throw new Error(json.error);
      setTenders(json.data || []);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const awarded   = tenders.filter(t => t.bidStatus === 'tender_awarded').length;
  const active    = tenders.filter(t => !TERMINAL.includes(t.bidStatus as BidStatus)).length;
  const terminal  = tenders.filter(t => TERMINAL.includes(t.bidStatus as BidStatus)).length;

  const filtered = useMemo(() => {
    let list = tenders;
    if (filter === 'active')  list = list.filter(t => !TERMINAL.includes(t.bidStatus as BidStatus));
    if (filter === 'awarded') list = list.filter(t => t.bidStatus === 'tender_awarded');
    if (filter === 'closed')  list = list.filter(t => TERMINAL.includes(t.bidStatus as BidStatus) && t.bidStatus !== 'tender_awarded');
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(t => t.title.toLowerCase().includes(q) || (t.issuedBy || '').toLowerCase().includes(q));
    }
    return list;
  }, [tenders, filter, search]);

  const tabs: { key: FilterTab; label: string; count: number }[] = [
    { key: 'all',     label: 'All',         count: tenders.length },
    { key: 'active',  label: 'In Progress', count: active },
    { key: 'awarded', label: 'Awarded',     count: awarded },
    { key: 'closed',  label: 'Closed',      count: terminal - awarded },
  ];

  return (
    <div className="px-8 py-8 max-w-4xl mx-auto">

      {/* Header */}
      <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}
        className="mb-6">
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

      {/* Filter tabs + Search */}
      {!loading && tenders.length > 0 && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.1 }}
          className="flex flex-wrap items-center gap-3 mb-5">

          {/* Tabs */}
          <div className="flex gap-1 p-1 rounded-xl" style={{ background: '#f1f5f9' }}>
            {tabs.map(tab => (
              <button key={tab.key} onClick={() => setFilter(tab.key)}
                className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-[12.5px] font-semibold transition-all"
                style={{
                  background: filter === tab.key ? '#fff' : 'transparent',
                  color: filter === tab.key ? '#7c3aed' : '#64748b',
                  boxShadow: filter === tab.key ? '0 1px 4px rgba(0,0,0,0.08)' : 'none',
                }}>
                {tab.label}
                <span className="text-[10.5px] px-1.5 py-0.5 rounded-full font-bold"
                  style={{
                    background: filter === tab.key ? 'rgba(124,58,237,0.1)' : 'rgba(100,116,139,0.1)',
                    color: filter === tab.key ? '#7c3aed' : '#94a3b8',
                  }}>
                  {tab.count}
                </span>
              </button>
            ))}
          </div>

          {/* Search */}
          <div className="flex-1 min-w-[200px] relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5" style={{ color: '#94a3b8' }} />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search by title or department…"
              className="w-full pl-9 pr-3.5 py-2 rounded-xl text-[12.5px] outline-none"
              style={{ background: '#fff', border: '1px solid #e2e8f0', color: '#0f172a' }}
            />
            {search && (
              <button onClick={() => setSearch('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 flex items-center justify-center rounded-full hover:bg-slate-100">
                <X className="w-3 h-3" style={{ color: '#94a3b8' }} />
              </button>
            )}
          </div>
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
        <>
          {filtered.length === 0 ? (
            <div className="text-center py-16">
              <p className="text-[14px] font-semibold mb-1" style={{ color: '#334155' }}>No matching tenders</p>
              <p className="text-[12.5px]" style={{ color: '#94a3b8' }}>Try a different filter or search term.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {filtered.map((tender, i) => (
                <TenderCard key={tender.id} tender={tender} index={i} onStatusUpdated={load} isAdmin={session?.user?.role === 'admin'} />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}