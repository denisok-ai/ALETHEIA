/**
 * Layout for auth pages: login, register, reset-password.
 * Centered card, minimal chrome.
 */
import Link from 'next/link';

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[var(--bg)] px-4 font-body">
      <Link
        href="/"
        className="absolute top-6 left-6 text-[var(--portal-accent)] font-semibold hover:underline"
      >
        ← AVATERRA
      </Link>
      <div className="w-full max-w-md">{children}</div>
    </div>
  );
}
