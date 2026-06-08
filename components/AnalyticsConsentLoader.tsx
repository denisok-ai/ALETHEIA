'use client';

/**
 * Яндекс.Метрика только после согласия analytics в CookieConsentBanner (localStorage).
 * Без webvisor — снижает чувствительность записи поведения.
 */
import { useEffect, useState } from 'react';
import Script from 'next/script';
import { COOKIE_CONSENT_EVENT, COOKIE_CONSENT_STORAGE_KEY } from '@/lib/cookie-consent';

function readConsent(): 'none' | 'analytics' {
  try {
    const v = localStorage.getItem(COOKIE_CONSENT_STORAGE_KEY);
    return v === 'analytics' ? 'analytics' : 'none';
  } catch {
    return 'none';
  }
}

export function AnalyticsConsentLoader() {
  const [load, setLoad] = useState(false);

  useEffect(() => {
    const sync = () => setLoad(readConsent() === 'analytics');
    sync();
    const onCustom = () => sync();
    const onStorage = (e: StorageEvent) => {
      if (e.key === COOKIE_CONSENT_STORAGE_KEY || e.key === null) sync();
    };
    window.addEventListener(COOKIE_CONSENT_EVENT, onCustom);
    window.addEventListener('storage', onStorage);
    return () => {
      window.removeEventListener(COOKIE_CONSENT_EVENT, onCustom);
      window.removeEventListener('storage', onStorage);
    };
  }, []);

  if (process.env.NODE_ENV !== 'production' || !load) return null;

  const id = (process.env.NEXT_PUBLIC_YANDEX_METRIKA_ID || '108390990').trim();
  if (!/^\d+$/.test(id)) return null;

  const inline = `
(function(m,e,t,r,i,k,a){
  m[i]=m[i]||function(){(m[i].a=m[i].a||[]).push(arguments)};
  m[i].l=1*new Date();
  for (var j = 0; j < document.scripts.length; j++) {if (document.scripts[j].src === r) { return; }}
  k=e.createElement(t),a=e.getElementsByTagName(t)[0],k.async=1,k.src=r,a.parentNode.insertBefore(k,a)
})(window, document,'script','https://mc.yandex.ru/metrika/tag.js?id=${id}', 'ym');

ym(${id}, 'init', {ssr:true, webvisor:false, clickmap:true, ecommerce:"dataLayer", accurateTrackBounce:true, trackLinks:true});
`.trim();

  return <Script id="yandex-metrika-consent" strategy="afterInteractive">{inline}</Script>;
}
