'use client';

import { useEffect, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ShieldCheck, Users, Crown, Eye, Clock, CheckCircle2,
  XCircle, AlertCircle, ChevronDown, ArrowUpRight, Loader2,
  Trophy, MinusCircle, X,
} from 'lucide-react';
import { formatDate } from '@/lib/utils';
import type { AdminUser } from '@/app/api/admin/users/route';
import type { AssignmentRow } from '@/app/api/admin/assignments/route';
import type { BidStatus } from '@/types';

// ── Role config ────────────────────────────────────────────────────────────────
const ROLE_OPTIONS: { value: AdminUser['role']; label: string; color: string; bg: string }[] = [
  { value: 'admin',   label: 'Admin',   color: '#7c3aed', bg: 'rgba(124,58,237,0.08)' },
  { value: 'manager', label: 'Manager', color: '#0284c7', bg: 'rgba(2,132,199,0.08)'  },
  { value: 'viewer',  label: 'Viewer',  color: '#64748b', bg: 'rgba(100,116,139,0.08)'},
];
function roleMeta(role: string) { return ROLE_OPTIONS.find(r => r.value === role) ?? ROLE_OPTIONS[2]; }

// ── Bid status badge ───────────────────────────────────────────────────────────
function BidStatusBadge({ status }: { status: BidStatus | null }) {
  const map: Record<string, { label: string; color: string; bg: string; icon: React.ReactNode }> = {
    assigned:         { label: 'Awaiting Action',  color: '#94a3b8', bg: 'rgba(148,163,184,0.08)', icon: <Clock className="w-3 h-3" /> },
    rejected:         { label: 'Rejected',          color: '#dc2626', bg: 'rgba(220,38,38,0.08)',   icon: <XCircle className="w-3 h-3" /> },
    bid_evaluated:    { label: 'Bid Evaluated',     color: '#7c3aed', bg: 'rgba(124,58,237,0.08)',  icon: <CheckCircle2 className="w-3 h-3" /> },
    bid_dropped:      { label: 'Bid Dropped',       color: '#dc2626', bg: 'rgba(220,38,38,0.08)',   icon: <MinusCircle className="w-3 h-3" /> },
    bid_participated: { label: 'Bid Participated',  color: '#0284c7', bg: 'rgba(2,132,199,0.08)',   icon: <CheckCircle2 className="w-3 h-3" /> },
    tender_awarded:   { label: 'Tender Awarded',    color: '#16a34a', bg: 'rgba(22,163,74,0.08)',   icon: <Trophy className="w-3 h-3" /> },
    not_awarded:      { label: 'Not Awarded',       color: '#94a3b8', bg: 'rgba(148,163,184,0.08)', icon: <XCircle className="w-3 h-3" /> },
  };
  const d = map[status || 'assigned'];
  return (
    <span className="flex items-center gap-1 text-[10.5px] font-bold px-2.5 py-0.5 rounded-full"
      style={{ background: d.bg, color: d.color, border: `1px solid ${d.color}30` }}>
      {d.icon} {d.label}
    </span>
  );
}

function Avatar({ name, email }: { name: string; email: string }) {
  const letter = (name?.[0] || email?.[0] || '?').toUpperCase();
  return (
    <div className="w-8 h-8 rounded-full flex items-center justify-center text-[12px] font-bold text-white flex-shrink-0"
      style={{ background: 'linear-gradient(135deg, #7c3aed, #22d3ee)' }}>
      {letter}
    </div>
  );
}

// ── Bidder Fill Modal (admin only) ────────────────────────────────────────────
function BidderModal({ row, onClose, onSaved }: {
  row: AssignmentRow; onClose: () => void; onSaved: () => void;
}) {
  const [l1Name, setL1Name] = useState(row.l1Bidder || '');
  const [l1Price, setL1Price] = useState(row.l1Price || '');
  const [l2Name, setL2Name] = useState(row.l2Bidder || '');
  const [l2Price, setL2Price] = useState(row.l2Price || '');
  const [l3Name, setL3Name] = useState(row.l3Bidder || '');
  const [l3Price, setL3Price] = useState(row.l3Price || '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function save() {
    if (!l1Name.trim()) { setError('L1 Bidder name is required.'); return; }
    setSaving(true); setError('');
    const res = await fetch(`/api/tenders/${row.id}/bid-status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'fill_bidders', l1Bidder: l1Name, l1Price, l2Bidder: l2Name, l2Price, l3Bidder: l3Name, l3Price }),
    });
    const json = await res.json();
    if (json.error) { setError(json.error); setSaving(false); return; }
    onSaved(); onClose();
  }

  const fieldRow = (rank: string, name: string, setName: (v: string) => void, price: string, setPrice: (v: string) => void) => (
    <div key={rank} className="rounded-xl p-3.5" style={{ background: '#f8fafc', border: '1px solid #e2e8f0' }}>
      <p className="text-[10.5px] font-bold uppercase tracking-wide mb-2.5"
        style={{ color: rank === 'L1' ? '#16a34a' : '#94a3b8' }}>{rank} Bidder</p>
      <div className="space-y-2">
        <input value={name} onChange={e => setName(e.target.value)} placeholder="Bidder name / company"
          className="w-full rounded-lg px-3 py-2 text-[12.5px] outline-none"
          style={{ border: '1.5px solid #e2e8f0', background: '#fff', color: '#0f172a' }} />
        <input value={price} onChange={e => setPrice(e.target.value)} placeholder="Price / quote (e.g. ₹4.2 Cr)"
          className="w-full rounded-lg px-3 py-2 text-[12.5px] outline-none"
          style={{ border: '1.5px solid #e2e8f0', background: '#fff', color: '#0f172a' }} />
      </div>
    </div>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.4)' }}>
      <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
        className="w-full max-w-lg rounded-2xl overflow-hidden"
        style={{ background: '#fff', boxShadow: '0 24px 64px rgba(0,0,0,0.15)' }}>
        <div className="px-5 py-4 flex items-center justify-between"
          style={{ borderBottom: '1px solid #f1f5f9' }}>
          <div>
            <h3 className="text-[14px] font-bold" style={{ color: '#0f172a' }}>Fill Bidder Details</h3>
            <p className="text-[11.5px] line-clamp-1 mt-0.5" style={{ color: '#94a3b8' }}>{row.title}</p>
          </div>
          <button onClick={onClose} className="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-slate-100">
            <X className="w-4 h-4" style={{ color: '#64748b' }} />
          </button>
        </div>
        <div className="p-5 space-y-3">
          {fieldRow('L1', l1Name, setL1Name, l1Price, setL1Price)}
          {fieldRow('L2', l2Name, setL2Name, l2Price, setL2Price)}
          {fieldRow('L3', l3Name, setL3Name, l3Price, setL3Price)}
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

// ── User Row ───────────────────────────────────────────────────────────────────
function UserRow({ user, currentEmail, onRoleChange }: {
  user: AdminUser; currentEmail: string;
  onRoleChange: (id: number, role: AdminUser['role']) => Promise<void>;
}) {
  const [saving, setSaving] = useState(false);
  const [selectedRole, setSelectedRole] = useState<AdminUser['role']>(user.role);
  const [open, setOpen] = useState(false);
  const isSelf = user.email === currentEmail;

  async function save(role: AdminUser['role']) {
    setOpen(false);
    if (role === user.role) return;
    setSaving(true);
    await onRoleChange(user.id, role);
    setSaving(false);
  }

  return (
    <motion.tr initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }}
      className="border-b" style={{ borderColor: '#f1f5f9' }}>
      <td className="py-3.5 px-4">
        <div className="flex items-center gap-3">
          <Avatar name={user.name} email={user.email} />
          <div>
            <p className="text-[13px] font-semibold" style={{ color: '#0f172a' }}>
              {user.name} {isSelf && <span className="text-[10px] font-normal ml-1" style={{ color: '#94a3b8' }}>(you)</span>}
            </p>
            <p className="text-[11.5px]" style={{ color: '#94a3b8' }}>{user.email}</p>
          </div>
        </div>
      </td>
      <td className="py-3.5 px-4">
        <div className="relative inline-block">
          <button disabled={isSelf || saving} onClick={() => setOpen(o => !o)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-medium transition-all"
            style={{
              background: isSelf ? 'transparent' : roleMeta(selectedRole).bg,
              color: roleMeta(selectedRole).color,
              border: `1px solid ${roleMeta(selectedRole).color}30`,
              opacity: isSelf ? 0.6 : 1, cursor: isSelf ? 'not-allowed' : 'pointer',
            }}>
            {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : roleMeta(selectedRole).label}
            {!isSelf && <ChevronDown className="w-3 h-3" />}
          </button>
          {open && (
            <div className="absolute left-0 top-full mt-1 z-20 rounded-xl overflow-hidden shadow-xl"
              style={{ background: '#fff', border: '1px solid #e2e8f0', minWidth: 120 }}>
              {ROLE_OPTIONS.map(opt => (
                <button key={opt.value} onClick={() => { setSelectedRole(opt.value); save(opt.value); }}
                  className="w-full text-left px-3.5 py-2 text-[12px] font-medium hover:bg-slate-50"
                  style={{ color: opt.color }}>{opt.label}</button>
              ))}
            </div>
          )}
        </div>
      </td>
      <td className="py-3.5 px-4 text-[12px]" style={{ color: '#94a3b8' }}>
        {user.lastLogin ? formatDate(user.lastLogin) : <span className="italic">Never</span>}
      </td>
      <td className="py-3.5 px-4 text-[12px]" style={{ color: '#94a3b8' }}>
        {formatDate(user.createdAt)}
      </td>
    </motion.tr>
  );
}

// ── Assignment Row ─────────────────────────────────────────────────────────────
function AssignmentRowUI({ row, index, onRefresh }: {
  row: AssignmentRow; index: number; onRefresh: () => void;
}) {
  const [showBidderModal, setShowBidderModal] = useState(false);

  // Remark shown to admin depending on current status
  const remark =
    row.bidStatus === 'rejected'         ? row.rejectedReason :
    row.bidStatus === 'bid_dropped'      ? row.bidDroppedReason :
    row.bidStatus === 'bid_evaluated'    ? row.bidEvaluatedRemark :
    row.bidStatus === 'bid_participated' ? row.bidParticipatedRemark :
    (row.bidStatus === 'tender_awarded' || row.bidStatus === 'not_awarded') ? row.awardRemark : null;

  return (
    <>
      <motion.tr initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }}
        transition={{ delay: index * 0.04 }}
        className="border-b" style={{ borderColor: '#f1f5f9' }}>
        <td className="py-3.5 px-4">
          <p className="text-[12.5px] font-medium line-clamp-1" style={{ color: '#0f172a' }}>{row.title}</p>
          <p className="text-[11px] mt-0.5" style={{ color: '#94a3b8' }}>T247-{row.tenderNo} · Due {row.dueDate ? formatDate(row.dueDate) : '—'}</p>
        </td>
        <td className="py-3.5 px-4">
          <div className="flex items-center gap-2">
            <Avatar name={row.ownerName || row.ownerEmail} email={row.ownerEmail} />
            <div>
              <p className="text-[12px] font-medium" style={{ color: '#334155' }}>
                {row.ownerName || row.ownerEmail.split('@')[0]}
              </p>
              <p className="text-[10.5px]" style={{ color: '#94a3b8' }}>{row.ownerEmail}</p>
            </div>
          </div>
        </td>
        <td className="py-3.5 px-4"><BidStatusBadge status={row.bidStatus} /></td>
        <td className="py-3.5 px-4 max-w-[180px]">
          {remark ? (
            <p className="text-[11.5px] leading-snug line-clamp-2"
              style={{ color: (row.bidStatus === 'rejected' || row.bidStatus === 'bid_dropped') ? '#dc2626' : '#64748b' }}>
              {remark}
            </p>
          ) : (
            <span className="text-[11.5px] italic" style={{ color: '#94a3b8' }}>—</span>
          )}
        </td>
        <td className="py-3.5 px-4">
          <div className="flex items-center gap-2 flex-wrap">
            <Link href={`/analysis/${row.id}`}>
              <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.97 }}
                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11.5px] font-semibold cursor-pointer"
                style={{ background: 'rgba(124,58,237,0.08)', color: '#7c3aed', border: '1px solid rgba(124,58,237,0.2)' }}>
                View <ArrowUpRight className="w-3 h-3" />
              </motion.div>
            </Link>
            {row.bidStatus === 'tender_awarded' && (
              <motion.button whileHover={{ scale: 1.05 }} onClick={() => setShowBidderModal(true)}
                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11.5px] font-semibold cursor-pointer"
                style={{ background: 'rgba(22,163,74,0.08)', color: '#16a34a', border: '1px solid rgba(22,163,74,0.2)' }}>
                <Trophy className="w-3 h-3" /> {row.l1Bidder ? 'Edit Bidders' : 'Add Bidders'}
              </motion.button>
            )}
          </div>
          {/* Show bidder summary if filled */}
          {row.l1Bidder && (
            <p className="text-[10.5px] mt-1.5" style={{ color: '#94a3b8' }}>
              L1: {row.l1Bidder}{row.l1Price ? ` · ${row.l1Price}` : ''}
            </p>
          )}
        </td>
      </motion.tr>

      <AnimatePresence>
        {showBidderModal && (
          <tr><td colSpan={5}>
            <BidderModal row={row} onClose={() => setShowBidderModal(false)} onSaved={onRefresh} />
          </td></tr>
        )}
      </AnimatePresence>
    </>
  );
}

// ── Main Page ──────────────────────────────────────────────────────────────────
export default function AdminPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [assignments, setAssignments] = useState<AssignmentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (status === 'authenticated' && session?.user?.role !== 'admin') router.replace('/dashboard');
  }, [status, session, router]);

  const load = useCallback(async () => {
    try {
      const [uRes, aRes] = await Promise.all([fetch('/api/admin/users'), fetch('/api/admin/assignments')]);
      const [uJson, aJson] = await Promise.all([uRes.json(), aRes.json()]);
      if (uJson.error) throw new Error(uJson.error);
      setUsers(uJson.data || []);
      setAssignments(aJson.data || []);
    } catch (e) { setError((e as Error).message); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function handleRoleChange(id: number, role: AdminUser['role']) {
    const res = await fetch(`/api/admin/users/${id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ role }),
    });
    const json = await res.json();
    if (json.error) { alert(json.error); return; }
    setUsers(prev => prev.map(u => u.id === id ? { ...u, role } : u));
  }

  const admins = users.filter(u => u.role === 'admin').length;
  const managers = users.filter(u => u.role === 'manager').length;
  const viewers = users.filter(u => u.role === 'viewer').length;

  if (status === 'loading' || loading) return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="flex flex-col items-center gap-3">
        <div className="w-7 h-7 border-2 border-t-transparent rounded-full animate-spin"
          style={{ borderColor: 'rgba(124,58,237,0.2)', borderTopColor: '#7c3aed' }} />
        <p className="text-[13px]" style={{ color: '#94a3b8' }}>Loading admin panel…</p>
      </div>
    </div>
  );

  if (error) return (
    <div className="px-8 py-8 max-w-5xl mx-auto">
      <div className="rounded-2xl p-6 flex items-center gap-3"
        style={{ background: 'rgba(220,38,38,0.04)', border: '1px solid rgba(220,38,38,0.15)' }}>
        <AlertCircle className="w-5 h-5" style={{ color: '#dc2626' }} />
        <p className="text-[13px]" style={{ color: '#dc2626' }}>{error}</p>
      </div>
    </div>
  );

  return (
    <div className="px-8 py-8 max-w-5xl mx-auto">

      {/* Header */}
      <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }} className="mb-8">
        <div className="flex items-center gap-3 mb-1">
          <div className="w-9 h-9 rounded-[12px] flex items-center justify-center"
            style={{ background: 'rgba(124,58,237,0.1)', border: '1px solid rgba(124,58,237,0.2)' }}>
            <ShieldCheck className="w-4.5 h-4.5" style={{ color: '#7c3aed' }} />
          </div>
          <div>
            <h1 className="text-[22px] font-bold" style={{ color: '#0f172a' }}>Admin Panel</h1>
            <p className="text-[12.5px]" style={{ color: '#94a3b8' }}>Manage users and track tender assignments</p>
          </div>
        </div>
      </motion.div>

      {/* Stats */}
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.1 }}
        className="grid grid-cols-4 gap-4 mb-8">
        {[
          { label: 'Total Users', value: users.length,  icon: <Users className="w-4 h-4" />,     color: '#7c3aed' },
          { label: 'Admins',      value: admins,         icon: <Crown className="w-4 h-4" />,     color: '#7c3aed' },
          { label: 'Managers',    value: managers,       icon: <ShieldCheck className="w-4 h-4" />, color: '#0284c7' },
          { label: 'Viewers',     value: viewers,        icon: <Eye className="w-4 h-4" />,       color: '#64748b' },
        ].map(({ label, value, icon, color }) => (
          <div key={label} className="rounded-2xl p-4 flex items-center gap-3"
            style={{ background: '#fff', border: '1px solid #e2e8f0', boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>
            <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
              style={{ background: `${color}12`, color }}>{icon}</div>
            <div>
              <p className="text-[20px] font-bold leading-none" style={{ color }}>{value}</p>
              <p className="text-[11.5px] mt-0.5" style={{ color: '#94a3b8' }}>{label}</p>
            </div>
          </div>
        ))}
      </motion.div>

      {/* User Management */}
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}
        className="rounded-2xl overflow-hidden mb-8"
        style={{ background: '#fff', border: '1px solid #e2e8f0', boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>
        <div className="px-5 py-4 flex items-center gap-2.5" style={{ borderBottom: '1px solid #f1f5f9' }}>
          <Users className="w-4 h-4 flex-shrink-0" style={{ color: '#7c3aed' }} />
          <h2 className="text-[14px] font-bold" style={{ color: '#0f172a' }}>User Management</h2>
          <span className="ml-auto text-[11.5px] px-2.5 py-0.5 rounded-full font-medium"
            style={{ background: 'rgba(124,58,237,0.08)', color: '#7c3aed' }}>{users.length} users</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                {['User', 'Role', 'Last Login', 'Joined'].map(h => (
                  <th key={h} className="text-left px-4 py-3 text-[10.5px] font-bold uppercase tracking-wide"
                    style={{ color: '#94a3b8' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {users.map(u => (
                <UserRow key={u.id} user={u} currentEmail={session?.user?.email || ''} onRoleChange={handleRoleChange} />
              ))}
            </tbody>
          </table>
        </div>
      </motion.div>

      {/* Assignments Tracker */}
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
        className="rounded-2xl overflow-hidden"
        style={{ background: '#fff', border: '1px solid #e2e8f0', boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>
        <div className="px-5 py-4 flex items-center gap-2.5" style={{ borderBottom: '1px solid #f1f5f9' }}>
          <ShieldCheck className="w-4 h-4 flex-shrink-0" style={{ color: '#7c3aed' }} />
          <h2 className="text-[14px] font-bold" style={{ color: '#0f172a' }}>Assignments — Progress Tracker</h2>
          <span className="ml-auto text-[11.5px] px-2.5 py-0.5 rounded-full font-medium"
            style={{ background: 'rgba(124,58,237,0.08)', color: '#7c3aed' }}>{assignments.length} assigned</span>
        </div>

        {assignments.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3">
            <ShieldCheck className="w-10 h-10" style={{ color: 'rgba(124,58,237,0.2)' }} />
            <p className="text-[13px]" style={{ color: '#94a3b8' }}>No tenders assigned by you yet.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                  {['Tender', 'Assigned To', 'Bid Status', 'Latest Remark', 'Actions'].map(h => (
                    <th key={h} className="text-left px-4 py-3 text-[10.5px] font-bold uppercase tracking-wide"
                      style={{ color: '#94a3b8' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {assignments.map((a, i) => (
                  <AssignmentRowUI key={a.id} row={a} index={i} onRefresh={load} />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </motion.div>
    </div>
  );
}