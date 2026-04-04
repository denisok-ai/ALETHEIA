import Link from 'next/link';

export type BreadcrumbItem = { label: string; href?: string };

/** Визуальные «хлебные крошки» для внутренних публичных страниц. */
export function Breadcrumbs({ items }: { items: BreadcrumbItem[] }) {
  if (items.length === 0) return null;
  return (
    <nav className="mb-6 text-sm text-[var(--text-muted)]" aria-label="Хлебные крошки">
      <ol className="flex flex-wrap items-center gap-x-2 gap-y-1">
        {items.map((item, i) => {
          const last = i === items.length - 1;
          return (
            <li key={`${item.label}-${i}`} className="flex items-center gap-2">
              {i > 0 && (
                <span className="text-[var(--text-soft)]" aria-hidden>
                  /
                </span>
              )}
              {last || !item.href ? (
                <span className={last ? 'text-[var(--text)]' : undefined}>{item.label}</span>
              ) : (
                <Link href={item.href} className="hover:text-plum">
                  {item.label}
                </Link>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
