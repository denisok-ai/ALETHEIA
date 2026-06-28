'use client';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  if (error?.message?.includes('Failed to find Server Action')) {
    reset();
    return null;
  }

  return (
    <html lang="ru">
      <body>
        <div style={{ display: 'flex', minHeight: '100vh', alignItems: 'center', justifyContent: 'center', fontFamily: 'system-ui, sans-serif' }}>
          <div style={{ textAlign: 'center', padding: 32 }}>
            <h2 style={{ fontSize: 20, marginBottom: 12 }}>Что-то пошло не так</h2>
            <p style={{ color: '#666', marginBottom: 20 }}>Попробуйте обновить страницу</p>
            <button
              onClick={() => reset()}
              style={{ padding: '8px 24px', borderRadius: 8, border: '1px solid #ddd', cursor: 'pointer', background: '#fff' }}
            >
              Обновить
            </button>
          </div>
        </div>
      </body>
    </html>
  );
}
