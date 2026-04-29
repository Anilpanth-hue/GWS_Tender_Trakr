"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  LayoutDashboard,
  FileText,
  Microscope,
  Settings,
  RefreshCw,
  TrendingUp,
  ChevronRight,
  LogOut,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { NavigationProgress } from "@/components/NavigationProgress";
import { useSession } from "next-auth/react";

const NAV = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/tenders", label: "Tenders", icon: FileText },
  { href: "/analysis", label: "L2 Analysis", icon: Microscope },
  { href: "/scrape-runs", label: "Scrape Runs", icon: RefreshCw },
  { href: "/settings", label: "Settings", icon: Settings },
];

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router   = useRouter();
  const { data: session, status } = useSession();

  // Redirect unauthenticated users (safety net — middleware should already handle this)
  if (status === 'unauthenticated') {
    router.replace('/login');
    return null;
  }

  // Show spinner while session is loading
  if (status === 'loading') {
    return (
      <div className="flex items-center justify-center min-h-screen" style={{ background: '#f8fafc' }}>
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-t-transparent rounded-full animate-spin"
            style={{ borderColor: 'rgba(124,58,237,0.25)', borderTopColor: '#7c3aed' }} />
          <p className="text-sm" style={{ color: '#94a3b8' }}>Loading…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full" style={{ background: "#f8fafc" }}>
      <NavigationProgress />
      {/* ══════════════ SIDEBAR ══════════════ */}
      <aside
        className="w-[216px] flex-shrink-0 flex flex-col relative overflow-hidden"
        style={{
          background: "#ffffff",
          borderRight: "1px solid #e2e8f0",
          boxShadow: "2px 0 12px rgba(0,0,0,0.04)",
        }}
      >
        {/* Subtle top violet glow */}
        <div
          className="absolute inset-x-0 top-0 h-40 pointer-events-none"
          style={{
            background:
              "radial-gradient(ellipse 140% 60% at 50% -10%, rgba(124,58,237,0.07) 0%, transparent 70%)",
          }}
        />

        {/* ── Brand ──────────────────────────────────────────── */}
        <div className="relative z-10 px-5 pt-6 pb-5">
          <Link href="/dashboard" className="flex items-center gap-3 group">
            {/* Logo */}
            <div className="relative w-8 h-8 flex-shrink-0">
              <div
                className="absolute inset-0 rounded-[10px] transition-all duration-300 group-hover:scale-110"
                style={{
                  background: "linear-gradient(135deg, #7c3aed, #22d3ee)",
                  opacity: 0.15,
                  filter: "blur(8px)",
                  transform: "scale(1.15)",
                }}
              />
              <div
                className="relative w-8 h-8 rounded-[10px] flex items-center justify-center transition-transform duration-300 group-hover:scale-105"
                style={{
                  background:
                    "linear-gradient(135deg, #7c3aed 0%, #22d3ee 100%)",
                  boxShadow: "0 2px 12px rgba(124,58,237,0.35)",
                }}
              >
                <TrendingUp className="w-4 h-4 text-white" strokeWidth={2.5} />
              </div>
            </div>

            <div>
              <p
                className="text-[13.5px] font-bold leading-none"
                style={{ color: "#0f172a" }}
              >
                Tender Trakr
              </p>
              <p className="text-[9px] font-bold tracking-[0.2em] mt-1 text-gradient-violet">
                GLASSWING
              </p>
            </div>
          </Link>
        </div>

        {/* Divider */}
        <div
          className="mx-5 mb-3 h-px"
          style={{
            background:
              "linear-gradient(90deg, transparent, rgba(124,58,237,0.15), transparent)",
          }}
        />

        {/* ── Nav ────────────────────────────────────────────── */}
        <nav className="flex-1 relative z-10 px-3 pb-3 space-y-0.5 overflow-y-auto">
          <p
            className="px-2 py-2 text-[9.5px] font-bold uppercase tracking-[0.25em]"
            style={{ color: "#94a3b8" }}
          >
            Platform
          </p>

          {NAV.map(({ href, label, icon: Icon }) => {
            const active =
              pathname === href ||
              (href !== "/dashboard" && pathname.startsWith(href + "/"));

            return (
              <Link key={href} href={href} className="block">
                <motion.div
                  className={cn(
                    "relative flex items-center gap-2.5 px-3 py-[9px] rounded-[10px]",
                    "text-[13px] font-medium select-none group cursor-pointer",
                  )}
                  style={{
                    color: active ? "#7c3aed" : "#64748b",
                    background: active
                      ? "rgba(124,58,237,0.07)"
                      : "transparent",
                  }}
                  whileHover={{ x: 1 }}
                  transition={{ duration: 0.12 }}
                  onMouseEnter={(e) => {
                    if (!active)
                      (e.currentTarget as HTMLDivElement).style.background =
                        "#f8fafc";
                    if (!active)
                      (e.currentTarget as HTMLDivElement).style.color =
                        "#334155";
                  }}
                  onMouseLeave={(e) => {
                    if (!active)
                      (e.currentTarget as HTMLDivElement).style.background =
                        "transparent";
                    if (!active)
                      (e.currentTarget as HTMLDivElement).style.color =
                        "#64748b";
                  }}
                >
                  {/* Active left accent */}
                  <AnimatePresence>
                    {active && (
                      <motion.div
                        layoutId="nav-accent"
                        className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] rounded-r-full"
                        style={{
                          height: 22,
                          background:
                            "linear-gradient(180deg, #7c3aed, #22d3ee)",
                          boxShadow: "0 0 10px rgba(124,58,237,0.5)",
                        }}
                        initial={{ opacity: 0, scaleY: 0.4 }}
                        animate={{ opacity: 1, scaleY: 1 }}
                        exit={{ opacity: 0, scaleY: 0.4 }}
                        transition={{
                          type: "spring",
                          bounce: 0.2,
                          duration: 0.35,
                        }}
                      />
                    )}
                  </AnimatePresence>

                  {/* Icon */}
                  <Icon
                    className="w-4 h-4 flex-shrink-0 transition-colors duration-150"
                    style={{ color: active ? "#7c3aed" : "#94a3b8" }}
                  />

                  {/* Label */}
                  <span className="flex-1 leading-none">{label}</span>

                  {/* Chevron hint */}
                  <ChevronRight
                    className="w-3.5 h-3.5 flex-shrink-0 opacity-0 group-hover:opacity-40 transition-opacity duration-150"
                    style={{ color: active ? "#7c3aed" : "#94a3b8" }}
                  />
                </motion.div>
              </Link>
            );
          })}
        </nav>

        {/* ── Footer status ──────────────────────────────────── */}
        <div
          className="relative z-10 mx-3.5 mb-4 rounded-xl px-3.5 py-3"
          style={{
            background: "#f8fafc",
            border: "1px solid #e2e8f0",
          }}
        >
          {session?.user ? (
            <>
              <div className="flex items-center gap-2 mb-1">
                <div className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 text-[10px] font-bold text-white"
                  style={{ background: 'linear-gradient(135deg, #7c3aed, #22d3ee)' }}>
                  {session.user.name?.[0]?.toUpperCase() || session.user.email?.[0]?.toUpperCase() || '?'}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[11px] font-semibold truncate" style={{ color: '#0f172a' }}>
                    {session.user.name || session.user.email}
                  </p>
                  <p className="text-[9.5px] capitalize" style={{ color: '#94a3b8' }}>
                    {session.user.role}
                  </p>
                </div>
              </div>
              <button
                onClick={() => router.push('/logout')}
                className="flex items-center gap-1.5 text-[10.5px] font-medium mt-1.5 transition-opacity hover:opacity-70"
                style={{ color: '#94a3b8' }}
              >
                <LogOut className="w-3 h-3" />
                Sign out
              </button>
            </>
          ) : (
            <>
              <div className="flex items-center gap-2 mb-0.5">
                <span className="w-1.5 h-1.5 rounded-full pulse-dot flex-shrink-0" style={{ background: "#22c55e" }} />
                <p className="text-[11px] font-semibold" style={{ color: "#64748b" }}>All systems online</p>
              </div>
              <p className="text-[10px]" style={{ color: "#94a3b8" }}>v1.0 · GWS Intelligence</p>
            </>
          )}
        </div>
      </aside>

      {/* ══════════════ MAIN ══════════════ */}
      <main
        className="flex-1 overflow-auto relative"
        style={{ background: "#f8fafc" }}
      >
        {/* Very subtle dot grid */}
        <div
          className="fixed pointer-events-none z-0 bg-dot-grid opacity-60"
          style={{ top: 0, bottom: 0, left: 216, right: 0 }}
        />

        <div className="relative z-10 min-h-full">{children}</div>
      </main>
    </div>
  );
}
