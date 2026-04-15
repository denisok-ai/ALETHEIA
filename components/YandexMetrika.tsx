import Script from 'next/script';

/**
 * Яндекс.Метрика — глобально на всех страницах (корневой layout).
 * ID по умолчанию из задачи; переопределение: `NEXT_PUBLIC_YANDEX_METRIKA_ID`.
 * В `next dev` не грузится (как GA/Clarity), на production-сборке — да.
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

ym(${id}, 'init', {ssr:true, webvisor:true, clickmap:true, ecommerce:"dataLayer", referrer: document.referrer, url: location.href, accurateTrackBounce:true, trackLinks:true});
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
