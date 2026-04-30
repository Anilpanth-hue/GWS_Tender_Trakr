'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft, Microscope, Loader2, CheckCircle2, Building2,
  Calendar, IndianRupee, FileText, Users, AlertCircle, Clock,
  ExternalLink, Target, TrendingUp, ShieldAlert, Zap,
  Download, FolderArchive, FileDown, Phone, Mail, MapPin, User,
  RefreshCw, Sparkles, UserCheck, Send, X,
} from 'lucide-react';
import { useSession } from 'next-auth/react';
import { formatCurrency, formatDate } from '@/lib/utils';
import type { Tender, TenderL2Analysis, TenderDocument } from '@/types';

/* ── Section wrapper ─────────────────────────────────────────── */
function Section({
  title, children, icon: Icon, accentColor = '#7c3aed', delay = 0,
}: {
  title: string; children: React.ReactNode;
  icon?: React.ElementType; accentColor?: string; delay?: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
      className="rounded-2xl overflow-hidden"
      style={{
        background: '#ffffff',
        border: '1px solid #e2e8f0',
        borderLeft: `3px solid ${accentColor}`,
        boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
      }}
    >
      <div
        className="px-5 py-3.5 flex items-center gap-2.5"
        style={{ borderBottom: '1px solid #f1f5f9' }}
      >
        {Icon && <Icon className="w-4 h-4 flex-shrink-0" style={{ color: accentColor }} />}
        <span className="text-[13.5px] font-semibold" style={{ color: '#0f172a' }}>{title}</span>
      </div>
      <div className="px-5 py-4">{children}</div>
    </motion.div>
  );
}

/* ── Info row ────────────────────────────────────────────────── */
function InfoRow({ label, value, highlight, highlightColor = '#16a34a' }: {
  label: string; value: React.ReactNode; highlight?: boolean; highlightColor?: string;
}) {
  const isEmpty = !value || value === '—' || value === 'Not mentioned';
  return (
    <div className="flex gap-3 py-2.5" style={{ borderBottom: '1px solid #f8fafc' }}>
      <span className="text-[12px] w-36 flex-shrink-0 font-medium" style={{ color: '#94a3b8' }}>
        {label}
      </span>
      <span className="text-[12.5px] flex-1 font-medium" style={{
        color: isEmpty ? '#cbd5e1' : highlight ? highlightColor : '#0f172a',
      }}>
        {value || '—'}
      </span>
    </div>
  );
}

/* ── GWS Score ring ─────────────────────────────────────────── */
function ScoreRing({ score }: { score: number }) {
  const color = score >= 7 ? '#16a34a' : score >= 4 ? '#d97706' : '#dc2626';
  const glow  = score >= 7 ? 'rgba(22,163,74,0.15)' : score >= 4 ? 'rgba(217,119,6,0.15)' : 'rgba(220,38,38,0.15)';
  const label = score >= 7 ? 'Strong fit' : score >= 4 ? 'Moderate' : 'Weak fit';
  return (
    <div className="flex flex-col items-center gap-1.5">
      <div
        className="w-16 h-16 rounded-full flex items-center justify-center"
        style={{ border: `3px solid ${color}`, boxShadow: `0 0 18px ${glow}`, background: `${color}08` }}
      >
        <div className="text-center">
          <div className="text-[22px] font-bold leading-none" style={{ color }}>{score}</div>
          <div className="text-[9px] font-semibold" style={{ color: '#94a3b8' }}>/10</div>
        </div>
      </div>
      <span className="text-[10.5px] font-semibold" style={{ color: '#64748b' }}>{label}</span>
    </div>
  );
}

/* ── Action badge ────────────────────────────────────────────── */
function ActionBadge({ action }: { action: string }) {
  const upper     = (action || '').toUpperCase();
  const isBid     = upper.startsWith('BID') && !upper.includes('NO');
  const isNoBid   = upper.startsWith('NO');
  const isConsor  = upper.includes('CONSORTIUM');
  const color     = isBid ? '#16a34a' : isNoBid ? '#dc2626' : isConsor ? '#0284c7' : '#d97706';
  const label     = isBid ? 'BID' : isNoBid ? 'NO-BID' : isConsor ? 'CONSORTIUM' : 'EVALUATE';
  const Icon      = isBid ? CheckCircle2 : isNoBid ? ShieldAlert : isConsor ? Users : Microscope;
  return (
    <span
      className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full text-[12px] font-bold text-white"
      style={{ background: color, boxShadow: `0 2px 12px ${color}40` }}
    >
      <Icon className="w-3.5 h-3.5" /> {label}
    </span>
  );
}

/* ── Win probability badge ──────────────────────────────────── */
function WinBadge({ text }: { text: string }) {
  const isHigh = /high/i.test(text);
  const isLow  = /low/i.test(text);
  const color  = isHigh ? '#16a34a' : isLow ? '#dc2626' : '#d97706';
  const label  = text.split(/[—–]/)[0]?.trim() || text;
  return (
    <span
      className="text-[11.5px] font-semibold px-2.5 py-1 rounded-full"
      style={{
        background: `${color}10`,
        border: `1px solid ${color}28`,
        color,
      }}
    >
      {label} Win Probability
    </span>
  );
}

/* ── Documents Panel ─────────────────────────────────────────── */
function DocumentsPanel({ tenderId, detailUrl }: { tenderId: number; detailUrl: string }) {
  const [docs, setDocs]         = useState<TenderDocument[]>([]);
  const [loading, setLoading]   = useState(true);
  const [fetching, setFetching] = useState(false);
  const [polling, setPolling]   = useState(false);
  const [fetchMsg, setFetchMsg] = useState<string | null>(null);

  const loadDocs = async (): Promise<TenderDocument[]> => {
    const r    = await fetch(`/api/tenders/${tenderId}/documents`);
    const json = await r.json();
    const list: TenderDocument[] = json.data || [];
    setDocs(list);
    return list;
  };

  useEffect(() => {
    setLoading(true);
    loadDocs().finally(() => setLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tenderId]);

  async function triggerFetch() {
    setFetching(true); setFetchMsg(null);
    try {
      const res  = await fetch(`/api/tenders/${tenderId}/fetch-documents`, { method: 'POST' });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed');

      // Poll every 5s until documents appear (max 2 min)
      setPolling(true);
      setFetchMsg('Fetching documents…');
      const deadline = Date.now() + 120_000;
      const timer = setInterval(async () => {
        const list = await loadDocs();
        if (list.length > 0 || Date.now() > deadline) {
          clearInterval(timer);
          setPolling(false);
          setFetchMsg(list.length > 0 ? null : 'No documents found on Tender247.');
        }
      }, 5000);
    } catch (err) {
      setFetchMsg((err as Error).message);
    } finally {
      setFetching(false);
    }
  }

  const summaryPdf = docs.find(d => d.docType === 'summary_pdf');

  return (
    <Section title="Tender Documents" icon={FileDown} accentColor="#0284c7" delay={0.1}>
      {loading ? (
        <div className="flex items-center gap-2 text-[12.5px]" style={{ color: '#94a3b8' }}>
          <Loader2 className="w-3.5 h-3.5 animate-spin" /> Loading documents…
        </div>
      ) : docs.length === 0 ? (
        <div className="flex items-start justify-between gap-3">
          <div>
            {polling ? (
              <div className="flex items-center gap-2">
                <Loader2 className="w-3.5 h-3.5 animate-spin flex-shrink-0" style={{ color: '#7c3aed' }} />
                <p className="text-[13px] font-medium" style={{ color: '#7c3aed' }}>
                  Downloading documents — will appear automatically…
                </p>
              </div>
            ) : (
              <>
                <p className="text-[13.5px] font-medium mb-1" style={{ color: '#64748b' }}>
                  No documents downloaded yet
                </p>
                <p className="text-[12px]" style={{ color: '#94a3b8' }}>
                  Documents are fetched during scraping or manually below.
                </p>
              </>
            )}
            {fetchMsg && !polling && (
              <p className="text-[11.5px] mt-1.5" style={{ color: '#7c3aed' }}>{fetchMsg}</p>
            )}
          </div>
          {detailUrl && !polling && (
            <button
              onClick={triggerFetch}
              disabled={fetching}
              className="btn-primary flex-shrink-0 text-[11.5px] disabled:opacity-50"
            >
              {fetching ? <Loader2 className="w-3 h-3 animate-spin" /> : <Download className="w-3 h-3" />}
              {fetching ? 'Starting…' : 'Fetch Documents'}
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-2.5">
          {summaryPdf && (
            <div
              className="flex items-center justify-between p-3.5 rounded-xl"
              style={{ background: 'rgba(2,132,199,0.04)', border: '1px solid rgba(2,132,199,0.15)' }}
            >
              <div className="flex items-center gap-3">
                <FileText className="w-7 h-7 flex-shrink-0" style={{ color: '#0284c7' }} />
                <div>
                  <p className="text-[13px] font-medium" style={{ color: '#0f172a' }}>{summaryPdf.fileName}</p>
                  <p className="text-[11.5px]" style={{ color: '#94a3b8' }}>
                    T247 AI Summary{summaryPdf.fileSize ? ` · ${Math.round(summaryPdf.fileSize / 1024)}KB` : ''}
                  </p>
                </div>
              </div>
              {summaryPdf.filePath && (
                <a
                  href={summaryPdf.filePath}
                  download={summaryPdf.fileName}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11.5px] font-semibold transition-opacity hover:opacity-80"
                  style={{ background: 'rgba(2,132,199,0.08)', border: '1px solid rgba(2,132,199,0.2)', color: '#0284c7' }}
                >
                  <Download className="w-3 h-3" /> Download
                </a>
              )}
            </div>
          )}
          {/* Show individual docs that have a local file downloaded */}
          {docs.filter(d => d.docType !== 'summary_pdf' && d.filePath).map(doc => (
            <div
              key={doc.id}
              className="flex items-center justify-between p-3.5 rounded-xl"
              style={{ background: 'rgba(22,163,74,0.04)', border: '1px solid rgba(22,163,74,0.15)' }}
            >
              <div className="flex items-center gap-3">
                <FolderArchive className="w-7 h-7 flex-shrink-0" style={{ color: '#16a34a' }} />
                <div>
                  <p className="text-[13px] font-medium" style={{ color: '#0f172a' }}>{doc.fileName}</p>
                  <p className="text-[11.5px]" style={{ color: '#94a3b8' }}>
                    {doc.fileSize ? `${Math.round(doc.fileSize / 1024)} KB` : 'Tender document'}
                  </p>
                </div>
              </div>
              <a
                href={doc.filePath!}
                download={doc.fileName}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11.5px] font-semibold transition-opacity hover:opacity-80"
                style={{ background: 'rgba(22,163,74,0.08)', border: '1px solid rgba(22,163,74,0.2)', color: '#16a34a' }}
              >
                <Download className="w-3 h-3" /> Download
              </a>
            </div>
          ))}
          {detailUrl && (
            <a
              href={detailUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 text-[12px] transition-colors"
              style={{ color: '#94a3b8' }}
              onMouseEnter={e => (e.currentTarget.style.color = '#7c3aed')}
              onMouseLeave={e => (e.currentTarget.style.color = '#94a3b8')}>
              <ExternalLink className="w-3 h-3" /> View full tender on Tender247
            </a>
          )}
        </div>
      )}
    </Section>
  );
}

/* ── Contact Details ─────────────────────────────────────────── */
function ContactSection({
  contact, overview, delay = 0,
}: {
  contact?: TenderL2Analysis['contactDetails'];
  overview?: { contactPerson?: string; contactAddress?: string } | null;
  delay?: number;
}) {
  const person  = (contact?.contactPerson  !== 'Not mentioned' ? contact?.contactPerson  : null) || overview?.contactPerson  || null;
  const phone   = (contact?.phone          !== 'Not mentioned' ? contact?.phone          : null) || null;
  const email   = (contact?.email          !== 'Not mentioned' ? contact?.email          : null) || null;
  const address = (contact?.address        !== 'Not mentioned' ? contact?.address        : null) || overview?.contactAddress || null;

  const items = [
    { icon: User,   label: 'Contact Person', value: person,  href: null,                              color: '#d97706' },
    { icon: Phone,  label: 'Phone',          value: phone,   href: phone  ? `tel:${phone}`    : null, color: '#16a34a' },
    { icon: Mail,   label: 'Email',          value: email,   href: email  ? `mailto:${email}` : null, color: '#0284c7' },
    { icon: MapPin, label: 'Address',        value: address, href: null,                              color: '#7c3aed' },
  ].filter(i => i.value);

  if (items.length === 0) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.35 }}
      className="rounded-2xl overflow-hidden"
      style={{
        background: '#ffffff',
        border: '1px solid #e2e8f0',
        borderLeft: '3px solid #d97706',
        boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
      }}
    >
      <div className="px-5 py-3.5 flex items-center gap-2.5"
        style={{ borderBottom: '1px solid #f1f5f9' }}>
        <User className="w-4 h-4" style={{ color: '#d97706' }} />
        <span className="text-[13.5px] font-semibold" style={{ color: '#0f172a' }}>Contact Details</span>
      </div>
      <div className="px-5 py-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {items.map(({ icon: Icon, label, value, href, color }) => (
            <div
              key={label}
              className="flex items-start gap-3 p-3.5 rounded-xl"
              style={{ background: `${color}08`, border: `1px solid ${color}1e` }}
            >
              <Icon className="w-4 h-4 flex-shrink-0 mt-0.5" style={{ color }} />
              <div className="min-w-0">
                <p className="text-[10.5px] font-bold uppercase tracking-wide mb-0.5" style={{ color: `${color}99` }}>
                  {label}
                </p>
                {href ? (
                  <a href={href} className="text-[12.5px] font-medium break-all transition-opacity hover:opacity-80" style={{ color }}>
                    {value}
                  </a>
                ) : (
                  <p className="text-[12.5px] font-medium" style={{ color: '#0f172a' }}>{value}</p>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </motion.div>
  );
}

/* ── Assign Owner Modal ──────────────────────────────────────── */
function AssignOwnerModal({
  tenderId,
  currentOwner,
  onClose,
  onSuccess,
}: {
  tenderId: number;
  currentOwner: string | null;
  onClose: () => void;
  onSuccess: (email: string) => void;
}) {
  const [email, setEmail]     = useState(currentOwner || '');
  const [sending, setSending] = useState(false);
  const [error, setError]     = useState<string | null>(null);
  const [sent, setSent]       = useState(false);

  async function handleSend() {
    setError(null);
    const trimmed = email.trim().toLowerCase();
    if (!trimmed) { setError('Please enter an email address.'); return; }
    if (!trimmed.endsWith('@glasswing.in')) {
      setError('Only @glasswing.in email addresses are allowed.');
      return;
    }

    setSending(true);
    try {
      const res = await fetch(`/api/tenders/${tenderId}/assign-owner`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ assigneeEmail: trimmed }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to send');
      setSent(true);
      setTimeout(() => { onSuccess(trimmed); onClose(); }, 2000);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSending(false);
    }
  }

  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 z-50 flex items-center justify-center p-4"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={e => { if (e.target === e.currentTarget) onClose(); }}
        style={{ background: 'rgba(15,23,42,0.45)', backdropFilter: 'blur(4px)' }}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 12 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 12 }}
          transition={{ type: 'spring', bounce: 0.2, duration: 0.35 }}
          className="w-full max-w-md rounded-2xl overflow-hidden"
          style={{ background: '#fff', border: '1px solid #e2e8f0', boxShadow: '0 20px 60px rgba(0,0,0,0.15)' }}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4"
            style={{ borderBottom: '1px solid #f1f5f9', background: 'rgba(124,58,237,0.03)' }}>
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl flex items-center justify-center"
                style={{ background: 'rgba(124,58,237,0.08)', border: '1px solid rgba(124,58,237,0.15)' }}>
                <UserCheck className="w-4 h-4" style={{ color: '#7c3aed' }} />
              </div>
              <div>
                <p className="text-[13.5px] font-bold" style={{ color: '#0f172a' }}>Assign Ownership</p>
                <p className="text-[11px]" style={{ color: '#94a3b8' }}>
                  {currentOwner ? `Currently: ${currentOwner}` : 'No owner assigned yet'}
                </p>
              </div>
            </div>
            <button onClick={onClose} className="p-1.5 rounded-lg transition-colors hover:bg-slate-100">
              <X className="w-4 h-4" style={{ color: '#94a3b8' }} />
            </button>
          </div>

          {/* Body */}
          <div className="px-6 py-5">
            {sent ? (
              <div className="flex flex-col items-center gap-3 py-4">
                <div className="w-12 h-12 rounded-full flex items-center justify-center"
                  style={{ background: 'rgba(22,163,74,0.08)', border: '1px solid rgba(22,163,74,0.2)' }}>
                  <CheckCircle2 className="w-6 h-6" style={{ color: '#16a34a' }} />
                </div>
                <p className="text-[14px] font-semibold text-center" style={{ color: '#0f172a' }}>
                  Email sent successfully!
                </p>
                <p className="text-[12px] text-center" style={{ color: '#64748b' }}>
                  Tender assigned to <strong>{email}</strong>.<br />
                  A Gemini-written email has been sent from your Outlook.
                </p>
              </div>
            ) : (
              <>
                <p className="text-[12.5px] mb-4" style={{ color: '#64748b' }}>
                  Enter the <strong>@glasswing.in</strong> email of the clerk who will work on this tender.
                  Gemini will write a professional email and send it from your Outlook account.
                </p>

                <label className="block text-[11.5px] font-semibold mb-1.5" style={{ color: '#64748b' }}>
                  Clerk Email Address
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={e => { setEmail(e.target.value); setError(null); }}
                  onKeyDown={e => { if (e.key === 'Enter') handleSend(); }}
                  placeholder="clerk@glasswing.in"
                  disabled={sending}
                  className="w-full px-3.5 py-2.5 rounded-xl text-[13px] outline-none transition-all disabled:opacity-50"
                  style={{
                    border: error ? '1px solid rgba(239,68,68,0.5)' : '1px solid #e2e8f0',
                    background: '#f8fafc',
                    color: '#0f172a',
                  }}
                  onFocus={e => (e.target.style.borderColor = '#7c3aed')}
                  onBlur={e => (e.target.style.borderColor = error ? 'rgba(239,68,68,0.5)' : '#e2e8f0')}
                />

                {error && (
                  <p className="flex items-center gap-1.5 text-[11.5px] mt-2" style={{ color: '#dc2626' }}>
                    <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" /> {error}
                  </p>
                )}

                <div className="flex items-center gap-2.5 mt-5">
                  <button
                    onClick={onClose}
                    className="flex-1 py-2.5 rounded-xl text-[13px] font-medium transition-colors"
                    style={{ background: '#f8fafc', border: '1px solid #e2e8f0', color: '#64748b' }}
                    onMouseEnter={e => (e.currentTarget.style.background = '#f1f5f9')}
                    onMouseLeave={e => (e.currentTarget.style.background = '#f8fafc')}
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSend}
                    disabled={sending}
                    className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-[13px] font-semibold text-white transition-all disabled:opacity-60"
                    style={{
                      background: 'linear-gradient(135deg, #7c3aed, #6d28d9)',
                      boxShadow: '0 2px 12px rgba(124,58,237,0.35)',
                    }}
                  >
                    {sending ? (
                      <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Sending…</>
                    ) : (
                      <><Send className="w-3.5 h-3.5" /> Send via Outlook</>
                    )}
                  </button>
                </div>

                <p className="text-[10.5px] mt-3 text-center" style={{ color: '#cbd5e1' }}>
                  Email is composed by Gemini AI and sent from your Outlook account
                </p>
              </>
            )}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

/* ── Main Page ───────────────────────────────────────────────── */
export default function AnalysisDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { data: session }       = useSession();
  const [tender, setTender]     = useState<Tender | null>(null);
  const [loading, setLoading]   = useState(true);
  const [analyzing, setAnalyzing] = useState(false);
  const [error, setError]       = useState<string | null>(null);
  const [docsKey, setDocsKey]   = useState(0);
  const [showOwnerModal, setShowOwnerModal] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [refreshMsg, setRefreshMsg] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/tenders/${id}`)
      .then(r => r.json())
      .then(json => setTender(json.data))
      .finally(() => setLoading(false));
  }, [id]);

  async function checkForUpdates() {
    if (!tender) return;
    setRefreshing(true); setRefreshMsg(null);
    try {
      const res = await fetch(`/api/tenders/${id}/fetch-overview`, { method: 'POST' });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Refresh failed');
      const updated = await fetch(`/api/tenders/${id}`).then(r => r.json());
      setTender(updated.data);
      setRefreshMsg(json.message || 'Refreshed.');
    } catch (err) { setRefreshMsg((err as Error).message); }
    finally { setRefreshing(false); }
  }

  async function runAnalysis() {
    if (!tender) return;
    setAnalyzing(true); setError(null);
    try {
      const res = await fetch(`/api/analysis/${id}`, { method: 'POST' });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Analysis failed');
      const updated = await fetch(`/api/tenders/${id}`).then(r => r.json());
      setTender(updated.data);
      setDocsKey(k => k + 1);
    } catch (err) { setError((err as Error).message); }
    finally { setAnalyzing(false); }
  }

  if (loading) return (
    <div className="flex items-center justify-center h-full">
      <div className="flex flex-col items-center gap-3">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center"
          style={{ background: 'rgba(124,58,237,0.06)', border: '1px solid rgba(124,58,237,0.15)' }}>
          <Loader2 className="w-5 h-5 animate-spin" style={{ color: '#7c3aed' }} />
        </div>
        <p className="text-[13px]" style={{ color: '#94a3b8' }}>Loading tender…</p>
      </div>
    </div>
  );

  if (!tender) return (
    <div className="flex items-center justify-center h-full text-[13px]" style={{ color: '#94a3b8' }}>
      Tender not found
    </div>
  );

  // Normalize array fields in case the AI stored a string instead of an array
  const _toArr = (v: unknown): string[] =>
    Array.isArray(v) ? (v as string[]).filter(Boolean)
    : (typeof v === 'string' && v.trim() ? [v.trim()] : []);
  const raw = tender.l2Analysis;
  const analysis: TenderL2Analysis | null = raw ? {
    ...raw,
    keyRisks:              _toArr(raw.keyRisks),
    keyTermsAndConditions: _toArr(raw.keyTermsAndConditions),
    relevantBusinessLines: _toArr(raw.relevantBusinessLines),
    otherNotableTakeaways: _toArr(raw.otherNotableTakeaways),
  } : null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const overview = tender.tenderOverview as any;

  return (
    <>
    <div className="p-8 max-w-4xl mx-auto">

      {/* Back */}
      <Link
        href="/analysis"
        className="inline-flex items-center gap-1.5 text-[12.5px] mb-5 transition-all"
        style={{ color: '#94a3b8' }}
        onMouseEnter={e => (e.currentTarget.style.color = '#7c3aed')}
        onMouseLeave={e => (e.currentTarget.style.color = '#94a3b8')}
      >
        <ArrowLeft className="w-3.5 h-3.5" /> Back to Analysis
      </Link>

      {/* ── Header card ──────────────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35 }}
        className="rounded-2xl p-6 mb-5 relative overflow-hidden"
        style={{
          background: '#ffffff',
          border: '1px solid #e2e8f0',
          boxShadow: '0 1px 4px rgba(0,0,0,0.05)',
        }}
      >
        {/* Ambient glow */}
        <div className="absolute -top-12 -right-12 w-48 h-48 rounded-full pointer-events-none"
          style={{ background: 'radial-gradient(circle, rgba(124,58,237,0.06) 0%, transparent 70%)' }} />

        <div className="flex items-start justify-between gap-4 relative z-10">
          <div className="flex-1 min-w-0">
            <h1 className="text-[18px] font-bold leading-snug mb-3 capitalize" style={{ color: '#0f172a' }}>
              {tender.title}
            </h1>
            <div className="flex flex-wrap gap-x-5 gap-y-1.5 text-[12.5px]" style={{ color: '#64748b' }}>
              <span className="flex items-center gap-1.5">
                <FileText className="w-3.5 h-3.5" style={{ color: 'rgba(124,58,237,0.45)' }} />
                T247-{tender.tenderNo}
              </span>
              <span className="flex items-center gap-1.5">
                <Building2 className="w-3.5 h-3.5" /> {tender.issuedBy}
              </span>
              <span className="flex items-center gap-1.5">
                <IndianRupee className="w-3.5 h-3.5" />
                {tender.estimatedValue ? formatCurrency(tender.estimatedValue) : tender.estimatedValueRaw || '—'}
              </span>
              {tender.dueDate && (
                <span className="flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5" /> Due {formatDate(tender.dueDate)}
                </span>
              )}
            </div>
          </div>

          <div className="flex-shrink-0 flex flex-col items-end gap-2">
            {!tender.l2Analyzed ? (
              <button
                onClick={runAnalysis}
                disabled={analyzing}
                className="btn-primary disabled:opacity-50"
              >
                {analyzing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Microscope className="w-3.5 h-3.5" />}
                {analyzing ? 'Analyzing…' : 'Run AI Analysis'}
              </button>
            ) : (
              <>
                <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[11.5px] font-semibold"
                  style={{ background: 'rgba(22,163,74,0.07)', border: '1px solid rgba(22,163,74,0.18)', color: '#16a34a' }}>
                  <Sparkles className="w-3.5 h-3.5" /> Analyzed
                </span>
                <button
                  onClick={runAnalysis}
                  disabled={analyzing}
                  className="flex items-center gap-1 text-[11.5px] transition-colors"
                  style={{ color: '#94a3b8' }}
                  onMouseEnter={e => (e.currentTarget.style.color = '#7c3aed')}
                  onMouseLeave={e => (e.currentTarget.style.color = '#94a3b8')}
                >
                  <RefreshCw className={`w-3 h-3 ${analyzing ? 'animate-spin' : ''}`} /> Re-analyze
                </button>
                <button
                  onClick={checkForUpdates}
                  disabled={refreshing}
                  className="flex items-center gap-1 text-[11.5px] transition-colors"
                  style={{ color: '#94a3b8' }}
                  onMouseEnter={e => (e.currentTarget.style.color = '#0284c7')}
                  onMouseLeave={e => (e.currentTarget.style.color = '#94a3b8')}
                  title="Re-scrape T247 detail page to detect corrigendum / date extensions"
                >
                  <RefreshCw className={`w-3 h-3 ${refreshing ? 'animate-spin' : ''}`} />
                  {refreshing ? 'Checking…' : 'Check Updates'}
                </button>
                {refreshMsg && (
                  <p className="text-[10.5px] text-right max-w-[160px]"
                    style={{ color: refreshMsg.toLowerCase().includes('corrigendum') ? '#d97706' : '#64748b' }}>
                    {refreshMsg}
                  </p>
                )}
              </>
            )}

            {/* Assign Owner button — shown whenever there's an analysis */}
            {tender.l2Analyzed && (
              <button
                onClick={() => setShowOwnerModal(true)}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-[12px] font-semibold transition-all"
                style={{
                  background: tender.ownerEmail ? 'rgba(124,58,237,0.07)' : 'rgba(124,58,237,0.05)',
                  border: `1px solid ${tender.ownerEmail ? 'rgba(124,58,237,0.25)' : 'rgba(124,58,237,0.15)'}`,
                  color: '#7c3aed',
                }}
                onMouseEnter={e => (e.currentTarget.style.background = 'rgba(124,58,237,0.1)')}
                onMouseLeave={e => (e.currentTarget.style.background = tender.ownerEmail ? 'rgba(124,58,237,0.07)' : 'rgba(124,58,237,0.05)')}
              >
                <UserCheck className="w-3.5 h-3.5" />
                {tender.ownerEmail ? 'Reassign Owner' : 'Assign Owner'}
              </button>
            )}

            {/* Current owner display */}
            {tender.ownerEmail && (
              <p className="text-[10.5px] text-right" style={{ color: '#94a3b8' }}>
                Owner: <span style={{ color: '#7c3aed', fontWeight: 600 }}>{tender.ownerEmail}</span>
              </p>
            )}
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="mt-4 flex items-center gap-2 text-[12.5px] rounded-xl px-4 py-3"
            style={{ background: 'rgba(239,68,68,0.05)', border: '1px solid rgba(239,68,68,0.18)', color: '#dc2626' }}>
            <AlertCircle className="w-4 h-4 flex-shrink-0" /> {error}
          </div>
        )}

        {/* Analyzing progress */}
        <AnimatePresence>
          {analyzing && (
            <motion.div
              initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
              className="mt-4 overflow-hidden"
            >
              <div className="rounded-xl px-4 py-3.5"
                style={{ background: 'rgba(124,58,237,0.05)', border: '1px solid rgba(124,58,237,0.15)' }}>
                <div className="flex items-center gap-2 text-[12.5px] font-medium mb-1.5" style={{ color: '#7c3aed' }}>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" /> Sending to Gemini AI…
                </div>
                <p className="text-[11.5px]" style={{ color: 'rgba(124,58,237,0.5)' }}>
                  Reading document · Generating GWS intelligence report · 30–60 seconds
                </p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      {/* ── L1 Signals ───────────────────────────────────────── */}
      {tender.l1QualificationReasons?.length > 0 && (
        <motion.div
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.05 }}
          className="rounded-xl px-4 py-3 mb-5 flex flex-wrap items-center gap-2"
          style={{ background: 'rgba(124,58,237,0.04)', border: '1px solid rgba(124,58,237,0.12)' }}
        >
          <span className="text-[10px] font-bold uppercase tracking-[0.2em] mr-1" style={{ color: 'rgba(124,58,237,0.5)' }}>
            L1 Signals
          </span>
          {tender.l1QualificationReasons.map((r, i) => (
            <span key={i}
              className="flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full"
              style={{ background: 'rgba(124,58,237,0.07)', border: '1px solid rgba(124,58,237,0.18)', color: '#7c3aed' }}>
              <CheckCircle2 className="w-2.5 h-2.5" /> {r}
            </span>
          ))}
        </motion.div>
      )}

      {/* ── Documents ────────────────────────────────────────── */}
      <div className="mb-5">
        <DocumentsPanel key={docsKey} tenderId={tender.id} detailUrl={tender.detailUrl} />
      </div>

      {/* ── Empty state ──────────────────────────────────────── */}
      {!analysis && !analyzing && (
        <motion.div
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.12 }}
          className="rounded-2xl p-14 flex flex-col items-center text-center"
          style={{ background: '#ffffff', border: '1px solid #e2e8f0' }}
        >
          <div className="w-14 h-14 rounded-2xl flex items-center justify-center mb-4"
            style={{ background: 'rgba(124,58,237,0.05)', border: '1px solid rgba(124,58,237,0.12)' }}>
            <Microscope className="w-7 h-7" style={{ color: 'rgba(124,58,237,0.35)' }} />
          </div>
          <p className="text-[15px] font-semibold mb-1.5" style={{ color: '#64748b' }}>
            No AI analysis yet
          </p>
          <p className="text-[13px] max-w-xs mb-5" style={{ color: '#94a3b8' }}>
            Click &quot;Run AI Analysis&quot; to generate a GWS-specific intelligence report from the tender document.
          </p>
          <button onClick={runAnalysis} disabled={analyzing} className="btn-primary">
            <Microscope className="w-3.5 h-3.5" /> Run AI Analysis
          </button>
        </motion.div>
      )}

      {/* ── Full Analysis ─────────────────────────────────────── */}
      {analysis && (
        <div className="space-y-4">

          {/* GWS Intelligence Banner */}
          <motion.div
            initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.08 }}
            className="rounded-2xl p-6 relative overflow-hidden"
            style={{
              background: 'linear-gradient(135deg, rgba(124,58,237,0.05) 0%, rgba(34,211,238,0.03) 100%)',
              border: '1px solid rgba(124,58,237,0.15)',
            }}
          >
            <div className="absolute -top-12 -right-12 w-48 h-48 rounded-full pointer-events-none"
              style={{ background: 'radial-gradient(circle, rgba(124,58,237,0.07) 0%, transparent 70%)' }} />

            <div className="flex items-start justify-between gap-5 relative z-10">
              <div className="flex-1">
                <p className="text-[10px] font-bold uppercase tracking-[0.25em] mb-3" style={{ color: 'rgba(124,58,237,0.55)' }}>
                  GWS Intelligence Report
                </p>
                <div className="flex flex-wrap items-center gap-2.5 mb-3">
                  <ActionBadge action={analysis.recommendedAction} />
                  {analysis.winProbabilityAssessment && (
                    <WinBadge text={analysis.winProbabilityAssessment} />
                  )}
                </div>
                <p className="text-[13px] leading-relaxed mb-3" style={{ color: '#334155' }}>
                  {analysis.gwsRelevanceReason}
                </p>
                {analysis.relevantBusinessLines?.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {analysis.relevantBusinessLines.map((bl, i) => (
                      <span key={i} className="text-[11px] px-2 py-0.5 rounded-full"
                        style={{ background: '#f1f5f9', color: '#64748b', border: '1px solid #e2e8f0' }}>
                        {bl}
                      </span>
                    ))}
                  </div>
                )}
              </div>
              <div className="flex-shrink-0">
                <ScoreRing score={analysis.gwsRelevanceScore} />
              </div>
            </div>
          </motion.div>

          {/* Revenue + Competitive (2-col) */}
          <div className="grid grid-cols-2 gap-4">
            <motion.div
              initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.12 }}
              className="rounded-2xl p-4"
              style={{ background: '#ffffff', border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.03)' }}
            >
              <div className="flex items-center gap-2 mb-2">
                <TrendingUp className="w-3.5 h-3.5" style={{ color: '#7c3aed' }} />
                <span className="text-[12px] font-semibold" style={{ color: '#64748b' }}>Revenue Potential</span>
              </div>
              <p className="text-[13px]" style={{ color: '#0f172a' }}>
                {analysis.estimatedRevenuePotential || '—'}
              </p>
            </motion.div>
            <motion.div
              initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.14 }}
              className="rounded-2xl p-4"
              style={{ background: '#ffffff', border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.03)' }}
            >
              <div className="flex items-center gap-2 mb-2">
                <Users className="w-3.5 h-3.5" style={{ color: '#0284c7' }} />
                <span className="text-[12px] font-semibold" style={{ color: '#64748b' }}>Competitive Edge</span>
              </div>
              <p className="text-[13px]" style={{ color: '#475569' }}>
                {analysis.competitiveInsights || '—'}
              </p>
            </motion.div>
          </div>

          {/* Scope */}
          <Section title="Scope of Work" icon={FileText} accentColor="#7c3aed" delay={0.15}>
            <p className="text-[13.5px] leading-relaxed" style={{ color: '#334155' }}>
              {analysis.scopeOfWork}
            </p>
          </Section>

          {/* Contact */}
          <ContactSection contact={analysis.contactDetails} overview={overview} delay={0.17} />

          {/* PQC */}
          <Section title="Pre-Qualification Criteria" icon={AlertCircle} accentColor="#d97706" delay={0.18}>
            <InfoRow label="Turnover"   value={analysis.pqcRequirements?.turnoverCriteria} />
            <InfoRow label="Experience" value={analysis.pqcRequirements?.experienceCriteria} />
            <InfoRow label="Technical"  value={analysis.pqcRequirements?.technicalCriteria} />
            {analysis.pqcRequirements?.otherCriteria &&
              analysis.pqcRequirements.otherCriteria !== 'Not mentioned' && (
              <InfoRow label="Other" value={analysis.pqcRequirements.otherCriteria} />
            )}
          </Section>

          {/* Financial + Schedule */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Section title="Financial Details" icon={IndianRupee} accentColor="#16a34a" delay={0.2}>
              <InfoRow label="EMD"             value={analysis.emdAmount} />
              <InfoRow label="PBG"             value={analysis.performanceBankGuarantee} />
              <InfoRow label="Duration"        value={analysis.contractDuration} />
              <InfoRow label="Consortium/JV"   value={analysis.consortiumJv} highlight={/allowed/i.test(analysis.consortiumJv || '')} />
              <InfoRow label="Reverse Auction" value={analysis.reverseAuction} highlight={/yes/i.test(analysis.reverseAuction || '')} highlightColor="#dc2626" />
              <InfoRow label="Bid Method"      value={analysis.bidEvaluationProcess} />
            </Section>
            <Section title="Tender Schedule" icon={Calendar} accentColor="#7c3aed" delay={0.22}>
              <InfoRow label="Pre-Bid"    value={analysis.tenderSchedule?.preBidMeetings} />
              <InfoRow label="Submission" value={analysis.tenderSchedule?.bidDate} />
              <InfoRow label="Opening"    value={analysis.tenderSchedule?.openingDate} />
              {analysis.mseExemptions && analysis.mseExemptions !== 'Not mentioned' && (
                <InfoRow label="MSE Exempt" value={analysis.mseExemptions} />
              )}
              {analysis.startupExemptions && analysis.startupExemptions !== 'Not mentioned' && (
                <InfoRow label="Startup Exempt" value={analysis.startupExemptions} />
              )}
            </Section>
          </div>

          {/* Risks */}
          {analysis.keyRisks?.length > 0 && (
            <Section title="Key Risks" icon={ShieldAlert} accentColor="#dc2626" delay={0.24}>
              <ul className="space-y-2.5">
                {analysis.keyRisks.map((risk, i) => (
                  <li key={i} className="flex items-start gap-3 text-[13px]" style={{ color: '#334155' }}>
                    <span
                      className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 text-[10px] font-bold mt-0.5"
                      style={{ background: 'rgba(239,68,68,0.08)', color: '#dc2626', border: '1px solid rgba(239,68,68,0.18)' }}
                    >{i + 1}</span>
                    {risk}
                  </li>
                ))}
              </ul>
            </Section>
          )}

          {/* Key Terms */}
          {analysis.keyTermsAndConditions?.length > 0 && (
            <Section title="Key Terms & Conditions" icon={FileText} delay={0.26}>
              <ul className="space-y-2">
                {analysis.keyTermsAndConditions.map((term, i) => (
                  <li key={i} className="flex items-start gap-2.5 text-[13px]" style={{ color: '#475569' }}>
                    <Zap className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" style={{ color: '#d97706' }} />
                    {term}
                  </li>
                ))}
              </ul>
            </Section>
          )}

          {/* Notable Takeaways */}
          {analysis.otherNotableTakeaways?.some(t => t && t !== 'Not mentioned') && (
            <Section title="Notable Takeaways" icon={Target} delay={0.28}>
              <ul className="space-y-2">
                {analysis.otherNotableTakeaways
                  .filter(t => t && t !== 'Not mentioned')
                  .map((t, i) => (
                  <li key={i} className="flex items-start gap-2.5 text-[13px]" style={{ color: '#475569' }}>
                    <Target className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" style={{ color: '#7c3aed' }} />
                    {t}
                  </li>
                ))}
              </ul>
            </Section>
          )}

          {/* Footer timestamp */}
          <div className="flex items-center gap-2 text-[11.5px] justify-end pb-6" style={{ color: '#94a3b8' }}>
            <Clock className="w-3 h-3" />
            Analyzed by Gemini AI · {formatDate(analysis.analyzedAt)}
          </div>
        </div>
      )}
    </div>

    {/* ── Assign Owner Modal ─────────────────────────────── */}
    {showOwnerModal && (
      <AssignOwnerModal
        tenderId={tender.id}
        currentOwner={tender.ownerEmail}
        onClose={() => setShowOwnerModal(false)}
        onSuccess={(email) => setTender(t => t ? { ...t, ownerEmail: email, ownerAssignedAt: new Date().toISOString() } : t)}
      />
    )}

    {/* Suppress unused session warning */}
    {session && null}
    </>
  );
}
