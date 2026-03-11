/**
 * Единая карточка контента в портале: скруглённая рамка, белый фон, отступы.
 * Используется в админке для секций (метрики, таблицы, формы).
 */
export interface CardProps {
  children: React.ReactNode;
  title?: string;
  description?: string | null;
  className?: string;
}

export function Card({ children, title, description, className = '' }: CardProps) {
  const hasHeader = title != null || (description != null && description !== '');
  return (
    <div
      className={`rounded-xl border border-border bg-white p-4 ${hasHeader ? 'space-y-3' : ''} ${className}`.trim()}
    >
      {title != null && title !== '' && (
        <h2 className="text-lg font-semibold text-dark">{title}</h2>
      )}
      {description != null && description !== '' && (
        <p className="text-sm text-text-muted">{description}</p>
      )}
      {children}
    </div>
  );
}
