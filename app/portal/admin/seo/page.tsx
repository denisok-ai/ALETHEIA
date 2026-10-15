/**
 * Admin: SEO — поиск (GSC), Метрика, статус синков, запросы и страницы, темы недели.
 * Данные из SeoMetric (только чтение); синк вручную — кнопка → API /api/portal/admin/seo/sync.
 */
import type { Metadata } from 'next';
import { requireAdminSession } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { PageHeader } from '@/components/portal/PageHeader';
import { getSeoMetrics, lastSeoSyncRuns } from '@/lib/seo/store';
import { SEO_HOST } from '@/lib/seo/metric-types';
import { formatMsk } from '@/lib/social/moscow-day';
import { MIN_WEEK_IMPRESSIONS, MIN_WEEK_VISITS } from '@/lib/seo/weekly-digest';
import {
  buildCtrOutlierRows,
  buildMetrikaCard,
  buildOpportunityRows,
  buildPageRows,
  buildQueryRows,
  buildSearchCards,
  buildSyncRows,
  dashboardWindows,
  fmtDeltaPct,
  fmtInt,
  fmtPct,
  fmtPos,
  type SearchCards,
  type SyncRow,
} from '@/lib/seo/dashboard';
import { SeoSyncButton } from './SeoSyncButton';

export const metadata: Metadata = { title: 'SEO' };
export const dynamic = 'force-dynamic';

const QUERY_LIMIT = 30;
const PAGE_LIMIT = 20;
const TOPIC_LIMIT = 20;

const cardStyle = { background: 'var(--portal-surface, #fff)', borderColor: 'var(--portal-border, #E2E8F0)' };
const textStyle = { color: 'var(--portal-text)' };
const mutedStyle = { color: 'var(--portal-text-muted)' };

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border p-4" style={cardStyle}>
      <h2 className="mb-3 text-sm font-semibold" style={textStyle}>
        {title}
      </h2>
      {children}
    </section>
  );
}

function Delta({ text }: { text: string }) {
  return (
    <p className="mt-1 text-xs" style={mutedStyle}>
      к прошлой неделе: {text}
    </p>
  );
}

function fmtPosDelta(d: number | null): string {
  if (d === null) return '—';
  return `${d > 0 ? '+' : ''}${d.toFixed(1)} (меньше — лучше)`;
}

function SearchCard({ c }: { c: SearchCards }) {
  return (
    <Card title="Поиск (GSC), 7 дней">
      <dl className="grid grid-cols-3 gap-3">
        <div>
          <dt className="text-xs" style={mutedStyle}>Показы</dt>
          <dd className="text-xl font-semibold" style={textStyle}>{fmtInt(c.impressions)}</dd>
          <Delta text={fmtDeltaPct(c.impressionsDelta)} />
        </div>
        <div>
          <dt className="text-xs" style={mutedStyle}>Клики</dt>
          <dd className="text-xl font-semibold" style={textStyle}>{fmtInt(c.clicks)}</dd>
          <Delta text={fmtDeltaPct(c.clicksDelta)} />
        </div>
        <div>
          <dt className="text-xs" style={mutedStyle}>Средняя позиция</dt>
          <dd className="text-xl font-semibold" style={textStyle}>{fmtPos(c.position)}</dd>
          <Delta
            text={fmtPosDelta(
              c.position !== null && c.previousPosition !== null ? c.position - c.previousPosition : null,
            )}
          />
        </div>
      </dl>
      {!c.enough && (
        <p className="mt-3 text-xs" style={mutedStyle}>
          Мало данных для выводов (показов меньше {MIN_WEEK_IMPRESSIONS}).
        </p>
      )}
    </Card>
  );
}

function MetrikaCardView({ visits, previousVisits, visitsDelta, enough }: ReturnType<typeof buildMetrikaCard>) {
  return (
    <Card title="Яндекс.Метрика, 7 дней">
      <p className="text-xl font-semibold" style={textStyle}>
        {fmtInt(visits)} <span className="text-sm font-normal" style={mutedStyle}>визитов</span>
      </p>
      <p className="mt-1 text-xs" style={mutedStyle}>
        было {fmtInt(previousVisits)} · {fmtDeltaPct(visitsDelta)} к прошлой неделе
      </p>
      {!enough && (
        <p className="mt-3 text-xs" style={mutedStyle}>
          Мало данных для выводов (визитов меньше {MIN_WEEK_VISITS}).
        </p>
      )}
    </Card>
  );
}

function SyncStatus({ rows }: { rows: SyncRow[] }) {
  const toneColor = { ok: '#15803D', warn: '#B45309', muted: 'var(--portal-text-muted)' } as const;
  return (
    <Card title="Синки">
      <ul className="divide-y text-sm" style={{ borderColor: 'var(--portal-border, #E2E8F0)' }}>
        {rows.map((s) => (
          <li key={s.source} className="flex flex-wrap items-baseline gap-x-3 gap-y-1 py-2">
            <span className="w-44 font-medium" style={textStyle}>{s.label}</span>
            <span className="font-medium" style={{ color: toneColor[s.tone] }}>{s.stateLabel}</span>
            <span className="text-xs" style={mutedStyle}>
              {s.finishedAt
                ? `последний прогон ${formatMsk(s.finishedAt)}`
                : s.startedAt
                  ? 'прогон не завершён'
                  : ''}
              {s.rows !== null ? ` · строк: ${s.rows}` : ''}
              {s.range ? ` · окно ${s.range}` : ''}
            </span>
            {s.message && (
              <span className="basis-full text-xs" style={{ color: toneColor.warn }}>
                {s.message}
              </span>
            )}
            {s.note && (
              <span className="basis-full text-xs" style={mutedStyle}>
                {s.note}
              </span>
            )}
          </li>
        ))}
      </ul>
    </Card>
  );
}

function EmptyNote() {
  return <p className="text-sm" style={mutedStyle}>Нет данных за 28 дней.</p>;
}

export default async function AdminSeoPage() {
  const auth = await requireAdminSession();
  if (!auth) {
    return (
      <PageHeader items={[{ label: 'SEO' }]} title="SEO" description="Требуется доступ администратора." />
    );
  }

  const w = dashboardWindows(new Date());
  const [rowsTotal, gscTotal, gscQuery, gscPage, gscQueryPage, metTotal, runs, webmasterOkCount] = await Promise.all([
    prisma.seoMetric.count({ where: { host: SEO_HOST } }),
    getSeoMetrics({ source: 'gsc', dimension: 'total', dateFrom: w.gsc28.from, dateTo: w.gsc28.to }),
    getSeoMetrics({ source: 'gsc', dimension: 'query', dateFrom: w.gsc28.from, dateTo: w.gsc28.to }),
    getSeoMetrics({ source: 'gsc', dimension: 'page', dateFrom: w.gsc28.from, dateTo: w.gsc28.to }),
    getSeoMetrics({ source: 'gsc', dimension: 'query_page', dateFrom: w.gsc28.from, dateTo: w.gsc28.to }),
    getSeoMetrics({ source: 'metrika', dimension: 'total', dateFrom: w.metrika14.from, dateTo: w.metrika14.to }),
    lastSeoSyncRuns(),
    prisma.seoSyncRun.count({ where: { source: 'webmaster', state: 'ok' } }),
  ]);

  const empty = rowsTotal === 0;
  const syncRows = buildSyncRows(runs, webmasterOkCount > 0);
  const search = buildSearchCards(gscTotal, w, MIN_WEEK_IMPRESSIONS);
  const metrika = buildMetrikaCard(metTotal, w, MIN_WEEK_VISITS);
  const queryRows = buildQueryRows(gscQuery, QUERY_LIMIT);
  const pageRows = buildPageRows(gscPage, PAGE_LIMIT);
  const topics = buildOpportunityRows(gscQuery, TOPIC_LIMIT, gscQueryPage);
  const outliers = buildCtrOutlierRows(gscPage, w, MIN_WEEK_IMPRESSIONS, TOPIC_LIMIT);

  return (
    <div className="w-full space-y-6">
      <PageHeader
        items={[{ href: '/portal/admin/dashboard', label: 'Дашборд' }, { label: 'SEO' }]}
        title="SEO"
        description={`Поиск Google (GSC, лаг 2 дня) и Яндекс.Метрика, ночной синк в 03:30 МСК. Неделя поиска: ${w.gscWeek.from} – ${w.gscWeek.to}; Метрика: ${w.metrikaWeek.from} – ${w.metrikaWeek.to}.`}
        actions={<SeoSyncButton />}
      />

      {empty ? (
        <div className="rounded-xl border p-4 text-sm" style={{ ...cardStyle, ...mutedStyle }}>
          Данных ещё нет — ночной синк в 03:30 МСК или кнопка выше.
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          <SearchCard c={search} />
          <MetrikaCardView {...metrika} />
        </div>
      )}

      <SyncStatus rows={syncRows} />

      <Card title="Запросы за 28 дней (топ-30 по показам)">
        {queryRows.length === 0 ? (
          <EmptyNote />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[480px] text-left text-sm">
              <thead className="text-xs" style={mutedStyle}>
                <tr>
                  <th className="py-1 pr-3 font-medium">Запрос</th>
                  <th className="py-1 pr-3 text-right font-medium">Показы</th>
                  <th className="py-1 pr-3 text-right font-medium">Клики</th>
                  <th className="py-1 pr-3 text-right font-medium">CTR</th>
                  <th className="py-1 text-right font-medium">Позиция</th>
                </tr>
              </thead>
              <tbody style={textStyle}>
                {queryRows.map((q) => (
                  <tr key={q.query} className="border-t" style={{ borderColor: 'var(--portal-border, #E2E8F0)' }}>
                    <td className="py-1.5 pr-3">{q.query}</td>
                    <td className="py-1.5 pr-3 text-right">{fmtInt(q.impressions)}</td>
                    <td className="py-1.5 pr-3 text-right">{fmtInt(q.clicks)}</td>
                    <td className="py-1.5 pr-3 text-right">{fmtPct(q.ctr)}</td>
                    <td className="py-1.5 text-right">{fmtPos(q.position)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Card title="Страницы за 28 дней (топ-20 по показам)">
        {pageRows.length === 0 ? (
          <EmptyNote />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[420px] text-left text-sm">
              <thead className="text-xs" style={mutedStyle}>
                <tr>
                  <th className="py-1 pr-3 font-medium">Страница</th>
                  <th className="py-1 pr-3 text-right font-medium">Показы</th>
                  <th className="py-1 pr-3 text-right font-medium">Клики</th>
                  <th className="py-1 text-right font-medium">Позиция</th>
                </tr>
              </thead>
              <tbody style={textStyle}>
                {pageRows.map((p) => (
                  <tr key={p.url} className="border-t" style={{ borderColor: 'var(--portal-border, #E2E8F0)' }}>
                    <td className="py-1.5 pr-3 break-all">{p.url}</td>
                    <td className="py-1.5 pr-3 text-right">{fmtInt(p.impressions)}</td>
                    <td className="py-1.5 pr-3 text-right">{fmtInt(p.clicks)}</td>
                    <td className="py-1.5 text-right">{fmtPos(p.position)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <div className="grid gap-4 md:grid-cols-2">
        <Card title="Темы недели (запросы на 6–20 месте)">
          {topics.length === 0 ? (
            <EmptyNote />
          ) : (
            <ul className="space-y-1 text-sm" style={textStyle}>
              {topics.map((t) => (
                <li key={t.query} className="flex justify-between gap-3">
                  <span className="min-w-0 break-words">
                    «{t.query}»
                    {t.page ? (
                      <span className="text-xs" style={mutedStyle}>
                        {' '}
                        → {t.page.replace(/^https?:\/\/[^/]+/, '')}
                      </span>
                    ) : null}
                  </span>
                  <span className="shrink-0 text-xs" style={mutedStyle}>
                    {fmtInt(t.impressions)} пок. · поз. {fmtPos(t.position)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card title="Показы без кликов (правка сниппета)">
          {outliers.length === 0 ? (
            <EmptyNote />
          ) : (
            <ul className="space-y-1 text-sm" style={textStyle}>
              {outliers.map((o) => (
                <li key={o.url} className="flex justify-between gap-3">
                  <span className="min-w-0 break-all">{o.url}</span>
                  <span className="shrink-0 text-xs" style={mutedStyle}>{fmtInt(o.impressions)} пок.</span>
                </li>
              ))}
            </ul>
          )}
          <p className="mt-3 text-xs" style={mutedStyle}>
            Страницы с кликами за любую из двух недель не показываются.
          </p>
        </Card>
      </div>

    </div>
  );
}
