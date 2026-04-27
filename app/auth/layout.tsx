/**
 * Layout for auth flow pages (update-password, etc.).
 */
import type { Metadata } from 'next';
import Link from 'next/link';
import { transactionalPageMetadata } from '@/lib/transactional-metadata';

export async function generateMetadata(): Promise<Metadata> {
  return transactionalPageMetadata('/auth/update-password', 'Смена пароля');
}

export default function AuthFlowLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[var(--bg)] px-4 font-body">
      <Link
        href="/"
        className="absolute top-6 left-6 font-semibold text-[var(--portal-accent)] hover:underline"
      >
        ← На сайт
      </Link>
      <div className="w-full max-w-md">{children}</div>
    </div>
  );
}
