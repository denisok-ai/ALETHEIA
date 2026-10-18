'use client';

/**
 * Лента согласования: группы по неделям, фильтры, карточка на каждый пункт плана.
 * Поведение повторяет образец docs/marketing/review/soglasovanie.html; вместо
 * window.claude db данные идут через /api/review/<token>/data и /decision.
 */
import { useEffect, useId, useMemo, useState } from 'react';
import styles from './review.module.css';

type Network = 'telegram' | 'max' | 'vk' | 'dzen' | string;
type Status = 'approved' | 'changes' | 'rejected';
type Filter = 'all' | 'video' | 'text' | 'open';

type Item = {
  id: string;
  date: string | null;
  order: number;
  kind: string;
  network: Network;
  title: string;
  titleVariants: string[];
  body: string;
  speech?: string;
  url?: string;
  ref?: string;
  durationSec?: number;
  videoUrl?: string;
  poster?: string;
  notes: string[];
  risks: string[];
  transcript?: string;
  lesson?: string;
  sourceTimecodes?: string;
};

type Decision = {
  status: Status;
  title: string;
  body: string;
  speech?: string;
  comment: string;
  updatedAt: string;
};

const NET: Record<string, string> = { telegram: 'Telegram', max: 'MAX', vk: 'ВКонтакте', dzen: 'Дзен' };
const KIND: Record<string, string> = {
  'video-queued': 'Ролик · уже в очереди',
  'video-candidate': 'Ролик · кандидат',
  'video-slot': 'Место под ролик',
  'video-script': 'Ролик · сценарий для записи',
  text: 'Текст',
};
const STATUS: Record<Status, { text: string; pill: string; card: string }> = {
  approved: { text: 'Согласовано', pill: 'pillOk', card: 'stApproved' },
  changes: { text: 'Нужны правки', pill: 'pillWarn', card: 'stChanges' },
  rejected: { text: 'Отклонено', pill: 'pillBad', card: 'stRejected' },
};
const WD = ['вс', 'пн', 'вт', 'ср', 'чт', 'пт', 'сб'];
const CANDIDATE_GROUP =
  'Ролики-кандидаты из курса: можно поставить вместо любого сценария или в дополнение';

const isVideo = (it: Item) => String(it.kind || '').startsWith('video');

function fmtDate(d: string | null): string {
  if (!d) return 'Дата позже';
  const t = new Date(d + 'T12:00:00+03:00');
  return `${WD[t.getDay()]} ${String(t.getDate()).padStart(2, '0')}.${String(t.getMonth() + 1).padStart(2, '0')}`;
}

function weekOf(d: string | null): string {
  if (!d) return 'Без даты';
  const t = new Date(d + 'T12:00:00+03:00');
  const day = (t.getDay() + 6) % 7;
  const mon = new Date(t);
  mon.setDate(t.getDate() - day);
  const sun = new Date(mon);
  sun.setDate(mon.getDate() + 6);
  const f = (x: Date) => `${x.getDate()}.${String(x.getMonth() + 1).padStart(2, '0')}`;
  return `Неделя ${f(mon)} — ${f(sun)}`;
}

function rowsFor(text: string, min: number, max: number): number {
  return Math.min(max, Math.max(min, Math.ceil((text.length || 1) / 70)));
}

function savedAt(iso: string): string {
  return (
    'Сохранено ' +
    new Date(iso).toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
  );
}

export default function ReviewBoard({ token }: { token: string }) {
  const [items, setItems] = useState<Item[] | null>(null);
  const [decisions, setDecisions] = useState<Record<string, Decision>>({});
  const [filter, setFilter] = useState<Filter>('all');
  const [loadFailed, setLoadFailed] = useState(false);

  useEffect(() => {
    let alive = true;
    fetch(`/api/review/${encodeURIComponent(token)}/data`, { cache: 'no-store' })
      .then((r) => {
        if (!r.ok) throw new Error(String(r.status));
        return r.json();
      })
      .then((d: { items: Item[]; decisions: Record<string, Decision> }) => {
        if (!alive) return;
        setItems(d.items);
        setDecisions(d.decisions);
      })
      .catch(() => {
        if (alive) setLoadFailed(true);
      });
    return () => {
      alive = false;
    };
  }, [token]);

  const tally = useMemo(() => {
    const c = { approved: 0, changes: 0, rejected: 0, open: 0 };
    for (const it of items ?? []) {
      const s = decisions[it.id]?.status;
      if (s) c[s]++;
      else c.open++;
    }
    return c;
  }, [items, decisions]);

  const shown = useMemo(() => {
    if (!items) return [];
    return items.filter(
      (it) =>
        filter === 'all' ||
        (filter === 'video' && isVideo(it)) ||
        (filter === 'text' && !isVideo(it)) ||
        (filter === 'open' && !decisions[it.id]?.status),
    );
  }, [items, decisions, filter]);

  const groups = useMemo(() => {
    const map = new Map<string, Item[]>();
    for (const it of shown) {
      const w = it.kind === 'video-candidate' ? CANDIDATE_GROUP : weekOf(it.date);
      if (!map.has(w)) map.set(w, []);
      map.get(w)!.push(it);
    }
    return [...map.entries()];
  }, [shown]);

  const filters: Array<[Filter, string]> = [
    ['all', 'Все'],
    ['video', 'Ролики'],
    ['text', 'Тексты'],
    ['open', 'Без решения'],
  ];

  let content: React.ReactNode;
  if (loadFailed) {
    content = <div className={styles.state}>План не загрузился. Обновите страницу.</div>;
  } else if (!items) {
    content = <div className={styles.state}>Загружаю план публикаций…</div>;
  } else if (items.length === 0) {
    content = (
      <div className={styles.state}>План ещё не загружен. Он появится здесь, как только будет готов.</div>
    );
  } else if (shown.length === 0) {
    content = <div className={styles.state}>В этом фильтре пусто.</div>;
  } else {
    content = groups.map(([title, arr]) => (
      <section key={title} className={styles.week}>
        <h2>{title}</h2>
        {arr.map((it) => (
          <ItemCard
            key={it.id}
            item={it}
            decision={decisions[it.id]}
            token={token}
            onSaved={(id, d) => setDecisions((prev) => ({ ...prev, [id]: d }))}
          />
        ))}
      </section>
    ));
  }

  return (
    <div className={styles.page}>
      <div className={styles.wrap}>
        <header className={styles.intro}>
          <h1>Согласование контента Аватэрры</h1>
          <p>
            План публикаций школы на 19 октября — 15 ноября: ролики из курса и тексты для Telegram, MAX,
            ВКонтакте и Дзена. Здесь можно посмотреть каждый пункт, поправить заголовок и текст и отметить
            решение. На свободных местах — короткие сценарии роликов на 20–30 секунд, которые можно записать
            на телефон: текст для чтения вслух тоже можно править.
          </p>
          <ol className={styles.how}>
            <li>Посмотрите ролик или прочитайте текст. Правьте прямо в полях.</li>
            <li>Нажмите «Согласовано», «Нужны правки» или «Отклонить». Правки и комментарий сохранятся вместе с решением.</li>
            <li>Решение можно поменять в любой момент. Публикуем только согласованное.</li>
          </ol>
          <p>
            Посты в Telegram и MAX заканчиваются ссылкой «Практикум «Тело знает всё» →» и хештегами — их
            добавляем сами, в тексте поста писать не нужно. Даты предварительные: публикация начнётся после
            подключения каналов.
          </p>
        </header>

        <div className={styles.bar} role="region" aria-label="Итоги и фильтры">
          <div className={styles.tally}>
            <span className={`${styles.pill} ${styles.pillOk}`}>Согласовано {tally.approved}</span>
            <span className={`${styles.pill} ${styles.pillWarn}`}>Правки {tally.changes}</span>
            <span className={`${styles.pill} ${styles.pillBad}`}>Отклонено {tally.rejected}</span>
            <span className={`${styles.pill} ${styles.pillWait}`}>Ждут {tally.open}</span>
          </div>
          <div className={styles.filters}>
            {filters.map(([key, label]) => (
              <button
                key={key}
                type="button"
                aria-pressed={filter === key}
                onClick={() => setFilter(key)}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <main>{content}</main>
      </div>
    </div>
  );
}

function ItemCard({
  item,
  decision,
  token,
  onSaved,
}: {
  item: Item;
  decision: Decision | undefined;
  token: string;
  onSaved: (id: string, d: Decision) => void;
}) {
  const uid = useId();
  const [title, setTitle] = useState(decision?.title ?? item.title ?? '');
  const [body, setBody] = useState(decision?.body ?? item.body ?? '');
  const [speech, setSpeech] = useState(decision?.speech ?? item.speech ?? '');
  const [comment, setComment] = useState(decision?.comment ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const video = isVideo(item) && !!item.videoUrl;
  const status = decision?.status;
  const statusInfo = status ? STATUS[status] : undefined;

  async function decide(next: Status) {
    setBusy(true);
    setError('');
    const payload: Record<string, unknown> = {
      id: item.id,
      status: next,
      title: title.trim(),
      body,
      comment: comment.trim(),
    };
    if (item.kind === 'video-script') payload.speech = speech;
    try {
      const r = await fetch(`/api/review/${encodeURIComponent(token)}/decision`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await r.json().catch(() => null);
      if (!r.ok) {
        setError(typeof data?.error === 'string' ? data.error : 'Не сохранилось, нажмите ещё раз.');
        return;
      }
      onSaved(item.id, data.decision as Decision);
    } catch {
      setError('Не сохранилось, нажмите ещё раз.');
    } finally {
      setBusy(false);
    }
  }

  const cardClass = [styles.card, statusInfo ? styles[statusInfo.card] : ''].filter(Boolean).join(' ');
  const idTitle = `${uid}-t`;
  const idSpeech = `${uid}-s`;
  const idBody = `${uid}-b`;
  const idComment = `${uid}-c`;

  const fields = (
    <div className={styles.fields}>
      <label htmlFor={idTitle} className={styles.label}>Заголовок</label>
      <input
        id={idTitle}
        type="text"
        className={styles.titleInput}
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        disabled={busy}
      />
      {item.titleVariants.length > 0 && (
        <div className={styles.variants}>
          {item.titleVariants.map((t) => (
            <button key={t} type="button" title="Взять этот вариант" onClick={() => setTitle(t)} disabled={busy}>
              {t}
            </button>
          ))}
        </div>
      )}

      {item.kind === 'video-script' && (
        <>
          <label htmlFor={idSpeech} className={styles.label}>Текст для чтения вслух</label>
          <textarea
            id={idSpeech}
            value={speech}
            onChange={(e) => setSpeech(e.target.value)}
            rows={rowsFor(speech, 4, 12)}
            disabled={busy}
          />
        </>
      )}

      {item.kind !== 'video-slot' && (
        <>
          <label htmlFor={idBody} className={styles.label}>
            {isVideo(item) ? 'Подпись к ролику' : 'Текст поста'}
          </label>
          <textarea
            id={idBody}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={rowsFor(body, 5, 16)}
            disabled={busy}
          />
        </>
      )}

      {item.url && <div className={styles.link}>Ссылка в посте: {item.url}</div>}

      {item.risks.length > 0 && (
        <ul className={styles.risks}>
          {item.risks.map((r) => (
            <li key={r}>{r}</li>
          ))}
        </ul>
      )}
      {item.notes.map((n) => (
        <p key={n} className={styles.notes}>{n}</p>
      ))}
      {item.transcript && (
        <details className={styles.details}>
          <summary>Что звучит в ролике</summary>
          <p>{item.transcript}</p>
        </details>
      )}
      {item.lesson && (
        <p className={styles.notes}>
          Из урока: {item.lesson}
          {item.sourceTimecodes ? ', ' + item.sourceTimecodes : ''}
        </p>
      )}

      <label htmlFor={idComment} className={styles.label}>Комментарий</label>
      <textarea
        id={idComment}
        className={styles.comment}
        placeholder="Что поправить или почему нет"
        value={comment}
        onChange={(e) => setComment(e.target.value)}
        disabled={busy}
      />

      <div className={styles.actions}>
        <button type="button" className={styles.bOk} onClick={() => decide('approved')} disabled={busy}>
          Согласовано
        </button>
        <button type="button" className={styles.bWarn} onClick={() => decide('changes')} disabled={busy}>
          Нужны правки
        </button>
        <button type="button" className={styles.bBad} onClick={() => decide('rejected')} disabled={busy}>
          Отклонить
        </button>
        <span className={styles.saved} role="status" aria-live="polite">
          {error || (busy ? 'Сохраняю…' : decision?.updatedAt ? savedAt(decision.updatedAt) : '')}
        </span>
      </div>
    </div>
  );

  return (
    <article className={cardClass} id={`item-${item.id}`}>
      <div className={styles.meta}>
        <span className={styles.date}>{fmtDate(item.date)}</span>
        <span className={styles.net}>{NET[item.network] ?? item.network}</span>
        <span>{KIND[item.kind] ?? item.kind}</span>
        {item.ref && <span className={styles.ref}>{item.ref}</span>}
        {item.durationSec ? <span>{Math.round(item.durationSec)} с</span> : null}
        {statusInfo && <span className={`${styles.pill} ${styles[statusInfo.pill]}`}>{statusInfo.text}</span>}
      </div>
      {video ? (
        <div className={styles.grid}>
          <video
            controls
            preload="none"
            playsInline
            src={item.videoUrl}
            poster={item.poster}
            aria-label={'Ролик: ' + (item.title || '')}
          />
          {fields}
        </div>
      ) : (
        fields
      )}
    </article>
  );
}
