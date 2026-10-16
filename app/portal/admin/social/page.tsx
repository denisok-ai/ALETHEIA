/**
 * Admin: соцсети — очередь постов, сети, пауза всех сетей, повтор и перенос (T3.8).
 * Данные из SocialPost / SocialNetwork / SocialRule; действия — клиентские компоненты SocialActions.tsx.
 */
import type { Metadata } from 'next';
import { requireAdminSession } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { PageHeader } from '@/components/portal/PageHeader';
import { formatMsk } from '@/lib/social/moscow-day';
import { PAUSE_ALL_RULE } from '@/lib/social/scheduler';
import { MODE_LABEL, postStatusLabel, toMskInputValue } from '@/lib/social/admin-actions';
import { NetworkToggle, PauseToggle, PostActions } from './SocialActions';

export const metadata: Metadata = { title: 'Соцсети' };
export const dynamic = 'force-dynamic';

const RECENT_LIMIT = 50;

const cardStyle = { background: 'var(--portal-surface, #fff)', borderColor: 'var(--portal-border, #E2E8F0)' };
const textStyle = { color: 'var(--portal-text)' };
const mutedStyle = { color: 'var(--portal-text-muted)' };
const errorStyle = { color: '#B91C1C' };

const STATUS_TONE: Record<string, { background: string; color: string }> = {
  scheduled: { background: '#E0F2FE', color: '#075985' },
  publishing: { background: '#FEF3C7', color: '#92400E' },
  published: { background: '#DCFCE7', color: '#166534' },
  failed: { background: '#FEE2E2', color: '#991B1B' },
  ready_post_sent: { background: '#EDE9FE', color: '#5B21B6' },
  skipped: { background: '#F1F5F9', color: '#475569' },
  draft: { background: '#F1F5F9', color: '#475569' },
};

function ExternalLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" className="underline break-all" style={textStyle}>
      {children}
    </a>
  );
}

function StatusBadge({ status }: { status: string }) {
  const tone = STATUS_TONE[status] ?? STATUS_TONE.draft;
  return (
    <span className="inline-block whitespace-nowrap rounded-md px-2 py-0.5 text-xs font-medium" style={tone}>
      {postStatusLabel(status)}
    </span>
  );
}

export default async function AdminSocialPage() {
  const auth = await requireAdminSession();
  if (!auth) {
    return (
      <PageHeader items={[{ label: 'Соцсети' }]} title="Соцсети" description="Требуется доступ администратора." />
    );
  }

  const now = new Date();
  const include = { item: { select: { title: true } } } as const;
  const [pauseRule, networks, upcoming, recent] = await Promise.all([
    prisma.socialRule.findUnique({ where: { key: PAUSE_ALL_RULE } }),
    prisma.socialNetwork.findMany({ orderBy: { code: 'asc' } }),
    prisma.socialPost.findMany({
      where: { scheduledAt: { gte: now } },
      orderBy: [{ scheduledAt: 'asc' }, { id: 'asc' }],
      include,
    }),
    prisma.socialPost.findMany({ orderBy: { id: 'desc' }, take: RECENT_LIMIT, include }),
  ]);

  const paused = pauseRule?.value === '1';

  // Сначала все будущие (по времени), затем последние RECENT_LIMIT по убыванию id; без дублей.
  const seen = new Set<number>();
  const queue: typeof recent = [];
  for (const p of [...upcoming, ...recent]) {
    if (seen.has(p.id)) continue;
    seen.add(p.id);
    queue.push(p);
  }

  return (
    <div className="w-full space-y-6">
      <PageHeader
        items={[{ href: '/portal/admin/dashboard', label: 'Дашборд' }, { label: 'Соцсети' }]}
        title="Соцсети"
        description="Очередь публикаций и сети. Время — МСК. Автопубликация раз в 10 минут; не больше одного поста в сеть за день."
        actions={<PauseToggle paused={paused} />}
      />

      {paused && (
        <div
          role="alert"
          className="rounded-xl border p-4 text-sm font-medium"
          style={{ background: '#FEF3C7', borderColor: '#F59E0B', color: '#92400E' }}
        >
          Пауза всех сетей включена: планировщик ничего не публикует, посты остаются в очереди.
        </div>
      )}

      <section aria-labelledby="social-networks-title">
        <h2 id="social-networks-title" className="mb-3 text-sm font-semibold" style={textStyle}>
          Сети
        </h2>
        {networks.length === 0 ? (
          <div className="rounded-xl border p-4 text-sm" style={{ ...cardStyle, ...mutedStyle }}>
            Сетей пока нет.
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {networks.map((n) => (
              <article key={n.id} className="space-y-3 rounded-xl border p-4" style={cardStyle}>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h3 className="text-base font-semibold" style={textStyle}>
                      {n.title}
                    </h3>
                    <p className="text-xs" style={mutedStyle}>
                      код: {n.code} · {n.enabled ? 'включена' : 'выключена'}
                    </p>
                  </div>
                  <NetworkToggle code={n.code} enabled={n.enabled} />
                </div>
                <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm" style={textStyle}>
                  <dt style={mutedStyle}>Режим</dt>
                  <dd>{MODE_LABEL[n.mode] ?? n.mode}</dd>
                  <dt style={mutedStyle}>Chat id</dt>
                  <dd className="break-all font-mono text-xs">{n.chatId ?? '—'}</dd>
                  <dt style={mutedStyle}>Ошибок подряд</dt>
                  <dd>{n.failStreak}</dd>
                  <dt style={mutedStyle}>Профиль</dt>
                  <dd>{n.profileUrl ? <ExternalLink href={n.profileUrl}>{n.profileUrl}</ExternalLink> : '—'}</dd>
                </dl>
                {n.lastError && (
                  <p className="break-words text-xs" style={errorStyle}>
                    Последняя ошибка: {n.lastError}
                  </p>
                )}
              </article>
            ))}
          </div>
        )}
      </section>

      <section aria-labelledby="social-queue-title" className="space-y-3">
        <h2 id="social-queue-title" className="text-sm font-semibold" style={textStyle}>
          Очередь: все будущие и последние {RECENT_LIMIT}
        </h2>
        {queue.length === 0 ? (
          <div className="rounded-xl border p-4 text-sm" style={{ ...cardStyle, ...mutedStyle }}>
            Очередь пуста.
          </div>
        ) : (
          <div className="overflow-x-auto rounded-xl border" style={cardStyle}>
            <table className="w-full min-w-[720px] border-collapse text-left text-sm">
              <thead>
                <tr className="border-b text-xs" style={{ ...mutedStyle, borderColor: 'var(--portal-border, #E2E8F0)' }}>
                  <th className="px-3 py-2 font-medium">Время (МСК)</th>
                  <th className="px-3 py-2 font-medium">Сеть</th>
                  <th className="px-3 py-2 font-medium">Статус</th>
                  <th className="px-3 py-2 font-medium">Попытки</th>
                  <th className="px-3 py-2 font-medium">Материал</th>
                  <th className="px-3 py-2 font-medium">Пост</th>
                  <th className="px-3 py-2 font-medium">Действия</th>
                </tr>
              </thead>
              <tbody>
                {queue.map((p) => {
                  const when = p.scheduledAt ?? p.publishedAt;
                  return (
                    <tr
                      key={p.id}
                      className="border-b align-top"
                      style={{ borderColor: 'var(--portal-border, #E2E8F0)', ...textStyle }}
                    >
                      <td className="whitespace-nowrap px-3 py-2">{when ? formatMsk(when) : '—'}</td>
                      <td className="px-3 py-2">{p.networkCode}</td>
                      <td className="px-3 py-2">
                        <StatusBadge status={p.status} />
                      </td>
                      <td className="px-3 py-2">{p.attempts}</td>
                      <td className="px-3 py-2">
                        <div className="max-w-xs break-words">{p.item.title}</div>
                        {p.refCode && (
                          <div className="text-xs" style={mutedStyle}>
                            ref: {p.refCode}
                          </div>
                        )}
                        <details className="mt-1 text-xs">
                          <summary className="cursor-pointer" style={mutedStyle}>
                            Подпись
                          </summary>
                          <p className="mt-1 max-w-md whitespace-pre-wrap break-words">{p.caption || '—'}</p>
                        </details>
                      </td>
                      <td className="px-3 py-2">
                        {p.externalUrl ? (
                          <ExternalLink href={p.externalUrl}>Открыть</ExternalLink>
                        ) : (
                          '—'
                        )}
                        {p.error && (
                          <p className="mt-1 max-w-xs break-words text-xs" style={errorStyle}>
                            {p.error}
                          </p>
                        )}
                      </td>
                      <td className="px-3 py-2">
                        <PostActions
                          id={p.id}
                          status={p.status}
                          scheduledInput={toMskInputValue(p.scheduledAt)}
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
