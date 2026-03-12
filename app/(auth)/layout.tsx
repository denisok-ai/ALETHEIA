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
    <div className="min-h-screen flex flex-col items-center justify-center bg-[#F8FAFC] px-4">
      <Link
        href="/"
        className="absolute top-6 left-6 text-[#6366F1] font-semibold hover:underline"
      >
        ← AVATERRA
      </Link>
      <div className="w-full max-w-md">{children}</div>
    </div>
  );
}
