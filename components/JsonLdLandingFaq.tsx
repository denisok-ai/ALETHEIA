import { buildLandingFaqPageJsonLd } from '@/lib/landing-faq';
import { jsonLdString } from '@/lib/json-ld';

export function JsonLdLandingFaq() {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: jsonLdString(buildLandingFaqPageJsonLd()) }}
    />
  );
}
