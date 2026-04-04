/**
 * Оборачивает голые http(s) URL в markdown [url](url), чтобы ReactMarkdown дал кликабельные ссылки.
 * Не трогает URL уже внутри markdown-ссылки [текст](url) — lookbehind на "]( ".
 */
export function linkifyBareUrlsForMarkdown(text: string): string {
  if (!text) return text;

  const re = /(?<!\]\()https?:\/\/[^\s<>"']+/gi;

  return text.replace(re, (raw) => {
    let u = raw;
    const trailing: string[] = [];
    while (u.length > 0) {
      const last = u[u.length - 1];
      if (['.', ',', ';', ':', '!', '?', ')', ']', '"', "'", '`'].includes(last)) {
        trailing.unshift(last);
        u = u.slice(0, -1);
        continue;
      }
      break;
    }
    if (u.length < 8) return raw;
    return `[${u}](${u})` + trailing.join('');
  });
}
