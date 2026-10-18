/**
 * Блок «Как заниматься бережно» — правила безопасности самостоятельной практики.
 * variant="public" — карточка на публичной странице практикума;
 * variant="portal" — сворачиваемая карточка в кабинете студента (не мешает учёбе).
 * Серверно-совместимый компонент (без хуков): <details> работает без JS.
 */
import {
  PRACTICE_SAFETY_LEAD,
  PRACTICE_SAFETY_RULES,
  PRACTICE_SAFETY_TITLE,
  PRACTICE_SAFETY_URGENT,
} from '@/lib/content/practice-safety';

function Rules({ textClass, urgentClass }: { textClass: string; urgentClass: string }) {
  return (
    <>
      <p className={`leading-relaxed ${textClass}`}>{PRACTICE_SAFETY_LEAD}</p>
      <ul className={`mt-3 space-y-2 leading-relaxed ${textClass}`}>
        {PRACTICE_SAFETY_RULES.map((r) => (
          <li key={r} className="flex gap-2">
            <span aria-hidden className="mt-0.5 shrink-0">
              •
            </span>
            <span>{r}</span>
          </li>
        ))}
      </ul>
      <p className={`mt-3 font-semibold ${urgentClass}`}>{PRACTICE_SAFETY_URGENT}</p>
    </>
  );
}

export function PracticeSafetyNote({ variant = 'public' }: { variant?: 'public' | 'portal' }) {
  if (variant === 'portal') {
    return (
      <details className="portal-card group p-5" data-testid="practice-safety-note">
        <summary className="cursor-pointer list-none text-sm font-semibold text-[var(--portal-text)] [&::-webkit-details-marker]:hidden">
          <span aria-hidden className="mr-2 inline-block transition-transform group-open:rotate-90">
            ›
          </span>
          {PRACTICE_SAFETY_TITLE}
        </summary>
        <div className="mt-3 text-sm">
          <Rules textClass="text-[var(--portal-text-muted)]" urgentClass="text-[var(--portal-text)]" />
        </div>
      </details>
    );
  }
  return (
    <section
      className="mt-12 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6 md:p-8"
      aria-labelledby="practice-safety-title"
      data-testid="practice-safety-note"
    >
      <h2 id="practice-safety-title" className="font-heading text-2xl font-semibold">
        {PRACTICE_SAFETY_TITLE}
      </h2>
      <div className="mt-3 max-w-3xl">
        <Rules textClass="text-[var(--text-muted)]" urgentClass="text-[var(--text)]" />
      </div>
    </section>
  );
}
