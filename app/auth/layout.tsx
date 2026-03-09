/**
 * Layout for auth flow pages (update-password, etc.).
 */
import Link from 'next/link';

export default function AuthFlowLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-bg-cream px-4">
      <Link
        href="/"
        className="absolute top-6 left-6 font-semibold text-primary hover:underline"
      >
        ← AVATERRA
      </Link>
      <div className="w-full max-w-md">{children}</div>
    </div>
  );
}
