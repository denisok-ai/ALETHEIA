import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Отписаться от рассылок',
  description: 'Отписка от информационных рассылок школы AVATERRA.',
  robots: { index: false, follow: true },
};

export default function UnsubscribeLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
