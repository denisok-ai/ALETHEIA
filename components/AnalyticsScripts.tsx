/**
 * Microsoft Clarity (после интерактива). Google Analytics — см. GoogleTagInHead в layout <head>.
 */
import Script from 'next/script';
import { getAnalyticsConfig } from '@/lib/site-analytics';

export function AnalyticsScripts() {
  const { enabled, clarityProjectId } = getAnalyticsConfig();
  if (!enabled) return null;

  return (
    <Script id="microsoft-clarity" strategy="afterInteractive">
      {`
(function(c,l,a,r,i,t,y){
  c[a]=c[a]||function(){(c[a].q=c[a].q||[]).push(arguments)};
  t=l.createElement(r);t.async=1;t.src="https://www.clarity.ms/tag/"+i;
  y=l.getElementsByTagName(r)[0];y.parentNode.insertBefore(t,y);
})(window, document, "clarity", "script", "${clarityProjectId}");
      `.trim()}
    </Script>
  );
}
