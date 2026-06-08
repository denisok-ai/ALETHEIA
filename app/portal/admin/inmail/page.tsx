/**
 * Совместимость: старый URL ведёт в центр «Почта» → вкладка входящих.
 */
import { redirect } from 'next/navigation';

export default function InmailLegacyRedirectPage() {
  redirect('/portal/admin/mail?tab=inbox');
}
