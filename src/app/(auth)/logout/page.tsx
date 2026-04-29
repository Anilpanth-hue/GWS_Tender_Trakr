'use client';

import { useEffect } from 'react';
import { signOut } from 'next-auth/react';
import { TrendingUp } from 'lucide-react';

export default function LogoutPage() {
  useEffect(() => {
    // Clear local/session storage
    try { localStorage.clear(); } catch { /* ignore */ }
    try { sessionStorage.clear(); } catch { /* ignore */ }

    // Clear all cookies
    document.cookie.split(';').forEach(c => {
      document.cookie = c.replace(/^ +/, '').replace(/=.*/, '=;expires=' + new Date().toUTCString() + ';path=/');
    });

    signOut({ callbackUrl: '/login' });
  }, []);

  return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: '#f8fafc' }}>
      <div className="flex flex-col items-center gap-5">
        <div className="relative w-14 h-14">
          <div className="absolute inset-0 rounded-2xl"
            style={{
              background: 'linear-gradient(135deg, rgba(124,58,237,0.15), rgba(34,211,238,0.15))',
              filter: 'blur(12px)',
              transform: 'scale(1.3)',
            }} />
          <div className="relative w-14 h-14 rounded-2xl flex items-center justify-center"
            style={{ background: 'linear-gradient(135deg, #7c3aed, #22d3ee)' }}>
            <TrendingUp className="w-7 h-7 text-white" strokeWidth={2.5} />
          </div>
        </div>
        <div className="w-7 h-7 border-2 border-t-transparent rounded-full animate-spin"
          style={{ borderColor: 'rgba(124,58,237,0.3)', borderTopColor: 'transparent' }} />
        <p className="text-sm font-medium" style={{ color: '#64748b' }}>Signing you out…</p>
      </div>
    </div>
  );
}
