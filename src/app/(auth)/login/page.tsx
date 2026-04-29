'use client';

import { Suspense, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { TrendingUp, AlertCircle } from 'lucide-react';

const ERROR_MESSAGES: Record<string, string> = {
  CredentialsSignin:   'Invalid credentials.',
  AccessDenied:        'Access denied. Only @glasswing.in accounts are allowed.',
  OAuthAccountNotLinked: 'Account already linked to another provider.',
  InternalServerError: 'Internal server error. Please try again.',
  Callback:            'Authentication callback failed. Please try again.',
};

function LoginContent() {
  const { status, data: session } = useSession();
  const router  = useRouter();
  const params  = useSearchParams();
  const error   = params?.get('error') || '';
  const returnUrl = params?.get('returnUrl') || '/dashboard';

  useEffect(() => {
    if (status === 'authenticated' && session?.user && !session?.error) {
      router.replace(returnUrl);
    }
  }, [status, session, router, returnUrl]);

  if (status === 'loading') {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-sm" style={{ color: '#64748b' }}>Checking session…</p>
        </div>
      </div>
    );
  }

  const errMsg = error ? (ERROR_MESSAGES[error] || decodeURIComponent(error)) : '';

  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ background: '#f8fafc' }}>
      {/* Background grid */}
      <div className="fixed inset-0 pointer-events-none opacity-40 bg-dot-grid" />

      {/* Ambient glows */}
      <div className="fixed top-1/4 left-1/3 w-[400px] h-[400px] rounded-full pointer-events-none"
        style={{ background: 'radial-gradient(circle, rgba(124,58,237,0.06) 0%, transparent 70%)' }} />
      <div className="fixed bottom-1/4 right-1/4 w-[300px] h-[300px] rounded-full pointer-events-none"
        style={{ background: 'radial-gradient(circle, rgba(34,211,238,0.06) 0%, transparent 70%)' }} />

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
        className="relative z-10 w-full max-w-[400px]"
      >
        {/* Logo */}
        <div className="flex flex-col items-center mb-8">
          <div className="relative w-14 h-14 mb-4">
            <div className="absolute inset-0 rounded-2xl"
              style={{
                background: 'linear-gradient(135deg, rgba(124,58,237,0.15), rgba(34,211,238,0.15))',
                filter: 'blur(12px)',
                transform: 'scale(1.2)',
              }} />
            <div className="relative w-14 h-14 rounded-2xl flex items-center justify-center"
              style={{
                background: 'linear-gradient(135deg, #7c3aed, #22d3ee)',
                boxShadow: '0 4px 24px rgba(124,58,237,0.4)',
              }}>
              <TrendingUp className="w-7 h-7 text-white" strokeWidth={2.5} />
            </div>
          </div>
          <h1 className="text-2xl font-bold" style={{ color: '#0f172a' }}>Tender Trakr</h1>
          <p className="text-sm mt-1" style={{ color: '#64748b' }}>by Glasswing Solutions</p>
        </div>

        {/* Card */}
        <div className="rounded-2xl p-8"
          style={{
            background: '#ffffff',
            border: '1px solid #e2e8f0',
            boxShadow: '0 8px 40px rgba(0,0,0,0.08)',
          }}>
          <h2 className="text-xl font-semibold mb-1" style={{ color: '#0f172a' }}>Welcome back</h2>
          <p className="text-sm mb-6" style={{ color: '#64748b' }}>
            Sign in with your Glasswing Microsoft account to access the platform.
          </p>

          {errMsg && (
            <motion.div
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex items-start gap-2.5 rounded-xl p-3.5 mb-5"
              style={{ background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.18)' }}
            >
              <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" style={{ color: '#dc2626' }} />
              <p className="text-sm" style={{ color: '#dc2626' }}>{errMsg}</p>
            </motion.div>
          )}

          {/* Microsoft Sign In Button */}
          <Link
            href={`/login/microsoft?returnUrl=${encodeURIComponent(returnUrl)}`}
            className="flex items-center justify-center gap-3 w-full px-5 py-3.5 rounded-xl font-semibold text-sm transition-all duration-200 hover:shadow-lg hover:-translate-y-0.5 active:translate-y-0"
            style={{
              background: '#0078d4',
              color: '#ffffff',
              boxShadow: '0 2px 12px rgba(0,120,212,0.3)',
            }}
          >
            {/* Microsoft Logo SVG */}
            <svg width="18" height="18" viewBox="0 0 21 21" fill="none" xmlns="http://www.w3.org/2000/svg">
              <rect x="1"  y="1"  width="9" height="9" fill="#F25022"/>
              <rect x="11" y="1"  width="9" height="9" fill="#7FBA00"/>
              <rect x="1"  y="11" width="9" height="9" fill="#00A4EF"/>
              <rect x="11" y="11" width="9" height="9" fill="#FFB900"/>
            </svg>
            Sign in with Microsoft
          </Link>

          <p className="text-xs text-center mt-4" style={{ color: '#94a3b8' }}>
            Only <strong style={{ color: '#64748b' }}>@glasswing.in</strong> accounts are permitted
          </p>
        </div>

        {/* Footer */}
        <p className="text-center text-xs mt-6" style={{ color: '#94a3b8' }}>
          GWS Tender Trakr · Internal Platform · v1.0
        </p>
      </motion.div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center min-h-screen">
        <div className="w-10 h-10 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" />
      </div>
    }>
      <LoginContent />
    </Suspense>
  );
}
