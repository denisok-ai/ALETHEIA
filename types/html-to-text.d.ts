declare module 'html-to-text' {
  export function convert(
    html: string,
    options?: { wordwrap?: number | false }
  ): string;
  export function compile(options?: { wordwrap?: number | false }): (html: string) => string;
}
