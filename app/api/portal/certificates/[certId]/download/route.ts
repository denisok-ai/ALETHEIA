/**
 * Download certificate PDF. User must own the certificate.
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { generateCertificatePdf } from '@/lib/certificates';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ certId: string }> }
) {
  const { certId } = await params;
  const supabase = createClient();
  if (!supabase) return NextResponse.json({ error: 'Unavailable' }, { status: 503 });

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: cert, error } = await supabase
    .from('certificates')
    .select('id, user_id, cert_number, issued_at, courses(title)')
    .eq('id', certId)
    .eq('user_id', user.id)
    .single();

  if (error || !cert) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const { data: profile } = await supabase.from('profiles').select('display_name').eq('id', user.id).single();
  const courseTitle =
    (cert as unknown as { courses?: { title?: string } | null }).courses?.title ?? 'Курс';
  const displayName =
    (profile as unknown as { display_name?: string | null })?.display_name ?? user.email ?? 'Слушатель';

  const buffer = await generateCertificatePdf({
    userName: displayName,
    courseName: courseTitle,
    certNumber: (cert as { cert_number: string }).cert_number,
    date: new Date((cert as { issued_at: string }).issued_at).toLocaleDateString('ru'),
  });

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="certificate-${(cert as { cert_number: string }).cert_number}.pdf"`,
    },
  });
}
