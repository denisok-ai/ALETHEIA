declare module 'html-to-text' {
  export function convert(html: string, options?: { wordwrap?: number }): string;
  export function compile(options?: { wordwrap?: number }): (html: string) => string;
}
