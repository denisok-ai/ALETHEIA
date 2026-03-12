/**
 * Единая шапка страницы портала — redesigned: breadcrumbs, title, actions.
 */
import { Breadcrumbs, type BreadcrumbItem } from './Breadcrumbs';

export interface PageHeaderProps {
  items: BreadcrumbItem[];
  title: string;
  description?: string | null;
  actions?: React.ReactNode;
}

export function PageHeader({ items, title, description, actions }: PageHeaderProps) {
  return (
    <header className="mb-6">
      <Breadcrumbs items={items} />
      <div className="mt-3 flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <h1
            className="text-2xl font-bold leading-tight"
            style={{ color: 'var(--portal-text)', fontFamily: 'var(--font-heading, inherit)' }}
          >
            {title}
          </h1>
          {description && (
            <p className="mt-1.5 text-sm" style={{ color: 'var(--portal-text-muted)' }}>
              {description}
            </p>
          )}
        </div>
        {actions && (
          <div className="flex shrink-0 flex-wrap items-center gap-2">
            {actions}
          </div>
        )}
      </div>
    </header>
  );
}
