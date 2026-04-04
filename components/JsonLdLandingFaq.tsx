import { buildLandingFaqPageJsonLd } from '@/lib/landing-faq';

export function JsonLdLandingFaq() {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(buildLandingFaqPageJsonLd()) }}
    />
  );
}
