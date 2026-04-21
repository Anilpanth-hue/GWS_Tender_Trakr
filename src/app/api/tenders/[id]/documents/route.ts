import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import type { ApiResponse, TenderDocument } from '@/types';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const rows = await query<Record<string, unknown>>(
      `SELECT id, tender_id, file_name, file_path, download_url, doc_type, file_size, created_at
       FROM tender_documents
       WHERE tender_id = ?
       ORDER BY created_at ASC`,
      [id]
    );

    const documents: TenderDocument[] = rows.map(r => ({
      id: r.id as number,
      tenderId: r.tender_id as number,
      fileName: r.file_name as string,
      filePath: r.file_path as string | null,
      downloadUrl: r.download_url as string | null,
      docType: r.doc_type as TenderDocument['docType'],
      fileSize: r.file_size as number | null,
      createdAt: String(r.created_at),
    }));

    return NextResponse.json<ApiResponse<TenderDocument[]>>({ data: documents });
  } catch (err) {
    console.error('[API /tenders/[id]/documents] Error:', err);
    return NextResponse.json<ApiResponse>(
      { error: (err as Error).message || 'Failed to fetch documents' },
      { status: 500 }
    );
  }
}
