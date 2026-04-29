'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { motion, useScroll, useTransform } from 'framer-motion';
import {
  TrendingUp, Zap, Brain, FileSearch, CheckCircle2, BarChart3,
  Shield, Clock, RefreshCw, ArrowRight, ChevronDown, Sparkles,
  Building2, Target, AlertTriangle, FileText, Star, Lock,
} from 'lucide-react';

/* ─────────────────────────────────────────────────────────────
   Animated Counter
───────────────────────────────────────────────────────────── */
function Counter({ to, suffix = '' }: { to: number; suffix?: string }) {
  const [val, setVal] = useState(0);
  const ref = useRef<HTMLSpanElement>(null);
  const started = useRef(false);

  useEffect(() => {
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting && !started.current) {
        started.current = true;
        const steps = 50;
        let step = 0;
        const timer = setInterval(() => {
          step++;
          setVal(Math.round(to * (step / steps)));
          if (step >= steps) clearInterval(timer);
        }, 20);
      }
    });
    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, [to]);

  return <span ref={ref}>{val.toLocaleString()}{suffix}</span>;
}

/* ─────────────────────────────────────────────────────────────
   Floating Particles (client-only to avoid hydration mismatch)
───────────────────────────────────────────────────────────── */
// Pre-computed deterministic particle data — same on server and client
const PARTICLE_DATA = Array.from({ length: 24 }, (_, i) => {
  // Use deterministic values based on index so SSR and client match
  const seed = i / 24;
  const seed2 = ((i * 7 + 3) % 24) / 24;
  const seed3 = ((i * 13 + 5) % 24) / 24;
  return {
    id: i,
    x: (seed * 97 + 1.5),
    y: (seed2 * 95 + 2),
    size: seed3 * 3 + 1,
    duration: seed * 8 + 6,
    delay: seed2 * 5,
    color: i % 3 === 0 ? 'rgba(124,58,237,0.35)' : i % 3 === 1 ? 'rgba(34,211,238,0.3)' : 'rgba(139,92,246,0.25)',
  };
});

function Particles() {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {PARTICLE_DATA.map(p => (
        <motion.div
          key={p.id}
          className="absolute rounded-full"
          style={{
            left: `${p.x}%`,
            top: `${p.y}%`,
            width: p.size,
            height: p.size,
            background: p.color,
            boxShadow: `0 0 ${p.size * 4}px ${p.color}`,
          }}
          animate={{
            y: [0, -30, 0],
            opacity: [0.4, 1, 0.4],
            scale: [1, 1.5, 1],
          }}
          transition={{
            duration: p.duration,
            delay: p.delay,
            repeat: Infinity,
            ease: 'easeInOut',
          }}
        />
      ))}
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────
   Animated Grid Lines
───────────────────────────────────────────────────────────── */
function GridBackground() {
  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden">
      <svg width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <pattern id="grid" width="60" height="60" patternUnits="userSpaceOnUse">
            <path d="M 60 0 L 0 0 0 60" fill="none" stroke="rgba(124,58,237,0.06)" strokeWidth="1"/>
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#grid)" />
      </svg>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────
   Feature Card
───────────────────────────────────────────────────────────── */
function FeatureCard({
  icon: Icon, title, description, color, delay = 0, tag,
}: {
  icon: React.ElementType; title: string; description: string;
  color: string; delay?: number; tag?: string;
}) {
  const [hovered, setHovered] = useState(false);
  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-40px' }}
      transition={{ duration: 0.5, delay, ease: [0.22, 1, 0.36, 1] }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className="relative rounded-2xl p-6 overflow-hidden transition-all duration-300 cursor-default"
      style={{
        background: '#ffffff',
        border: hovered ? `1px solid ${color}40` : '1px solid #e2e8f0',
        boxShadow: hovered ? `0 16px 40px ${color}18, 0 4px 12px rgba(0,0,0,0.06)` : '0 2px 8px rgba(0,0,0,0.04)',
        transform: hovered ? 'translateY(-3px)' : 'none',
      }}
    >
      {/* Corner glow */}
      <div className="absolute -top-10 -right-10 w-28 h-28 rounded-full pointer-events-none transition-opacity duration-300"
        style={{
          background: `radial-gradient(circle, ${color}15 0%, transparent 70%)`,
          opacity: hovered ? 1 : 0.3,
        }} />

      {/* Tag */}
      {tag && (
        <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold tracking-wide mb-4"
          style={{ background: `${color}12`, color, border: `1px solid ${color}25` }}>
          {tag}
        </span>
      )}

      {/* Icon */}
      <div className="w-11 h-11 rounded-xl flex items-center justify-center mb-4"
        style={{ background: `${color}10`, border: `1px solid ${color}20` }}>
        <Icon className="w-5 h-5" style={{ color }} />
      </div>

      <h3 className="text-[15px] font-semibold mb-2" style={{ color: '#0f172a' }}>{title}</h3>
      <p className="text-[13px] leading-relaxed" style={{ color: '#64748b' }}>{description}</p>
    </motion.div>
  );
}

/* ─────────────────────────────────────────────────────────────
   Step
───────────────────────────────────────────────────────────── */
function Step({ num, title, description, color, delay = 0 }: {
  num: number; title: string; description: string; color: string; delay?: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, x: -16 }}
      whileInView={{ opacity: 1, x: 0 }}
      viewport={{ once: true, margin: '-40px' }}
      transition={{ duration: 0.5, delay, ease: [0.22, 1, 0.36, 1] }}
      className="flex gap-5"
    >
      <div className="flex-shrink-0 flex flex-col items-center">
        <div className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-sm"
          style={{ background: `linear-gradient(135deg, ${color}, ${color}bb)`, boxShadow: `0 4px 14px ${color}40` }}>
          {num}
        </div>
        {num < 3 && <div className="w-px flex-1 mt-2" style={{ background: `linear-gradient(180deg, ${color}40, transparent)` }} />}
      </div>
      <div className="pb-8">
        <h4 className="text-[15px] font-semibold mb-1" style={{ color: '#0f172a' }}>{title}</h4>
        <p className="text-[13px] leading-relaxed" style={{ color: '#64748b' }}>{description}</p>
      </div>
    </motion.div>
  );
}

/* ─────────────────────────────────────────────────────────────
   Animated Dashboard Mockup
───────────────────────────────────────────────────────────── */
function DashboardMockup() {
  const bars = [65, 82, 45, 91, 58, 74, 88, 51, 95, 67];
  return (
    <div className="rounded-2xl overflow-hidden shadow-2xl border"
      style={{ background: '#ffffff', borderColor: '#e2e8f0', boxShadow: '0 32px 80px rgba(0,0,0,0.14)' }}>
      {/* Title bar */}
      <div className="flex items-center gap-2 px-4 py-3 border-b" style={{ background: '#f8fafc', borderColor: '#e2e8f0' }}>
        <div className="w-3 h-3 rounded-full" style={{ background: '#ef4444' }} />
        <div className="w-3 h-3 rounded-full" style={{ background: '#f59e0b' }} />
        <div className="w-3 h-3 rounded-full" style={{ background: '#22c55e' }} />
        <div className="flex-1 mx-3 h-5 rounded-md" style={{ background: '#e2e8f0' }} />
        <div className="w-16 h-5 rounded-md" style={{ background: '#e2e8f0' }} />
      </div>

      <div className="p-4">
        {/* Stats row */}
        <div className="grid grid-cols-4 gap-3 mb-4">
          {[
            { label: 'Total', val: '1,284', color: '#7c3aed' },
            { label: 'Qualified', val: '347',  color: '#22d3ee' },
            { label: 'Pending',   val: '28',   color: '#f59e0b' },
            { label: 'L2 Done',   val: '112',  color: '#22c55e' },
          ].map((s, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 + i * 0.1 }}
              className="rounded-xl p-3"
              style={{ background: `${s.color}08`, border: `1px solid ${s.color}18` }}
            >
              <p className="text-[17px] font-bold" style={{ color: '#0f172a' }}>{s.val}</p>
              <p className="text-[10px] font-medium" style={{ color: '#94a3b8' }}>{s.label}</p>
            </motion.div>
          ))}
        </div>

        {/* Chart area */}
        <div className="rounded-xl p-3 mb-3" style={{ background: '#f8fafc', border: '1px solid #e2e8f0' }}>
          <p className="text-[10px] font-semibold mb-3" style={{ color: '#94a3b8' }}>SCRAPE ACTIVITY</p>
          <div className="flex items-end gap-1 h-[52px]">
            {bars.map((h, i) => (
              <motion.div
                key={i}
                className="flex-1 rounded-t-sm"
                initial={{ height: 0 }}
                animate={{ height: `${h}%` }}
                transition={{ delay: 0.5 + i * 0.05, duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
                style={{ background: i % 2 === 0 ? '#7c3aed' : '#22d3ee', opacity: 0.7 }}
              />
            ))}
          </div>
        </div>

        {/* Table rows */}
        {[
          { title: 'Supply of Computer Hardware...', status: 'Qualified', color: '#22d3ee' },
          { title: 'Civil Works - New Building...', status: 'Accepted', color: '#22c55e' },
          { title: 'Catering Services Contract',    status: 'Rejected', color: '#ef4444' },
        ].map((row, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.8 + i * 0.1 }}
            className="flex items-center justify-between py-2 border-b"
            style={{ borderColor: '#f1f5f9' }}
          >
            <p className="text-[11px] truncate flex-1" style={{ color: '#475569' }}>{row.title}</p>
            <span className="text-[9px] font-bold px-2 py-0.5 rounded ml-2"
              style={{ background: `${row.color}15`, color: row.color }}>
              {row.status}
            </span>
          </motion.div>
        ))}
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────
   Main Landing Page
───────────────────────────────────────────────────────────── */
export default function LandingPage() {
  const [scrolled, setScrolled] = useState(false);
  const heroRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: heroRef, offset: ['start start', 'end start'] });
  const heroY  = useTransform(scrollYProgress, [0, 1], [0, 120]);
  const heroOp = useTransform(scrollYProgress, [0, 0.7], [1, 0]);

  useEffect(() => {
    const handler = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', handler);
    return () => window.removeEventListener('scroll', handler);
  }, []);

  return (
    <div className="min-h-screen" style={{ background: '#ffffff' }}>

      {/* ── Navbar ────────────────────────────────────────────── */}
      <motion.nav
        className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-6 md:px-12 py-4 transition-all duration-300"
        style={{
          background: scrolled ? 'rgba(255,255,255,0.92)' : 'transparent',
          backdropFilter: scrolled ? 'blur(20px)' : 'none',
          borderBottom: scrolled ? '1px solid rgba(226,232,240,0.7)' : '1px solid transparent',
          boxShadow: scrolled ? '0 4px 24px rgba(0,0,0,0.04)' : 'none',
        }}
      >
        {/* Logo */}
        <Link href="/" className="flex items-center gap-3">
          <div className="relative w-8 h-8">
            <div className="absolute inset-0 rounded-[10px]"
              style={{ background: 'linear-gradient(135deg, rgba(124,58,237,0.2), rgba(34,211,238,0.2))', filter: 'blur(8px)', transform: 'scale(1.2)' }} />
            <div className="relative w-8 h-8 rounded-[10px] flex items-center justify-center"
              style={{ background: 'linear-gradient(135deg, #7c3aed, #22d3ee)', boxShadow: '0 2px 12px rgba(124,58,237,0.35)' }}>
              <TrendingUp className="w-4 h-4 text-white" strokeWidth={2.5} />
            </div>
          </div>
          <div>
            <p className="text-[13.5px] font-bold leading-none" style={{ color: '#0f172a' }}>Tender Trakr</p>
            <p className="text-[9px] font-bold tracking-[0.2em] mt-0.5 text-gradient-violet">GLASSWING</p>
          </div>
        </Link>

        {/* Nav links */}
        <div className="hidden md:flex items-center gap-6">
          {['Features', 'How it works', 'Platform'].map(item => (
            <a key={item} href={`#${item.toLowerCase().replace(/\s+/g, '-')}`}
              className="text-[13px] font-medium transition-colors hover:opacity-70"
              style={{ color: '#475569' }}>
              {item}
            </a>
          ))}
        </div>

        {/* CTA */}
        <Link
          href="/login"
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-[13px] font-semibold transition-all hover:-translate-y-0.5 hover:shadow-lg"
          style={{
            background: 'linear-gradient(135deg, #7c3aed, #22d3ee)',
            color: '#ffffff',
            boxShadow: '0 2px 12px rgba(124,58,237,0.3)',
          }}
        >
          Sign In
          <ArrowRight className="w-3.5 h-3.5" />
        </Link>
      </motion.nav>

      {/* ── HERO ────────────────────────────────────────────────── */}
      <section ref={heroRef} className="relative min-h-screen flex items-center overflow-hidden pt-20">
        <GridBackground />
        <Particles />

        {/* Large ambient blobs */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-1/4 -left-32 w-[600px] h-[600px] rounded-full"
            style={{ background: 'radial-gradient(circle, rgba(124,58,237,0.07) 0%, transparent 65%)' }} />
          <div className="absolute bottom-1/4 -right-32 w-[500px] h-[500px] rounded-full"
            style={{ background: 'radial-gradient(circle, rgba(34,211,238,0.06) 0%, transparent 65%)' }} />
        </div>

        <div className="relative z-10 w-full max-w-[1280px] mx-auto px-6 md:px-12">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">

            {/* Left — copy */}
            <motion.div style={{ y: heroY, opacity: heroOp }}>
              {/* Eyebrow pill */}
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.1 }}
                className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full mb-6"
                style={{
                  background: 'rgba(124,58,237,0.07)',
                  border: '1px solid rgba(124,58,237,0.18)',
                }}
              >
                <Sparkles className="w-3.5 h-3.5" style={{ color: '#7c3aed' }} />
                <span className="text-[11px] font-bold tracking-[0.18em] uppercase" style={{ color: '#7c3aed' }}>
                  GWS Internal Platform
                </span>
                <span className="w-1.5 h-1.5 rounded-full pulse-dot" style={{ background: '#22c55e' }} />
              </motion.div>

              {/* Main headline */}
              <motion.h1
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.7, delay: 0.2, ease: [0.22, 1, 0.36, 1] }}
                className="text-[44px] md:text-[56px] font-extrabold leading-[1.08] tracking-tight mb-6"
              >
                <span style={{ color: '#0f172a' }}>The Tender</span>
                <br />
                <span className="text-gradient">Intelligence</span>
                <br />
                <span style={{ color: '#0f172a' }}>Platform</span>
              </motion.h1>

              {/* Sub */}
              <motion.p
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.35, ease: [0.22, 1, 0.36, 1] }}
                className="text-[16px] leading-relaxed mb-8 max-w-[480px]"
                style={{ color: '#475569' }}
              >
                Automatically scrape Tender247, screen hundreds of tenders in seconds,
                and let Gemini AI generate deep scope, risk, and BID/NO-BID reports —
                so your team focuses only on winning opportunities.
              </motion.p>

              {/* CTA buttons */}
              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.5 }}
                className="flex items-center gap-4 flex-wrap"
              >
                <Link
                  href="/login"
                  className="flex items-center gap-2.5 px-6 py-3.5 rounded-xl font-semibold text-[14.5px] text-white transition-all duration-200 hover:-translate-y-1 hover:shadow-xl active:translate-y-0"
                  style={{
                    background: 'linear-gradient(135deg, #7c3aed 0%, #22d3ee 100%)',
                    boxShadow: '0 4px 20px rgba(124,58,237,0.35)',
                  }}
                >
                  {/* Microsoft icon */}
                  <svg width="16" height="16" viewBox="0 0 21 21" fill="none">
                    <rect x="1" y="1" width="9" height="9" fill="rgba(255,255,255,0.8)"/>
                    <rect x="11" y="1" width="9" height="9" fill="rgba(255,255,255,0.6)"/>
                    <rect x="1" y="11" width="9" height="9" fill="rgba(255,255,255,0.6)"/>
                    <rect x="11" y="11" width="9" height="9" fill="rgba(255,255,255,0.8)"/>
                  </svg>
                  Sign In with Microsoft
                  <ArrowRight className="w-4 h-4" />
                </Link>
                <a href="#features"
                  className="flex items-center gap-2 px-5 py-3.5 rounded-xl font-semibold text-[14px] transition-all hover:bg-slate-50"
                  style={{ color: '#475569', border: '1px solid #e2e8f0' }}>
                  Explore Features
                  <ChevronDown className="w-4 h-4" />
                </a>
              </motion.div>

              {/* Trust badges */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.8 }}
                className="flex items-center gap-4 mt-8 flex-wrap"
              >
                {[
                  { icon: Lock, label: '@glasswing.in only' },
                  { icon: Shield, label: 'Internal & Secure' },
                  { icon: Zap, label: 'Real-time AI' },
                ].map(({ icon: Icon, label }) => (
                  <div key={label} className="flex items-center gap-1.5">
                    <Icon className="w-3.5 h-3.5" style={{ color: '#94a3b8' }} />
                    <span className="text-[12px]" style={{ color: '#94a3b8' }}>{label}</span>
                  </div>
                ))}
              </motion.div>
            </motion.div>

            {/* Right — dashboard mockup */}
            <motion.div
              initial={{ opacity: 0, x: 40, rotateY: 8 }}
              animate={{ opacity: 1, x: 0, rotateY: 0 }}
              transition={{ duration: 0.9, delay: 0.4, ease: [0.22, 1, 0.36, 1] }}
              className="relative hidden lg:block"
              style={{ perspective: '1200px' }}
            >
              {/* Glow behind mockup */}
              <div className="absolute -inset-8 rounded-3xl pointer-events-none"
                style={{ background: 'radial-gradient(ellipse at center, rgba(124,58,237,0.1) 0%, transparent 70%)' }} />
              <DashboardMockup />

              {/* Floating badge 1 */}
              <motion.div
                animate={{ y: [0, -8, 0] }}
                transition={{ duration: 3.5, repeat: Infinity, ease: 'easeInOut' }}
                className="absolute -left-10 top-1/3 rounded-xl px-3.5 py-2.5 shadow-lg"
                style={{ background: '#ffffff', border: '1px solid #e2e8f0', boxShadow: '0 8px 24px rgba(0,0,0,0.1)' }}
              >
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg flex items-center justify-center"
                    style={{ background: 'rgba(34,197,94,0.1)' }}>
                    <CheckCircle2 className="w-4 h-4" style={{ color: '#22c55e' }} />
                  </div>
                  <div>
                    <p className="text-[11px] font-bold" style={{ color: '#0f172a' }}>L1 Screened</p>
                    <p className="text-[10px]" style={{ color: '#94a3b8' }}>347 qualified</p>
                  </div>
                </div>
              </motion.div>

              {/* Floating badge 2 */}
              <motion.div
                animate={{ y: [0, 8, 0] }}
                transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut', delay: 0.5 }}
                className="absolute -right-8 bottom-1/4 rounded-xl px-3.5 py-2.5 shadow-lg"
                style={{ background: '#ffffff', border: '1px solid #e2e8f0', boxShadow: '0 8px 24px rgba(0,0,0,0.1)' }}
              >
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg flex items-center justify-center"
                    style={{ background: 'rgba(124,58,237,0.1)' }}>
                    <Brain className="w-4 h-4" style={{ color: '#7c3aed' }} />
                  </div>
                  <div>
                    <p className="text-[11px] font-bold" style={{ color: '#0f172a' }}>Gemini AI</p>
                    <p className="text-[10px]" style={{ color: '#94a3b8' }}>Analysing…</p>
                  </div>
                </div>
              </motion.div>
            </motion.div>
          </div>
        </div>

        {/* Scroll indicator */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.5 }}
          className="absolute bottom-10 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2"
        >
          <motion.div
            animate={{ y: [0, 6, 0] }}
            transition={{ duration: 1.5, repeat: Infinity }}
          >
            <ChevronDown className="w-5 h-5" style={{ color: '#94a3b8' }} />
          </motion.div>
        </motion.div>
      </section>

      {/* ── STATS STRIP ─────────────────────────────────────────── */}
      <section className="py-14 border-y" style={{ borderColor: '#e2e8f0', background: '#f8fafc' }}>
        <div className="max-w-[1280px] mx-auto px-6 md:px-12">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
            {[
              { val: 1000, suffix: '+', label: 'Tenders Scraped',  color: '#7c3aed' },
              { val: 95,   suffix: '%', label: 'Time Saved on L1', color: '#22d3ee' },
              { val: 2,    suffix: 'x', label: 'Daily Auto-Scrapes', color: '#f59e0b' },
              { val: 100,  suffix: '%', label: 'AI-Powered L2',    color: '#22c55e' },
            ].map((s, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 12 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1, duration: 0.5 }}
              >
                <p className="text-[36px] font-extrabold leading-none mb-1"
                  style={{ color: s.color }}>
                  <Counter to={s.val} suffix={s.suffix} />
                </p>
                <p className="text-[13px]" style={{ color: '#64748b' }}>{s.label}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── FEATURES ─────────────────────────────────────────────── */}
      <section id="features" className="py-24 max-w-[1280px] mx-auto px-6 md:px-12">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="text-center mb-14"
        >
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full mb-4"
            style={{ background: 'rgba(124,58,237,0.07)', border: '1px solid rgba(124,58,237,0.15)' }}>
            <Zap className="w-3.5 h-3.5" style={{ color: '#7c3aed' }} />
            <span className="text-[11px] font-bold uppercase tracking-[0.18em]" style={{ color: '#7c3aed' }}>Platform Capabilities</span>
          </div>
          <h2 className="text-[36px] font-extrabold tracking-tight mb-3 text-gradient">
            Everything you need to win tenders
          </h2>
          <p className="text-[15px] max-w-[500px] mx-auto" style={{ color: '#64748b' }}>
            From automated scraping to deep AI analysis — the full pipeline, end to end.
          </p>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          <FeatureCard icon={RefreshCw}    color="#7c3aed" delay={0}    tag="Automated"
            title="Smart Scraping"
            description="Automatically pulls tenders from Tender247 twice daily — morning and afternoon sessions — using a smart Puppeteer-based scraper." />
          <FeatureCard icon={FileSearch}   color="#22d3ee" delay={0.07} tag="L1 Screening"
            title="Keyword & Rule Filtering"
            description="Hundreds of tenders screened in seconds using configurable keyword rules, value thresholds, and category filters. Only relevant ones make it through." />
          <FeatureCard icon={Brain}        color="#8b5cf6" delay={0.14} tag="L2 AI Analysis"
            title="Gemini AI Deep Dives"
            description="Google Gemini reads the full tender document and produces scope of work, PQC criteria, risk assessment, and a BID/NO-BID recommendation." />
          <FeatureCard icon={Target}       color="#f59e0b" delay={0.21} tag="Decision Queue"
            title="Accept / Reject Workflow"
            description="Qualified tenders land in your review queue. Accept or reject with a reason — creating a full audit trail of every decision made." />
          <FeatureCard icon={BarChart3}    color="#22c55e" delay={0.28} tag="Analytics"
            title="Scrape Activity Dashboard"
            description="Live KPIs, trend charts, and breakdown donut — see how many tenders were found, qualified, and analysed across every session." />
          <FeatureCard icon={Building2}    color="#ef4444" delay={0.35} tag="Intelligence"
            title="GWS Business Matching"
            description="Analysis reports include GWS-specific win probability, relevant business lines, and strategic contact information for the tender issuer." />
        </div>
      </section>

      {/* ── HOW IT WORKS ──────────────────────────────────────────── */}
      <section id="how-it-works" className="py-24" style={{ background: '#f8fafc' }}>
        <div className="max-w-[1280px] mx-auto px-6 md:px-12">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-start">

            {/* Left — heading */}
            <div>
              <motion.div
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5 }}
              >
                <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full mb-4"
                  style={{ background: 'rgba(34,211,238,0.08)', border: '1px solid rgba(34,211,238,0.2)' }}>
                  <Clock className="w-3.5 h-3.5" style={{ color: '#22d3ee' }} />
                  <span className="text-[11px] font-bold uppercase tracking-[0.18em]" style={{ color: '#22d3ee' }}>The Pipeline</span>
                </div>
                <h2 className="text-[36px] font-extrabold tracking-tight mb-4">
                  <span className="text-gradient">From scrape</span>
                  <br />
                  <span style={{ color: '#0f172a' }}>to decision, in minutes</span>
                </h2>
                <p className="text-[15px] leading-relaxed mb-8" style={{ color: '#64748b' }}>
                  Tender Trakr handles the full intelligence pipeline automatically.
                  Your team sees only pre-screened, AI-analysed opportunities that match GWS&apos;s business profile.
                </p>

                {/* What AI analyses */}
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { icon: FileText,      color: '#7c3aed', label: 'Scope of Work' },
                    { icon: Shield,        color: '#22d3ee', label: 'PQC Criteria' },
                    { icon: AlertTriangle, color: '#f59e0b', label: 'Risk Assessment' },
                    { icon: Star,          color: '#22c55e', label: 'BID/NO-BID Call' },
                    { icon: Target,        color: '#8b5cf6', label: 'Win Probability' },
                    { icon: Building2,     color: '#ef4444', label: 'Business Lines' },
                  ].map(({ icon: Icon, color, label }) => (
                    <motion.div
                      key={label}
                      initial={{ opacity: 0, scale: 0.95 }}
                      whileInView={{ opacity: 1, scale: 1 }}
                      viewport={{ once: true }}
                      className="flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl"
                      style={{ background: '#ffffff', border: '1px solid #e2e8f0' }}
                    >
                      <div className="w-6 h-6 rounded-lg flex items-center justify-center flex-shrink-0"
                        style={{ background: `${color}12` }}>
                        <Icon className="w-3.5 h-3.5" style={{ color }} />
                      </div>
                      <span className="text-[12px] font-medium" style={{ color: '#475569' }}>{label}</span>
                    </motion.div>
                  ))}
                </div>
              </motion.div>
            </div>

            {/* Right — steps */}
            <div id="how-it-works" className="pt-2">
              <Step num={1} color="#7c3aed" delay={0}
                title="Automated Scraping — Twice Daily"
                description="The scheduler triggers at morning and afternoon. Puppeteer logs in to Tender247 and extracts every listing — titles, values, deadlines, issuers, and documents." />
              <Step num={2} color="#22d3ee" delay={0.1}
                title="L1 Keyword Screening"
                description="Each tender is instantly checked against your configured keyword rules and value thresholds. Matched tenders are marked Qualified and land in your review queue." />
              <Step num={3} color="#22c55e" delay={0.2}
                title="L2 AI Deep Analysis"
                description="Accept a tender to trigger Gemini AI analysis. Gemini reads the full PDF document and returns a structured report: scope, PQC, risks, win probability, and a BID/NO-BID recommendation." />
            </div>
          </div>
        </div>
      </section>

      {/* ── PLATFORM SECTION ─────────────────────────────────────── */}
      <section id="platform" className="py-24 max-w-[1280px] mx-auto px-6 md:px-12">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-14"
        >
          <h2 className="text-[36px] font-extrabold tracking-tight mb-3">
            <span style={{ color: '#0f172a' }}>Built for </span>
            <span className="text-gradient">Glasswing</span>
          </h2>
          <p className="text-[15px] max-w-[440px] mx-auto" style={{ color: '#64748b' }}>
            Secured with Microsoft Azure AD — only @glasswing.in accounts have access.
          </p>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {[
            {
              icon: Lock, color: '#7c3aed',
              title: 'Microsoft SSO',
              desc: 'Sign in once with your Glasswing Microsoft account. No separate passwords. Your identity is tied to your corporate Azure AD profile.',
            },
            {
              icon: Shield, color: '#22d3ee',
              title: 'Domain Restricted',
              desc: 'Only @glasswing.in accounts are authorised. Any other Microsoft account is rejected at login. Zero exposure to external users.',
            },
            {
              icon: Building2, color: '#f59e0b',
              title: 'Role-Based Access',
              desc: 'Viewer, Manager, and Admin roles control what each team member can see and do — from reading tenders to triggering scrapes.',
            },
          ].map((card, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1, duration: 0.5 }}
              className="rounded-2xl p-6 text-center"
              style={{ background: '#f8fafc', border: '1px solid #e2e8f0' }}
            >
              <div className="w-12 h-12 rounded-2xl flex items-center justify-center mx-auto mb-4"
                style={{ background: `${card.color}10`, border: `1px solid ${card.color}20` }}>
                <card.icon className="w-5 h-5" style={{ color: card.color }} />
              </div>
              <h3 className="font-semibold mb-2" style={{ color: '#0f172a' }}>{card.title}</h3>
              <p className="text-[13px] leading-relaxed" style={{ color: '#64748b' }}>{card.desc}</p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* ── FINAL CTA ────────────────────────────────────────────── */}
      <section className="py-24 relative overflow-hidden" style={{ background: '#0f172a' }}>
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-0 left-1/3 w-[500px] h-[500px] rounded-full"
            style={{ background: 'radial-gradient(circle, rgba(124,58,237,0.15) 0%, transparent 65%)' }} />
          <div className="absolute bottom-0 right-1/3 w-[400px] h-[400px] rounded-full"
            style={{ background: 'radial-gradient(circle, rgba(34,211,238,0.1) 0%, transparent 65%)' }} />
          <GridBackground />
        </div>

        <div className="relative z-10 max-w-[640px] mx-auto px-6 text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
          >
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full mb-6"
              style={{ background: 'rgba(124,58,237,0.15)', border: '1px solid rgba(124,58,237,0.3)' }}>
              <Sparkles className="w-3.5 h-3.5" style={{ color: '#a78bfa' }} />
              <span className="text-[11px] font-bold uppercase tracking-[0.18em]" style={{ color: '#a78bfa' }}>
                Ready to go
              </span>
            </div>

            <h2 className="text-[40px] font-extrabold tracking-tight mb-4 leading-tight text-white">
              Start finding
              <br />
              <span className="text-gradient">winning tenders</span>
            </h2>

            <p className="text-[15px] mb-8" style={{ color: 'rgba(255,255,255,0.6)' }}>
              Sign in with your Glasswing Microsoft account to access the platform.
              Your team&apos;s tender intelligence, powered by AI.
            </p>

            <Link
              href="/login"
              className="inline-flex items-center gap-3 px-8 py-4 rounded-2xl font-bold text-[15px] text-white transition-all duration-200 hover:-translate-y-1 hover:shadow-2xl"
              style={{
                background: 'linear-gradient(135deg, #7c3aed 0%, #22d3ee 100%)',
                boxShadow: '0 8px 32px rgba(124,58,237,0.4)',
              }}
            >
              <svg width="18" height="18" viewBox="0 0 21 21" fill="none">
                <rect x="1" y="1" width="9" height="9" fill="rgba(255,255,255,0.85)"/>
                <rect x="11" y="1" width="9" height="9" fill="rgba(255,255,255,0.65)"/>
                <rect x="1" y="11" width="9" height="9" fill="rgba(255,255,255,0.65)"/>
                <rect x="11" y="11" width="9" height="9" fill="rgba(255,255,255,0.85)"/>
              </svg>
              Sign In with Microsoft
              <ArrowRight className="w-4.5 h-4.5" />
            </Link>

            <p className="text-[12px] mt-5" style={{ color: 'rgba(255,255,255,0.3)' }}>
              @glasswing.in accounts only · Internal use only
            </p>
          </motion.div>
        </div>
      </section>

      {/* ── FOOTER ──────────────────────────────────────────────── */}
      <footer className="py-8 border-t" style={{ background: '#f8fafc', borderColor: '#e2e8f0' }}>
        <div className="max-w-[1280px] mx-auto px-6 md:px-12 flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-3">
            <div className="w-7 h-7 rounded-[8px] flex items-center justify-center"
              style={{ background: 'linear-gradient(135deg, #7c3aed, #22d3ee)' }}>
              <TrendingUp className="w-3.5 h-3.5 text-white" strokeWidth={2.5} />
            </div>
            <div>
              <p className="text-[12px] font-bold" style={{ color: '#0f172a' }}>Tender Trakr</p>
              <p className="text-[10px]" style={{ color: '#94a3b8' }}>by Glasswing Solutions</p>
            </div>
          </div>
          <p className="text-[12px]" style={{ color: '#94a3b8' }}>
            Built by Glasswing Solutions · Internal use only · v1.0
          </p>
        </div>
      </footer>
    </div>
  );
}
