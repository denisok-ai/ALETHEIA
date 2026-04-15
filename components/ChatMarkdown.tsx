'use client';

import type { ReactNode } from 'react';
import ReactMarkdown from 'react-markdown';
import { linkifyBareUrlsForMarkdown } from '@/lib/linkify-bare-urls';

type Props = {
  children: string;
};

/**
 * Markdown для ответов чат-ботов: «голые» https://… превращаются в кликабельные ссылки.
 * Внешние ссылки открываются в новой вкладке.
 */
export function ChatMarkdown({ children }: Props): ReactNode {
  const md = linkifyBareUrlsForMarkdown(children);
  return (
    <ReactMarkdown
      components={{
        a: ({ href, children: linkChildren, ...rest }) => {
          const external =
            typeof href === 'string' &&
            (href.startsWith('http://') || href.startsWith('https://'));
          return (
            <a
              href={href}
              {...rest}
              {...(external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
            >
              {linkChildren}
            </a>
          );
        },
      }}
    >
      {md}
    </ReactMarkdown>
  );
}
