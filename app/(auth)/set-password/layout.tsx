import type { Metadata } from 'next';
import { transactionalPageMetadata } from '@/lib/transactional-metadata';

export async function generateMetadata(): Promise<Metadata> {
  return transactionalPageMetadata('/set-password', 'Установка пароля');
}

export default function SetPasswordLayout({ children }: { children: React.ReactNode }) {
  return children;
}
