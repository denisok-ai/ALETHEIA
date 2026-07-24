import Script from 'next/script';

/**
 * Яндекс.Метрика (счётчик 108390990) — грузится для всех посетителей.
 *
 * История, чтобы не повторить: с 08.06.2026 счётчик грузился только после
 * кнопки «Принять аналитику» и считал долю посетителей, а с 10.07.2026 CSP
 * молча заблокировала его полностью — весь июль в отчётах были нули при
 * живом трафике. 24.07 владелец решил убрать барьер согласия: баннер cookie
 * остался информационным (см. CookieConsentBanner), а Метрика подключается
 * безусловно, как на подавляющем большинстве российских сайтов.
 *
 * ID переопределяется через NEXT_PUBLIC_YANDEX_METRIKA_ID. В dev не грузится.
 */
export function YandexMetrika() {
  if (process.env.NODE_ENV !== 'production') return null;

  const id = (process.env.NEXT_PUBLIC_YANDEX_METRIKA_ID || '108390990').trim();
  if (!/^\d+$/.test(id)) return null;

  const inline = `
(function(m,e,t,r,i,k,a){
  m[i]=m[i]||function(){(m[i].a=m[i].a||[]).push(arguments)};
  m[i].l=1*new Date();
  for (var j = 0; j < document.scripts.length; j++) {if (document.scripts[j].src === r) { return; }}
  k=e.createElement(t),a=e.getElementsByTagName(t)[0],k.async=1,k.src=r,a.parentNode.insertBefore(k,a)
})(window, document,'script','https://mc.yandex.ru/metrika/tag.js?id=${id}', 'ym');

ym(${id}, 'init', {ssr:true, webvisor:true, clickmap:true, ecommerce:"dataLayer", accurateTrackBounce:true, trackLinks:true});
`.trim();

  return (
    <>
      <Script id="yandex-metrika" strategy="afterInteractive">
        {inline}
      </Script>
      <noscript>
        <div>
          {/* eslint-disable-next-line @next/next/no-img-element -- пиксель Метрики в noscript */}
          <img
            src={`https://mc.yandex.ru/watch/${id}`}
            style={{ position: 'absolute', left: '-9999px' }}
            alt=""
          />
        </div>
      </noscript>
    </>
  );
}
