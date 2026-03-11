/**
 * Единая шапка страницы портала: хлебные крошки, заголовок, описание, слот для действий.
 * Используется в админке и при необходимости в других разделах портала.
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
    <header className="space-y-2">
      <Breadcrumbs items={items} />
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="font-heading text-2xl font-bold text-dark">{title}</h1>
          {description && (
            <p className="mt-1 text-sm text-text-muted">{description}</p>
          )}
        </div>
        {actions && (
          <div className="flex flex-shrink-0 flex-wrap items-center gap-2">
            {actions}
          </div>
        )}
      </div>
    </header>
  );
}
