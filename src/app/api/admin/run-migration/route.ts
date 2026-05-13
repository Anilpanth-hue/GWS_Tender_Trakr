import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { query, execute } from '@/lib/db';

/**
 * POST /api/admin/run-migration
 * Idempotent — adds any missing columns to the tenders table.
 * Run once after each deploy that adds new DB columns.
 */
export async function POST() {
  const session = await getServerSession(authOptions);
  if (session?.user?.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    // ── tenders table columns ─────────────────────────────────────────────
    const existing = await query<{ COLUMN_NAME: string }>(
      `SELECT COLUMN_NAME FROM information_schema.COLUMNS
       WHERE TABLE_SCHEMA = DATABASE()
         AND TABLE_NAME = 'tenders'
         AND COLUMN_NAME IN (
           'owner_email', 'owner_assigned_at',
           'assigned_by_email', 'assigned_by_name',
           'tender_overview', 'l1_scope_of_work', 'l1_analysis_source',
           'bid_status', 'bid_status_updated_at', 'bid_status_updated_by',
           'bid_amount', 'bid_submitted_at',
           'rejected_reason', 'bid_evaluated_remark', 'bid_dropped_reason',
           'bid_participated_remark', 'award_remark',
           'l1_bidder', 'l1_price', 'l2_bidder', 'l2_price', 'l3_bidder', 'l3_price'
         )`
    );
    const has = new Set(existing.map(r => r.COLUMN_NAME));
    const added: string[] = [];

    const migrations: Array<[string, string]> = [
      ['owner_email',        'ALTER TABLE tenders ADD COLUMN owner_email VARCHAR(255) NULL'],
      ['owner_assigned_at',  'ALTER TABLE tenders ADD COLUMN owner_assigned_at TIMESTAMP NULL'],
      ['assigned_by_email',  'ALTER TABLE tenders ADD COLUMN assigned_by_email VARCHAR(255) NULL'],
      ['assigned_by_name',   'ALTER TABLE tenders ADD COLUMN assigned_by_name VARCHAR(255) NULL'],
      ['tender_overview',    'ALTER TABLE tenders ADD COLUMN tender_overview JSON NULL'],
      ['l1_scope_of_work',   'ALTER TABLE tenders ADD COLUMN l1_scope_of_work TEXT NULL'],
      ['l1_analysis_source', "ALTER TABLE tenders ADD COLUMN l1_analysis_source ENUM('documents','metadata_only') NOT NULL DEFAULT 'metadata_only'"],
      ['bid_status',            "ALTER TABLE tenders ADD COLUMN bid_status ENUM('assigned','rejected','bid_evaluated','bid_dropped','bid_participated','tender_awarded','not_awarded') NULL"],
      ['bid_status_updated_at', 'ALTER TABLE tenders ADD COLUMN bid_status_updated_at TIMESTAMP NULL'],
      ['bid_status_updated_by', 'ALTER TABLE tenders ADD COLUMN bid_status_updated_by VARCHAR(255) NULL'],
      ['bid_amount',            'ALTER TABLE tenders ADD COLUMN bid_amount VARCHAR(100) NULL'],
      ['bid_submitted_at',      'ALTER TABLE tenders ADD COLUMN bid_submitted_at TIMESTAMP NULL'],
      ['rejected_reason',       'ALTER TABLE tenders ADD COLUMN rejected_reason TEXT NULL'],
      ['bid_evaluated_remark',  'ALTER TABLE tenders ADD COLUMN bid_evaluated_remark TEXT NULL'],
      ['bid_dropped_reason',       'ALTER TABLE tenders ADD COLUMN bid_dropped_reason TEXT NULL'],
      ['bid_participated_remark',  'ALTER TABLE tenders ADD COLUMN bid_participated_remark TEXT NULL'],
      ['award_remark',             'ALTER TABLE tenders ADD COLUMN award_remark TEXT NULL'],
      ['l1_bidder',                'ALTER TABLE tenders ADD COLUMN l1_bidder VARCHAR(500) NULL'],
      ['l1_price',                 'ALTER TABLE tenders ADD COLUMN l1_price VARCHAR(100) NULL'],
      ['l2_bidder',                'ALTER TABLE tenders ADD COLUMN l2_bidder VARCHAR(500) NULL'],
      ['l2_price',                 'ALTER TABLE tenders ADD COLUMN l2_price VARCHAR(100) NULL'],
      ['l3_bidder',                'ALTER TABLE tenders ADD COLUMN l3_bidder VARCHAR(500) NULL'],
      ['l3_price',                 'ALTER TABLE tenders ADD COLUMN l3_price VARCHAR(100) NULL'],
    ];

    // ── users table columns ───────────────────────────────────────────────
    const existingUsers = await query<{ COLUMN_NAME: string }>(
      `SELECT COLUMN_NAME FROM information_schema.COLUMNS
       WHERE TABLE_SCHEMA = DATABASE()
         AND TABLE_NAME = 'users'
         AND COLUMN_NAME IN ('last_login')`
    );
    const hasUsers = new Set(existingUsers.map(r => r.COLUMN_NAME));
    if (!hasUsers.has('last_login')) {
      await execute('ALTER TABLE users ADD COLUMN last_login TIMESTAMP NULL');
      added.push('users.last_login');
    }

    // ── Seed admin accounts ───────────────────────────────────────────────
    await execute(
      `INSERT INTO users (name, email, role) VALUES ('Anil Panth', 'anil.panth@glasswing.in', 'admin'),
       ('Rajeev Siddhu', 'rajeev.siddhu@glasswing.in', 'admin')
       ON DUPLICATE KEY UPDATE role = 'admin'`
    );

    for (const [col, sql] of migrations) {
      if (!has.has(col)) {
        await execute(sql);
        added.push(col);
      }
    }

    return NextResponse.json({
      message: added.length
        ? `Migration complete. Added: ${added.join(', ')}`
        : 'Nothing to do — all columns already exist.',
      added,
    });
  } catch (err) {
    console.error('[Migration]', err);
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
