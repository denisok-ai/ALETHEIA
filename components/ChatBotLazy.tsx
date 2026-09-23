'use client';

import dynamic from 'next/dynamic';

/**
 * Чат-бот только на клиенте. Next 16 запрещает `ssr: false` в серверных
 * компонентах, поэтому ленивая загрузка живёт в этой клиентской обёртке,
 * а корневой layout рендерит её как обычный компонент.
 */
export const ChatBotLazy = dynamic(() => import('@/components/ChatBot').then((m) => ({ default: m.ChatBot })), {
  ssr: false,
});
