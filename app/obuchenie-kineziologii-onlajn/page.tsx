import type { Metadata } from 'next';
import Link from 'next/link';
import { Breadcrumbs } from '@/components/Breadcrumbs';
import { JsonLdBreadcrumbList } from '@/components/JsonLdBreadcrumbList';
import { JsonLdFaqPage } from '@/components/JsonLdFaqPage';
import { getSystemSettings } from '@/lib/settings';
import { buildPublicPageMetadata } from '@/lib/seo/metadata-helpers';
import { DEFAULT_OG_IMAGE_PATH } from '@/lib/seo/pages';
import { normalizeSiteUrl } from '@/lib/site-url';
import { botDeepLink } from '@/lib/social-links';

/**
 * Посадочная под региональный спрос («обучение кинезиологии Москва»,
 * «курсы кинезиологии онлайн», «терра москва обучение кинезиологии» — первый
 * такой запрос появился в Вебмастере 09.2026).
 *
 * Честно: школа онлайн, очного адреса нет — города перечислены как места,
 * откуда учатся, а не как филиалы. Факты — только из материалов школы
 * (lib/content/course-mt-landing.ts, content/knowledge/avaterra.yaml).
 * Без цен (меняются на витрине) и без медицинских обещаний.
 */

const PATH = '/obuchenie-kineziologii-onlajn';
const TITLE = 'Обучение кинезиологии онлайн — из Москвы и любого города';
const DESCRIPTION =
  'Онлайн-обучение прикладной кинезиологии и мышечному тестированию в школе Аватэрра: 6 модулей, живые занятия с куратором, доступ из Москвы, Петербурга, любого города и страны.';

const CITIES = ['Москва', 'Санкт-Петербург', 'Екатеринбург', 'Новосибирск', 'Казань', 'Краснодар', 'Нижний Новгород', 'Самара'];

const FAQ: { q: string; a: string }[] = [
  {
    q: 'Есть ли у школы очные занятия в Москве?',
    a: 'Нет, школа Аватэрра работает онлайн: уроки в личном кабинете, живые занятия с куратором и встречи с автором методики — по видеосвязи. Поэтому учиться можно из Москвы, из любого другого города и из-за рубежа.',
  },
  {
    q: 'Можно ли освоить мышечное тестирование онлайн?',
    a: 'Да. Метод начинается с работы на себе — есть техники самотестирования без партнёра. Ошибки разбираются на живых занятиях с куратором, где вы показываете тест и получаете обратную связь.',
  },
  {
    q: 'Сколько длится обучение и в каком темпе?',
    a: 'Курс «Тело не врёт» — 6 модулей, доступ к материалам на 3 месяца. Уроки проходите в своём темпе, с любого устройства; живые занятия с куратором идут раз в неделю.',
  },
  {
    q: 'Дают ли сертификат?',
    a: 'Да: на тарифах с живыми сессиями после финального теста вы получаете электронный сертификат школы о прохождении курса.',
  },
  {
    q: 'Подойдёт ли обучение, если есть проблемы со здоровьем?',
    a: 'Метод работает со стрессом и эмоциональными реакциями — мы не лечим и не ставим диагнозы. При острой боли, травме, выраженной тревоге или других острых состояниях сначала обратитесь к врачу или психотерапевту.',
  },
];

export async function generateMetadata(): Promise<Metadata> {
  const settings = await getSystemSettings();
  const base = normalizeSiteUrl(settings.site_url || 'https://avaterra.pro').replace(/\/$/, '');
  return {
    ...buildPublicPageMetadata({
      // Бренд добавит шаблон layout — иначе двойной суффикс
      title: TITLE,
      description: DESCRIPTION,
      canonical: `${base}${PATH}`,
      ogImageUrl: `${base}${DEFAULT_OG_IMAGE_PATH}`,
    }),
  };
}

const linkClass = 'font-medium text-plum underline-offset-2 hover:underline';

export default async function OnlineKinesiologyPage() {
  const settings = await getSystemSettings();
  const base = normalizeSiteUrl(settings.site_url || 'https://avaterra.pro').replace(/\/$/, '');
  const pageUrl = `${base}${PATH}`;

  return (
    <>
      <JsonLdBreadcrumbList
        items={[
          { name: 'Главная', url: `${base}/` },
          { name: 'Обучение кинезиологии онлайн', url: pageUrl },
        ]}
      />
      <JsonLdFaqPage items={FAQ} />
      <main className="mx-auto max-w-3xl px-4 pb-16 pt-20 font-body md:pt-24">
        <Breadcrumbs items={[{ label: 'Главная', href: '/' }, { label: 'Обучение кинезиологии онлайн' }]} />
        <h1 className="font-heading text-3xl font-semibold text-[var(--text)] sm:text-4xl">
          Обучение кинезиологии онлайн — из Москвы и любого города
        </h1>
        <p className="mt-4 leading-relaxed text-[var(--text-muted)]">
          Школа Аватэрра учит прикладной кинезиологии и мышечному тестированию онлайн. Очного офиса у нас нет — и это
          осознанно: уроки, живые занятия с куратором и встречи с автором методики проходят по видеосвязи, поэтому
          учиться одинаково удобно из Москвы, другого города или из-за рубежа.
        </p>

        <section className="mt-10">
          <h2 className="font-heading text-2xl font-semibold text-[var(--text)]">Как устроено обучение</h2>
          <ul className="mt-4 list-disc space-y-2 pl-5 text-[var(--text-muted)]">
            <li>6 модулей курса «Тело не врёт»: видео, тексты, практики и тесты в личном кабинете.</li>
            <li>6 живых занятий с куратором раз в неделю и 2 встречи с автором методики — разбор ваших тестов и ситуаций.</li>
            <li>Доступ к материалам на 3 месяца, с любого устройства, в своём темпе.</li>
            <li>Электронный сертификат школы после финального теста — на тарифах с живыми сессиями.</li>
          </ul>
          <p className="mt-4 text-[var(--text-muted)]">
            Программа, форматы и условия — на{' '}
            <Link href="/course/navyki-myshechnogo-testirovaniya" className={linkClass}>
              странице курса «Тело не врёт»
            </Link>
            . Если ближе мягкий вход через практики присутствия — посмотрите{' '}
            <Link href="/course/probuzhdenie" className={linkClass}>
              «Пробуждение»
            </Link>{' '}
            (3 недели, около 15 минут в день).
          </p>
        </section>

        <section className="mt-10">
          <h2 className="font-heading text-2xl font-semibold text-[var(--text)]">Почему мышечное тестирование можно освоить онлайн</h2>
          <p className="mt-4 leading-relaxed text-[var(--text-muted)]">
            Навык начинается с работы на себе: для первых шагов не нужен второй человек — есть{' '}
            <Link href="/blog/myshechnoe-testirovanie-na-sebe" className={linkClass}>
              техники самотестирования
            </Link>
            . Перед каждым тестом проводится{' '}
            <Link href="/glossary/sverka-balansa" className={linkClass}>
              сверка баланса
            </Link>
            , а ошибки разбираются на живых занятиях: вы показываете тест, куратор даёт обратную связь. Термины, которые
            встречаются в курсе, собраны в{' '}
            <Link href="/glossary" className={linkClass}>
              глоссарии
            </Link>
            .
          </p>
        </section>

        <section className="mt-10">
          <h2 className="font-heading text-2xl font-semibold text-[var(--text)]">Откуда у нас учатся</h2>
          <p className="mt-4 leading-relaxed text-[var(--text-muted)]">
            {CITIES.join(', ')} — и другие города и страны. Обучение на русском языке; для занятий нужны интернет и
            видеосвязь.
          </p>
        </section>

        <section className="mt-10">
          <h2 className="font-heading text-2xl font-semibold text-[var(--text)]">Честные границы метода</h2>
          <p className="mt-4 leading-relaxed text-[var(--text-muted)]">
            Мы не лечим и не заменяем врача или психотерапевта: метод работает со стрессом и эмоциональными реакциями.
            Кому он подходит и когда сначала нужен врач — в{' '}
            <Link href="/blog/myshechnoe-testirovanie-komu-podhodit-i-kogda-nuzhen-vrach" className={linkClass}>
              отдельной статье
            </Link>
            .
          </p>
        </section>

        <section className="mt-10">
          <h2 className="font-heading text-2xl font-semibold text-[var(--text)]">Частые вопросы</h2>
          <div className="mt-4 space-y-3">
            {FAQ.map((item) => (
              <details key={item.q} className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4">
                <summary className="cursor-pointer font-heading font-medium text-[var(--text)]">{item.q}</summary>
                <p className="mt-3 leading-relaxed text-[var(--text-muted)]">{item.a}</p>
              </details>
            ))}
          </div>
        </section>

        <section className="mt-10 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5">
          <p className="text-[var(--text)]">
            Остались вопросы о формате или о том, подойдёт ли вам метод? Задайте их{' '}
            <a href={botDeepLink('online-landing')} className={linkClass} rel="noopener">
              в Telegram-боте школы
            </a>{' '}
            — ответ придёт сразу, а сложные вопросы бот передаст куратору.
          </p>
        </section>
      </main>
    </>
  );
}
