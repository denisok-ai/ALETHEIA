/**
 * Карточка портала — redesigned: portal-card класс, поддержка заголовка и описания.
 */
export interface CardProps {
  children: React.ReactNode;
  title?: string;
  description?: string | null;
  className?: string;
  padding?: 'sm' | 'md' | 'lg';
}

const paddingMap = { sm: 'p-4', md: 'p-5', lg: 'p-6' };

export function Card({ children, title, description, className = '', padding = 'md' }: CardProps) {
  const p = paddingMap[padding];
  return (
    <div className={`portal-card ${p} ${className}`.trim()}>
      {title && (
        <h2
          className="text-base font-semibold mb-1"
          style={{ color: 'var(--portal-text)' }}
        >
          {title}
        </h2>
      )}
      {description && (
        <p className="text-sm mb-3" style={{ color: 'var(--portal-text-muted)' }}>
          {description}
        </p>
      )}
      {children}
    </div>
  );
}
