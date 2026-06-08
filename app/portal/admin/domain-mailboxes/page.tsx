/**
 * Совместимость: старый URL ведёт в центр «Почта» → вкладка ящиков.
 */
import { redirect } from 'next/navigation';

export default function DomainMailboxesLegacyRedirectPage() {
  redirect('/portal/admin/mail?tab=mailboxes');
}
