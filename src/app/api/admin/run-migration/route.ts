import { NextResponse } from 'next/server';
import { query, execute } from '@/lib/db';

/**
 * POST /api/admin/run-migration
 * Idempotent — adds any missing columns to the tenders table.
 * Run once after each deploy that adds new DB columns.
 */
export async function POST() {
  try {
    const existing = await query<{ COLUMN_NAME: string }>(
      `SELECT COLUMN_NAME FROM information_schema.COLUMNS
       WHERE TABLE_SCHEMA = DATABASE()
         AND TABLE_NAME = 'tenders'
         AND COLUMN_NAME IN (
           'owner_email', 'owner_assigned_at',
           'tender_overview', 'l1_scope_of_work', 'l1_analysis_source'
         )`
    );
    const has = new Set(existing.map(r => r.COLUMN_NAME));
    const added: string[] = [];

    const migrations: Array<[string, string]> = [
      ['owner_email',        'ALTER TABLE tenders ADD COLUMN owner_email VARCHAR(255) NULL'],
      ['owner_assigned_at',  'ALTER TABLE tenders ADD COLUMN owner_assigned_at TIMESTAMP NULL'],
      ['tender_overview',    'ALTER TABLE tenders ADD COLUMN tender_overview JSON NULL'],
      ['l1_scope_of_work',   'ALTER TABLE tenders ADD COLUMN l1_scope_of_work TEXT NULL'],
      ['l1_analysis_source', "ALTER TABLE tenders ADD COLUMN l1_analysis_source ENUM('documents','metadata_only') NOT NULL DEFAULT 'metadata_only'"],
    ];

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
