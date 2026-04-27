/**
 * Админ: хаб «Группы» — переходы в разделы Курсы, Медиатека, Пользователи.
 */
import type { Metadata } from 'next';
import { AdminGroupsHubView } from './AdminGroupsHubView';

export const metadata: Metadata = { title: 'Группы' };

export default function AdminGroupsHubPage() {
  return <AdminGroupsHubView />;
}
