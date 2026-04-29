/**
 * Migration: fix tender_documents table so multiple documents per tender can be stored.
 *
 * Changes:
 *  1. Drop the UNIQUE KEY (tender_id, doc_type) — it blocked saving more than one doc per type
 *  2. Expand doc_type from a 3-value ENUM to VARCHAR(50) so we can store 'individual_doc', etc.
 *
 * Run with:  npx tsx scripts/migrate-docs.ts
 */
import mysql from 'mysql2/promise';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

async function run() {
  const conn = await mysql.createConnection({
    host:     process.env.DB_HOST     || '127.0.0.1',
    port:     Number(process.env.DB_PORT) || 3306,
    user:     process.env.DB_USER     || 'root',
    password: process.env.DB_PASSWORD || 'rootpassword',
    database: process.env.DB_DATABASE || 'tender_trakr',
    multipleStatements: true,
  });

  try {
    console.log('Running tender_documents migration…');

    // 1. Drop the unique key that prevents multiple documents per type
    await conn.query(`ALTER TABLE tender_documents DROP INDEX uq_tender_doctype`).catch(() => {
      console.log('  uq_tender_doctype index not found or already dropped — skipping');
    });
    console.log('  ✓ Dropped uq_tender_doctype unique index');

    // 2. Change doc_type from ENUM to VARCHAR so new types ('individual_doc') can be stored
    await conn.query(`
      ALTER TABLE tender_documents
        MODIFY COLUMN doc_type VARCHAR(50) NOT NULL DEFAULT 'other'
    `).catch(err => {
      console.log('  doc_type column already VARCHAR or error:', (err as Error).message);
    });
    console.log('  ✓ doc_type column is now VARCHAR(50)');

    console.log('Migration complete. tender_documents can now store multiple documents per tender.');
  } catch (err) {
    console.error('Migration failed:', err);
    process.exit(1);
  } finally {
    await conn.end();
  }
}

run();
