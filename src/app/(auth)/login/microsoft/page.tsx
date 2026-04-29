'use client';

import { useEffect } from 'react';
import { signIn, useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { TrendingUp } from 'lucide-react';
import Link from 'next/link';

export default function MicrosoftLoginPage() {
  const { status, data: session } = useSession();
  const router = useRouter();

  useEffect(() => {
    const params = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : null;
    const returnUrl = params?.get('returnUrl') || '/dashboard';

    if (status === 'authenticated' && session?.user && !session?.error) {
      router.replace(returnUrl);
    } else if (status === 'unauthenticated') {
      signIn('azure-ad', { callbackUrl: returnUrl });
    }
  }, [status, session, router]);

  if (status === 'authenticated' && session?.error) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4" style={{ background: '#f8fafc' }}>
        <div className="max-w-sm w-full rounded-2xl p-8 text-center"
          style={{ background: '#ffffff', border: '1px solid #e2e8f0', boxShadow: '0 8px 40px rgba(0,0,0,0.08)' }}>
          <div className="w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-4"
            style={{ background: 'rgba(239,68,68,0.1)' }}>
            <span className="text-2xl">⚠️</span>
          </div>
          <h2 className="text-lg font-semibold mb-2" style={{ color: '#0f172a' }}>Authentication Error</h2>
          <p className="text-sm mb-6" style={{ color: '#64748b' }}>{session.error}</p>
          <div className="flex flex-col gap-2">
            <button
              onClick={() => signIn('azure-ad')}
              className="w-full py-2.5 rounded-xl text-sm font-semibold text-white transition-all hover:-translate-y-0.5"
              style={{ background: '#0078d4' }}
            >
              Try Again
            </button>
            <Link href="/login"
              className="w-full py-2.5 rounded-xl text-sm font-semibold text-center transition-all hover:bg-slate-50"
              style={{ color: '#475569', border: '1px solid #e2e8f0' }}>
              Back to Login
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: '#f8fafc' }}>
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.4 }}
        className="flex flex-col items-center gap-6"
      >
        {/* Animated logo */}
        <motion.div
          animate={{ scale: [1, 1.05, 1] }}
          transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
          className="relative w-16 h-16"
        >
          <div className="absolute inset-0 rounded-2xl"
            style={{
              background: 'linear-gradient(135deg, rgba(124,58,237,0.2), rgba(34,211,238,0.2))',
              filter: 'blur(12px)',
              transform: 'scale(1.3)',
            }} />
          <div className="relative w-16 h-16 rounded-2xl flex items-center justify-center"
            style={{
              background: 'linear-gradient(135deg, #7c3aed, #22d3ee)',
              boxShadow: '0 4px 24px rgba(124,58,237,0.4)',
            }}>
            <TrendingUp className="w-8 h-8 text-white" strokeWidth={2.5} />
          </div>
        </motion.div>

        {/* Spinner */}
        <div className="w-8 h-8 border-2 border-t-transparent rounded-full animate-spin"
          style={{ borderColor: 'rgba(124,58,237,0.3)', borderTopColor: 'transparent' }} />

        <div className="text-center">
          <p className="text-base font-semibold" style={{ color: '#0f172a' }}>
            Redirecting to Microsoft…
          </p>
          <p className="text-sm mt-1" style={{ color: '#94a3b8' }}>
            Please wait while we connect to your account
          </p>
        </div>
      </motion.div>
    </div>
  );
}
