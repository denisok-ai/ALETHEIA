'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { usePortalUI } from './PortalUIProvider';
import { PortalAccountBlock } from './PortalAccountBlock';
import { X, PanelLeftClose, PanelLeft } from 'lucide-react';

export interface NavItem {
  href: string;
  label: string;
  icon?: React.ReactNode;
}

/** Группа пунктов меню с опциональным заголовком секции */
export interface NavSection {
  sectionLabel?: string;
  items: NavItem[];
}

interface PortalSidebarProps {
  /** Плоский список (для студента/менеджера) */
  items?: NavItem[];
  /** Секции с заголовками (для админки) — при наличии используется вместо items */
  sections?: NavSection[];
  collapsible?: boolean;
}

const SIDEBAR_COLLAPSED_KEY = 'portal-sidebar-collapsed';

function renderNavLinks(
  items: NavItem[],
  pathname: string,
  opts: { onLinkClick?: () => void; collapsed?: boolean; indent?: boolean }
) {
  const { onLinkClick, collapsed, indent } = opts;
  return items.map((item) => {
    const active = pathname === item.href || pathname.startsWith(item.href + '/');
    return (
      <Link
        key={item.href}
        href={item.href}
        onClick={onLinkClick}
        title={collapsed ? item.label : undefined}
        className={cn(
          'flex items-center rounded-lg py-2 text-sm font-medium transition',
          collapsed ? 'justify-center px-2' : 'gap-2 px-3',
          indent && !collapsed && 'pl-5',
          active
            ? 'bg-primary text-white'
            : 'text-dark hover:bg-bg-soft hover:text-primary'
        )}
        aria-current={active ? 'page' : undefined}
      >
        {item.icon}
        {!collapsed && <span>{item.label}</span>}
      </Link>
    );
  });
}

function SidebarNav({
  items: flatItems,
  sections,
  onLinkClick,
  collapsed,
  firstRowAction,
}: {
  items?: NavItem[];
  sections?: NavSection[];
  onLinkClick?: () => void;
  collapsed?: boolean;
  firstRowAction?: React.ReactNode;
}) {
  const pathname = usePathname();
  const useSections = sections && sections.length > 0;
  const items = useSections ? sections.flatMap((s) => s.items) : flatItems ?? [];
  const [first, ...rest] = items;

  return (
    <nav className="flex flex-col gap-1" aria-label="Разделы портала">
      {firstRowAction && collapsed ? (
        <div className="flex w-full justify-center px-2 py-2">{firstRowAction}</div>
      ) : null}
      {useSections ? (
        <>
          {sections!.map((section, idx) => {
            const isFirstSection = idx === 0;
            const [firstItem, ...restItems] = section.items;
            const showFirstRowWithAction = isFirstSection && firstItem && firstRowAction && !collapsed;
            return (
              <div key={section.sectionLabel ?? idx} className={cn('flex flex-col gap-1', idx > 0 && 'mt-4')}>
                {section.sectionLabel && !collapsed && (
                  <p
                    className="px-3 py-1 text-xs font-semibold uppercase tracking-wider text-text-muted"
                    aria-hidden
                  >
                    {section.sectionLabel}
                  </p>
                )}
                {showFirstRowWithAction ? (
                  <>
                    <div className="flex items-center gap-2">
                      <Link
                        href={firstItem.href}
                        onClick={onLinkClick}
                        className={cn(
                          'flex min-w-0 flex-1 items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition',
                          pathname === firstItem.href || pathname.startsWith(firstItem.href + '/')
                            ? 'bg-primary text-white'
                            : 'text-dark hover:bg-bg-soft hover:text-primary'
                        )}
                        aria-current={pathname === firstItem.href || pathname.startsWith(firstItem.href + '/') ? 'page' : undefined}
                      >
                        {firstItem.icon}
                        <span>{firstItem.label}</span>
                      </Link>
                      {firstRowAction}
                    </div>
                    {restItems.length > 0 && renderNavLinks(restItems, pathname, { onLinkClick, collapsed, indent: !!section.sectionLabel })}
                  </>
                ) : (
                  renderNavLinks(section.items, pathname, { onLinkClick, collapsed, indent: !!section.sectionLabel })
                )}
              </div>
            );
          })}
        </>
      ) : (
        <>
          {first && (
            <div className={cn('flex items-center gap-1', !collapsed && 'gap-2')}>
              <Link
                href={first.href}
                onClick={onLinkClick}
                title={collapsed ? first.label : undefined}
                className={cn(
                  'flex min-w-0 flex-1 items-center rounded-lg py-2 text-sm font-medium transition',
                  collapsed ? 'justify-center px-2' : 'gap-2 px-3',
                  pathname === first.href || pathname.startsWith(first.href + '/')
                    ? 'bg-primary text-white'
                    : 'text-dark hover:bg-bg-soft hover:text-primary'
                )}
                aria-current={pathname === first.href || pathname.startsWith(first.href + '/') ? 'page' : undefined}
              >
                {first.icon}
                {!collapsed && <span>{first.label}</span>}
              </Link>
              {!collapsed && firstRowAction}
            </div>
          )}
          {rest.length > 0 && renderNavLinks(rest, pathname, { onLinkClick, collapsed })}
        </>
      )}
    </nav>
  );
}

export function PortalSidebar({ items = [], sections, collapsible }: PortalSidebarProps) {
  const { mobileMenuOpen, setMobileMenuOpen } = usePortalUI();
  const [collapsed, setCollapsed] = useState(false);
  const navItems = sections && sections.length > 0 ? sections.flatMap((s) => s.items) : items;

  useEffect(() => {
    if (typeof window === 'undefined' || !collapsible) return;
    const stored = localStorage.getItem(SIDEBAR_COLLAPSED_KEY);
    setCollapsed(stored === '1');
  }, [collapsible]);

  useEffect(() => {
    if (!collapsible) return;
    localStorage.setItem(SIDEBAR_COLLAPSED_KEY, collapsed ? '1' : '0');
  }, [collapsible, collapsed]);

  return (
    <>
      {/* Desktop: always visible, optional collapse */}
      <aside
        className={cn(
          'hidden shrink-0 border-r border-border bg-white p-4 lg:flex lg:flex-col lg:min-h-0 transition-[width] duration-200',
          collapsible && collapsed ? 'w-[4.5rem]' : 'w-56'
        )}
        aria-label="Боковое меню"
      >
        <div className="min-h-0 flex-1 overflow-y-auto">
          <SidebarNav
            items={items}
            sections={sections}
            collapsed={collapsible ? collapsed : undefined}
            firstRowAction={
              collapsible ? (
                <button
                  type="button"
                  onClick={() => setCollapsed((c) => !c)}
                  className="flex shrink-0 items-center justify-center rounded-lg py-2 text-text-muted hover:bg-bg-soft hover:text-dark lg:py-2 lg:px-2"
                  title={collapsed ? 'Развернуть меню' : 'Свернуть меню'}
                  aria-label={collapsed ? 'Развернуть меню' : 'Свернуть меню'}
                >
                  {collapsed ? <PanelLeft className="h-5 w-5" /> : <PanelLeftClose className="h-5 w-5" />}
                </button>
              ) : undefined
            }
          />
        </div>
        <PortalAccountBlock collapsed={collapsible ? collapsed : false} />
      </aside>
      {/* Mobile: overlay when menu open */}
      {mobileMenuOpen && (
        <div
          className="fixed inset-0 z-50 lg:hidden"
          aria-modal="true"
          role="dialog"
          aria-label="Меню навигации"
        >
          <button
            type="button"
            onClick={() => setMobileMenuOpen(false)}
            className="absolute inset-0 bg-dark/40"
            aria-label="Закрыть меню"
          />
          <aside className="absolute left-0 top-0 flex h-full w-64 flex-col border-r border-border bg-white p-4 shadow-lg">
            <div className="flex items-center justify-between border-b border-border pb-3 mb-3">
              <span className="text-sm font-medium text-dark">Меню</span>
              <button
                type="button"
                onClick={() => setMobileMenuOpen(false)}
                className="flex h-8 w-8 items-center justify-center rounded-lg text-text-muted hover:bg-bg-soft hover:text-dark"
                aria-label="Закрыть"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto">
              <SidebarNav
                items={items}
                sections={sections}
                onLinkClick={() => setMobileMenuOpen(false)}
                collapsed={false}
              />
            </div>
            <PortalAccountBlock collapsed={false} />
          </aside>
        </div>
      )}
    </>
  );
}
