import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { query } from '@/lib/db';
import type { ApiResponse } from '@/types';

export interface AdminUser {
  id: number;
  name: string;
  email: string;
  role: 'admin' | 'manager' | 'viewer';
  lastLogin: string | null;
  createdAt: string;
}

export async function GET() {
  const session = await getServerSession(authOptions);
  if (session?.user?.role !== 'admin') {
    return NextResponse.json<ApiResponse>({ error: 'Forbidden' }, { status: 403 });
  }

  const rows = await query<Record<string, unknown>>(
    `SELECT id, name, email, role, last_login, created_at FROM users ORDER BY created_at ASC`
  );

  const users: AdminUser[] = rows.map(r => ({
    id: r.id as number,
    name: r.name as string,
    email: r.email as string,
    role: r.role as AdminUser['role'],
    lastLogin: (r.last_login as string) || null,
    createdAt: r.created_at as string,
  }));

  return NextResponse.json<ApiResponse<AdminUser[]>>({ data: users });
}