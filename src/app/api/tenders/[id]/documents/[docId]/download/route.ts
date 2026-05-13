import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { queryOne } from '@/lib/db';
import { createReadStream, existsSync, statSync } from 'fs';
import { join, basename } from 'path';
import { Readable } from 'stream';

/**
 * GET /api/tenders/[id]/documents/[docId]/download
 * Streams the document file from disk, handling filenames with spaces/special chars safely.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; docId: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id, docId } = await params;

  const doc = await queryOne<{ file_path: string | null; file_name: string }>(
    'SELECT file_path, file_name FROM tender_documents WHERE id = ? AND tender_id = ?',
    [docId, id]
  );

  if (!doc) {
    return NextResponse.json({ error: 'Document not found' }, { status: 404 });
  }

  if (!doc.file_path) {
    return NextResponse.json({ error: 'File not yet downloaded' }, { status: 404 });
  }

  // Resolve absolute path — file_path may be:
  //   a) /documents/100/filename.zip  (correct public-relative path)
  //   b) /opt/apps/.../public/documents/100/filename.zip  (absolute, from Windows path bug)
  //   c) C:\...\public\documents\100\filename.zip  (Windows absolute, shouldn't reach server)
  let absolutePath: string;
  if (doc.file_path.startsWith('/documents/') || doc.file_path.startsWith('\\documents\\')) {
    // Correct relative path — resolve from cwd/public
    const normalized = doc.file_path.replace(/\\/g, '/');
    absolutePath = join(process.cwd(), 'public', normalized);
  } else {
    // Already absolute (or malformed) — use as-is, but sanitize to prevent traversal
    absolutePath = doc.file_path.replace(/\\/g, '/');
    const publicDir = join(process.cwd(), 'public');
    if (!absolutePath.startsWith(publicDir) && !absolutePath.includes('/public/documents/')) {
      return NextResponse.json({ error: 'Invalid file path' }, { status: 400 });
    }
    // If it's an absolute path containing /public/documents/, normalize to actual public dir
    const pubIdx = absolutePath.indexOf('/public/documents/');
    if (pubIdx !== -1) {
      absolutePath = join(process.cwd(), 'public', absolutePath.slice(pubIdx + '/public'.length));
    }
  }

  if (!existsSync(absolutePath)) {
    return NextResponse.json({ error: 'File not found on server' }, { status: 404 });
  }

  const stat = statSync(absolutePath);
  const fileName = doc.file_name || basename(absolutePath);
  const ext = fileName.split('.').pop()?.toLowerCase() ?? '';
  const contentType =
    ext === 'pdf' ? 'application/pdf' :
    ext === 'zip' ? 'application/zip' :
    ext === 'doc' ? 'application/msword' :
    ext === 'docx' ? 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' :
    ext === 'xls' ? 'application/vnd.ms-excel' :
    ext === 'xlsx' ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' :
    'application/octet-stream';

  const stream = createReadStream(absolutePath);
  const nodeReadable = Readable.from(stream);
  // @ts-expect-error — Node stream → Web ReadableStream conversion
  const webStream = nodeReadable.toWeb ? nodeReadable.toWeb() : ReadableStream.from(nodeReadable);

  return new NextResponse(webStream, {
    status: 200,
    headers: {
      'Content-Type': contentType,
      'Content-Length': String(stat.size),
      'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(fileName)}`,
      'Cache-Control': 'private, no-cache',
    },
  });
}
