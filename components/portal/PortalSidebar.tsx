'use client';

/**
 * Portal sidebar — redesigned: dark background, gold active accent, collapsible.
 */
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

export interface NavSection {
  sectionLabel?: string;
  items: NavItem[];
}

interface PortalSidebarProps {
  items?: NavItem[];
  sections?: NavSection[];
  collapsible?: boolean;
}

const SIDEBAR_COLLAPSED_KEY = 'portal-sidebar-collapsed';

/* ─── Один nav-link ─── */
function SidebarLink({
  item,
  collapsed,
  onClick,
}: {
  item: NavItem;
  collapsed?: boolean;
  onClick?: () => void;
}) {
  const pathname = usePathname();
  const active = pathname === item.href || pathname.startsWith(item.href + '/');

  return (
    <Link
      href={item.href}
      onClick={onClick}
      title={collapsed ? item.label : undefined}
      aria-current={active ? 'page' : undefined}
      className={cn(
        'portal-sidebar-link',
        collapsed && 'justify-center px-2',
        active && 'active'
      )}
    >
      {item.icon && (
        <span className="shrink-0 flex items-center justify-center w-5 h-5">
          {item.icon}
        </span>
      )}
      {!collapsed && <span className="truncate">{item.label}</span>}
    </Link>
  );
}

/* ─── Навигация (секции или плоский список) ─── */
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

  return (
    <nav className="flex flex-col gap-0.5" aria-label="Разделы портала">
      {/* Кнопка сворачивания (если collapsed) */}
      {firstRowAction && collapsed && (
        <div className="flex w-full justify-center py-2">{firstRowAction}</div>
      )}

      {useSections ? (
        sections!.map((section, idx) => {
          const isFirst = idx === 0;
          const [firstItem, ...restItems] = section.items;
          const showToggleInFirst = isFirst && firstItem && firstRowAction && !collapsed;

          return (
            <div key={section.sectionLabel ?? idx} className={cn('flex flex-col gap-0.5', idx > 0 && 'mt-5')}>
              {/* Заголовок секции */}
              {section.sectionLabel && !collapsed && (
                <p
                  className="px-2 pb-1 pt-1 text-[0.65rem] font-semibold uppercase tracking-widest"
                  style={{ color: 'var(--portal-sidebar-label)' }}
                  aria-hidden
                >
                  {section.sectionLabel}
                </p>
              )}

              {/* Первый пункт с кнопкой toggle (если развёрнут) */}
              {showToggleInFirst ? (
                <div className="flex items-center gap-1">
                  <Link
                    href={firstItem.href}
                    onClick={onLinkClick}
                    aria-current={
                      pathname === firstItem.href || pathname.startsWith(firstItem.href + '/')
                        ? 'page'
                        : undefined
                    }
                    className={cn(
                      'portal-sidebar-link flex-1 min-w-0',
                      (pathname === firstItem.href || pathname.startsWith(firstItem.href + '/')) && 'active'
                    )}
                  >
                    {firstItem.icon && (
                      <span className="shrink-0 w-5 h-5 flex items-center">{firstItem.icon}</span>
                    )}
                    <span className="truncate">{firstItem.label}</span>
                  </Link>
                  {firstRowAction}
                </div>
              ) : (
                firstItem && (
                  <SidebarLink
                    item={firstItem}
                    collapsed={collapsed}
                    onClick={onLinkClick}
                  />
                )
              )}

              {restItems.map((item) => (
                <SidebarLink
                  key={item.href}
                  item={item}
                  collapsed={collapsed}
                  onClick={onLinkClick}
                />
              ))}
            </div>
          );
        })
      ) : (
        /* Плоский список */
        <>
          {(flatItems ?? []).map((item, idx) => (
            idx === 0 && firstRowAction && !collapsed ? (
              <div key={item.href} className="flex items-center gap-1">
                <Link
                  href={item.href}
                  onClick={onLinkClick}
                  aria-current={
                    pathname === item.href || pathname.startsWith(item.href + '/') ? 'page' : undefined
                  }
                  className={cn(
                    'portal-sidebar-link flex-1 min-w-0',
                    (pathname === item.href || pathname.startsWith(item.href + '/')) && 'active'
                  )}
                >
                  {item.icon && (
                    <span className="shrink-0 w-5 h-5 flex items-center">{item.icon}</span>
                  )}
                  <span className="truncate">{item.label}</span>
                </Link>
                {firstRowAction}
              </div>
            ) : (
              <SidebarLink
                key={item.href}
                item={item}
                collapsed={collapsed}
                onClick={onLinkClick}
              />
            )
          ))}
        </>
      )}
    </nav>
  );
}

/* ─── Логотип в сайдбаре ─── */
function SidebarLogo({ collapsed }: { collapsed: boolean }) {
  return (
    <Link
      href="/"
      className="flex items-center gap-2.5 px-1 mb-5 select-none group"
      aria-label="AVATERRA — на главную"
    >
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg
        bg-[var(--portal-accent)] text-white font-bold text-sm shadow-sm
        group-hover:bg-[var(--portal-accent-dark)] transition-colors">
        AV
      </span>
      {!collapsed && (
        <span className="font-heading font-bold text-[var(--portal-text)] text-[0.95rem] tracking-tight
          group-hover:text-[var(--portal-accent)] transition-colors">
          AVATERRA
        </span>
      )}
    </Link>
  );
}

/* ─── Кнопка collapse ─── */
function CollapseButton({ collapsed, onClick }: { collapsed: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex items-center justify-center h-7 w-7 rounded-md
        text-[var(--portal-text-soft)] hover:text-[var(--portal-accent)]
        hover:bg-[var(--portal-accent-soft)] transition"
      title={collapsed ? 'Развернуть меню' : 'Свернуть меню'}
      aria-label={collapsed ? 'Развернуть меню' : 'Свернуть меню'}
    >
      {collapsed
        ? <PanelLeft className="h-4 w-4" />
        : <PanelLeftClose className="h-4 w-4" />}
    </button>
  );
}

/* ─── Desktop sidebar shell ─── */
function DesktopSidebar({
  items,
  sections,
  collapsed,
  collapsible,
  onToggle,
}: {
  items?: NavItem[];
  sections?: NavSection[];
  collapsed: boolean;
  collapsible?: boolean;
  onToggle: () => void;
}) {
  return (
    <aside
      style={{ width: collapsed ? 'var(--portal-sidebar-collapsed-w)' : 'var(--portal-sidebar-w)' }}
      className="hidden lg:flex flex-col shrink-0 h-full
        bg-[var(--portal-sidebar-bg)]
        border-r border-[var(--portal-sidebar-border)]
        transition-[width] duration-200 overflow-hidden"
      aria-label="Боковое меню"
    >
      <div className="flex flex-col flex-1 min-h-0 px-3 pt-5 pb-3 overflow-y-auto">
        <SidebarLogo collapsed={collapsed} />
        <SidebarNav
          items={items}
          sections={sections}
          collapsed={collapsed}
          firstRowAction={
            collapsible
              ? <CollapseButton collapsed={collapsed} onClick={onToggle} />
              : undefined
          }
        />
      </div>
      <div className="px-3 pb-4 border-t border-[var(--portal-sidebar-border)]">
        <PortalAccountBlock collapsed={collapsed} />
      </div>
    </aside>
  );
}

/* ─── Mobile sidebar overlay ─── */
function MobileSidebar({
  items,
  sections,
  onClose,
}: {
  items?: NavItem[];
  sections?: NavSection[];
  onClose: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-50 lg:hidden"
      aria-modal="true"
      role="dialog"
      aria-label="Меню навигации"
    >
      {/* backdrop */}
      <button
        type="button"
        onClick={onClose}
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        aria-label="Закрыть меню"
      />

      <aside className="absolute left-0 top-0 flex h-full flex-col
        bg-[var(--portal-sidebar-bg)] shadow-xl
        w-[var(--portal-sidebar-w)]
        border-r border-[var(--portal-sidebar-border)]">
        <div className="flex items-center justify-between px-4 pt-5 pb-3
          border-b border-[var(--portal-sidebar-border)]">
          <SidebarLogo collapsed={false} />
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-lg
              text-[var(--portal-text-muted)] hover:bg-[var(--portal-surface-hover)]
              hover:text-[var(--portal-text)] transition"
            aria-label="Закрыть"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-3 pt-3">
          <SidebarNav
            items={items}
            sections={sections}
            onLinkClick={onClose}
            collapsed={false}
          />
        </div>
        <div className="px-3 pb-5 border-t border-[var(--portal-sidebar-border)]">
          <PortalAccountBlock collapsed={false} />
        </div>
      </aside>
    </div>
  );
}

/* ─── Экспортируемый компонент ─── */
export function PortalSidebar({ items = [], sections, collapsible }: PortalSidebarProps) {
  const { mobileMenuOpen, setMobileMenuOpen } = usePortalUI();
  const [collapsed, setCollapsed] = useState(false);

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
      <DesktopSidebar
        items={items}
        sections={sections}
        collapsed={collapsed}
        collapsible={collapsible}
        onToggle={() => setCollapsed((c) => !c)}
      />
      {mobileMenuOpen && (
        <MobileSidebar
          items={items}
          sections={sections}
          onClose={() => setMobileMenuOpen(false)}
        />
      )}
    </>
  );
}
