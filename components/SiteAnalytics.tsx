import Script from 'next/script';
import { getAnalyticsConfig } from '@/lib/site-analytics';

/**
 * Google Analytics 4 + Microsoft Clarity — «иностранные» счётчики.
 *
 * Подключены по решению владельца от 12.08.2026 (риск по 152-ФЗ принят явно).
 * Грузятся только в production и только если заданы ID:
 *   NEXT_PUBLIC_GA_MEASUREMENT_ID  (формат G-XXXXXXXXXX)
 *   NEXT_PUBLIC_CLARITY_PROJECT_ID (короткий буквенно-цифровой)
 * Пустой ID → счётчик не рендерится (безопасно катить код до появления ID).
 *
 * ВАЖНО (грабли, уже убивавшие Яндекс.Метрику): домены скриптов должны быть в
 * CSP script-src (next.config.mjs) — googletagmanager.com и clarity.ms. img-src
 * и connect-src уже разрешают любой https, так что пиксели и биконы проходят.
 */
export function SiteAnalytics() {
  if (process.env.NODE_ENV !== 'production') return null;

  const { gaMeasurementId, clarityProjectId } = getAnalyticsConfig();
  const ga = /^G-[A-Z0-9]+$/i.test(gaMeasurementId) ? gaMeasurementId : '';
  const clarity = /^[a-z0-9]+$/i.test(clarityProjectId) ? clarityProjectId : '';

  if (!ga && !clarity) return null;

  return (
    <>
      {ga ? (
        <>
          <Script
            id="ga-src"
            src={`https://www.googletagmanager.com/gtag/js?id=${ga}`}
            strategy="afterInteractive"
          />
          <Script id="ga-init" strategy="afterInteractive">
            {`window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config','${ga}');`}
          </Script>
        </>
      ) : null}

      {clarity ? (
        <Script id="clarity-init" strategy="afterInteractive">
          {`(function(c,l,a,r,i,t,y){c[a]=c[a]||function(){(c[a].q=c[a].q||[]).push(arguments)};t=l.createElement(r);t.async=1;t.src="https://www.clarity.ms/tag/"+i;y=l.getElementsByTagName(r)[0];y.parentNode.insertBefore(t,y);})(window,document,"clarity","script","${clarity}");`}
        </Script>
      ) : null}
    </>
  );
}
