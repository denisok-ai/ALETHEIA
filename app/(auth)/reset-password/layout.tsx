import type { Metadata } from 'next';
import { transactionalPageMetadata } from '@/lib/transactional-metadata';

export async function generateMetadata(): Promise<Metadata> {
  return transactionalPageMetadata('/reset-password', 'Восстановление пароля');
}

export default function ResetPasswordLayout({ children }: { children: React.ReactNode }) {
  return children;
}
