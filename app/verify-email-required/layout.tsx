import type { Metadata } from 'next';
import { transactionalPageMetadata } from '@/lib/transactional-metadata';

export async function generateMetadata(): Promise<Metadata> {
  return transactionalPageMetadata('/verify-email-required', 'Подтвердите email');
}

export default function VerifyEmailRequiredLayout({ children }: { children: React.ReactNode }) {
  return children;
}
