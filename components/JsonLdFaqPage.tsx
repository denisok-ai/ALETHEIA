/**
 * Schema.org FAQPage — даёт аккордеон-сниппет в выдаче Яндекса/Google.
 * Использовать один раз на страницу (иначе дубли Question).
 */
import { jsonLdString } from '@/lib/json-ld';

export function JsonLdFaqPage({ items }: { items: { q: string; a: string }[] }) {
  if (items.length === 0) return null;
  const data = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: items.map((it) => ({
      '@type': 'Question',
      name: it.q,
      acceptedAnswer: { '@type': 'Answer', text: it.a },
    })),
  };
  return (
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdString(data) }} />
  );
}
