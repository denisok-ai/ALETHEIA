import type { Metadata } from 'next';
import { transactionalPageMetadata } from '@/lib/transactional-metadata';

export async function generateMetadata(): Promise<Metadata> {
  return transactionalPageMetadata('/verify-email', 'Подтверждение email');
}

export default function VerifyEmailLayout({ children }: { children: React.ReactNode }) {
  return children;
}
