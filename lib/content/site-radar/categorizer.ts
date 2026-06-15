/**
 * Категоризация URL Site Radar.
 */
const LEGAL = new Set(['/oferta', '/privacy', '/pd-consent', '/terms', '/cookie', '/policy']);
const CONTACT = new Set(['/contacts', '/contact']);
const ABOUT = new Set(['/about', '/about-us']);
const FAQ = new Set(['/faq', '/help', '/qa']);

export function categorizeUrl(url: string): string {
  let path = '/';
  try {
    path = new URL(url).pathname.replace(/\/$/, '') || '/';
  } catch {
    return 'other';
  }
  if (path === '/') return 'home';
  const parts = path.split('/').filter(Boolean);
  const head = '/' + (parts[0] ?? '');
  if (head === '/course') return 'course';
  if (head === '/blog') return parts.length === 1 ? 'blog_index' : 'blog_post';
  if (FAQ.has(path) || FAQ.has(head)) return 'faq';
  if (ABOUT.has(path) || ABOUT.has(head)) return 'about';
  if (CONTACT.has(path) || CONTACT.has(head)) return 'contact';
  if (LEGAL.has(path) || LEGAL.has(head)) return 'legal';
  return 'other';
}

export function isCommercialCategory(category: string): boolean {
  return ['home', 'course', 'faq'].includes(category);
}
