/**
 * Иконки-ссылки на Instagram, YouTube и Telegram AVATERRA.
 */
import { Instagram, Youtube } from 'lucide-react';
import { SOCIAL_LINKS } from '@/lib/social-links';
import { cn } from '@/lib/utils';

type SocialLinksProps = {
  className?: string;
  iconClassName?: string;
};

function TelegramIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden>
      <path d="M21.94 4.66a1.28 1.28 0 0 0-1.32-.18L2.93 11.3a1.2 1.2 0 0 0 .09 2.23l4.74 1.58 1.82 5.52a1.2 1.2 0 0 0 1.87.5l2.6-2.28 4.83 3.56a1.2 1.2 0 0 0 1.9-.78l2.14-15.47ZM9.28 13.87l8.11-5.05-6.2 6.72-.28 2.98 2.37-4.65Z" />
    </svg>
  );
}

const items = [
  { key: 'instagram' as const, label: 'Instagram AVATERRA', Icon: Instagram },
  { key: 'youtube' as const, label: 'YouTube AVATERRA', Icon: Youtube },
  { key: 'telegram' as const, label: 'Telegram AVATERRA', Icon: TelegramIcon },
];

export function SocialLinks({ className, iconClassName = 'h-5 w-5' }: SocialLinksProps) {
  return (
    <ul className={cn('flex items-center gap-1.5', className)} aria-label="Соцсети AVATERRA">
      {items.map(({ key, label, Icon }) => (
        <li key={key}>
          <a
            href={SOCIAL_LINKS[key]}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={label}
            className={cn(
              'inline-flex h-9 w-9 items-center justify-center rounded-lg text-[var(--text-muted)] transition-colors',
              'hover:bg-plum/[0.08] hover:text-plum focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-plum'
            )}
          >
            <Icon className={iconClassName} />
          </a>
        </li>
      ))}
    </ul>
  );
}
