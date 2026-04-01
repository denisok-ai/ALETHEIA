/**
 * GA4 (gtag.js) прямо в <head> — строки googletagmanager.com и G-XXXXXXXX видны в «Просмотр кода»
 * и в проверках Google (Search Console, Tag Assistant), в отличие от части вариантов next/script.
 */
export function GoogleTagInHead() {
  if (process.env.NODE_ENV !== 'production') return null;

  const raw = (process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID || 'G-7CQ48S3CFF').trim();
  if (!/^G-[A-Z0-9]+$/i.test(raw)) return null;
  const gaId = raw.replace(/^g-/i, 'G-');

  return (
    <>
      {/* Google tag (gtag.js) */}
      <script async src={`https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(gaId)}`} />
      <script
        dangerouslySetInnerHTML={{
          __html: `window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config','${gaId}');`,
        }}
      />
    </>
  );
}
