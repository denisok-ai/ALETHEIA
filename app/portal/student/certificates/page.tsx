/**
 * Student: list of earned certificates.
 */
import { createClient } from '@/lib/supabase/server';

export default async function StudentCertificatesPage() {
  const supabase = createClient();
  const { data: { user } } = supabase ? await supabase.auth.getUser() : { data: { user: null } };

  if (!supabase || !user) {
    return (
      <div>
        <h1 className="font-heading text-2xl font-bold text-dark">Сертификаты</h1>
        <p className="mt-2 text-text-muted">Загрузка…</p>
      </div>
    );
  }

  const { data: certs } = await supabase
    .from('certificates')
    .select('id, cert_number, issued_at, pdf_url, courses(title)')
    .eq('user_id', user.id)
    .order('issued_at', { ascending: false });

  const list = certs ?? [];

  return (
    <div>
      <h1 className="font-heading text-2xl font-bold text-dark">Сертификаты</h1>
      <p className="mt-1 text-text-muted">Выданные сертификаты после прохождения курсов</p>

      {list.length === 0 ? (
        <p className="mt-6 text-text-muted">Пока нет сертификатов. Завершите курс на 100%, чтобы получить сертификат.</p>
      ) : (
        <ul className="mt-6 space-y-4">
          {list.map((c) => {
            const courseTitle = Array.isArray((c as { courses?: unknown }).courses)
              ? (c as { courses: { title?: string }[] }).courses[0]?.title
              : (c as { courses?: { title?: string } }).courses?.title;
            return (
              <li key={(c as { id: string }).id} className="flex items-center justify-between rounded-xl border border-border bg-white p-4">
                <div>
                  <p className="font-medium text-dark">{courseTitle ?? 'Курс'}</p>
                  <p className="text-sm text-text-muted">№ {(c as { cert_number: string }).cert_number}</p>
                  <time className="text-xs text-text-soft">{new Date((c as { issued_at: string }).issued_at).toLocaleDateString('ru')}</time>
                </div>
                <a
                  href={`/api/portal/certificates/${(c as { id: string }).id}/download`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="rounded-lg bg-primary px-3 py-2 text-sm font-medium text-white hover:bg-primary/90"
                >
                  Скачать PDF
                </a>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
