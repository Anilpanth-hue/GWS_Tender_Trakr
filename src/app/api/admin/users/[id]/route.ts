import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { execute, queryOne } from '@/lib/db';
import type { ApiResponse } from '@/types';

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (session?.user?.role !== 'admin') {
    return NextResponse.json<ApiResponse>({ error: 'Forbidden' }, { status: 403 });
  }

  const { id } = await params;
  const body = await req.json() as { role?: string };
  const role = body.role;

  if (!role || !['admin', 'manager', 'viewer'].includes(role)) {
    return NextResponse.json<ApiResponse>({ error: 'Invalid role' }, { status: 400 });
  }

  // Prevent admins from demoting themselves
  const target = await queryOne<{ email: string }>('SELECT email FROM users WHERE id = ?', [id]);
  if (!target) {
    return NextResponse.json<ApiResponse>({ error: 'User not found' }, { status: 404 });
  }
  if (target.email === session.user.email && role !== 'admin') {
    return NextResponse.json<ApiResponse>({ error: 'You cannot change your own role' }, { status: 400 });
  }

  await execute('UPDATE users SET role = ?, updated_at = NOW() WHERE id = ?', [role, id]);
  return NextResponse.json<ApiResponse>({ message: `Role updated to ${role}` });
}