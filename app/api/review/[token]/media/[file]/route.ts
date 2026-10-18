/**
 * Отдача видео и постеров из каталога согласования.
 * Поддерживает Range: без 206 и Accept-Ranges видео на iPhone не запускается.
 * Файл читается потоком (fs.createReadStream), целиком в память не грузится.
 */
import fs from 'node:fs';
import { Readable } from 'node:stream';
import { NextResponse } from 'next/server';
import {
  getConfiguredReviewToken,
  isValidReviewToken,
  mediaContentType,
  mediaFilePath,
  parseByteRange,
  resolveReviewDir,
} from '@/lib/content-review';

export const dynamic = 'force-dynamic';

type Params = { params: Promise<{ token: string; file: string }> };

function notFound(): NextResponse {
  return new NextResponse(null, { status: 404, headers: { 'X-Robots-Tag': 'noindex' } });
}

export async function GET(request: Request, { params }: Params) {
  const { token, file } = await params;
  if (!isValidReviewToken(token, getConfiguredReviewToken())) return notFound();

  const filePath = mediaFilePath(resolveReviewDir(), file);
  if (!filePath) return notFound();

  let size: number;
  try {
    const stat = await fs.promises.stat(filePath);
    if (!stat.isFile()) return notFound();
    size = stat.size;
  } catch {
    return notFound();
  }

  const common: Record<string, string> = {
    'Content-Type': mediaContentType(file),
    'Accept-Ranges': 'bytes',
    'Cache-Control': 'private, max-age=3600',
    'X-Robots-Tag': 'noindex',
  };

  const range = parseByteRange(request.headers.get('range'), size);

  if (range.kind === 'unsatisfiable') {
    return new NextResponse(null, {
      status: 416,
      headers: { ...common, 'Content-Range': `bytes */${size}` },
    });
  }

  if (range.kind === 'full') {
    const body = Readable.toWeb(fs.createReadStream(filePath)) as unknown as ReadableStream;
    return new NextResponse(body, {
      status: 200,
      headers: { ...common, 'Content-Length': String(size) },
    });
  }

  const { start, end } = range;
  const body = Readable.toWeb(fs.createReadStream(filePath, { start, end })) as unknown as ReadableStream;
  return new NextResponse(body, {
    status: 206,
    headers: {
      ...common,
      'Content-Length': String(end - start + 1),
      'Content-Range': `bytes ${start}-${end}/${size}`,
    },
  });
}
