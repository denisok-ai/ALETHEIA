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
import { currentAcqRef } from '@/lib/social/current-ref';

/**
 * Посадочная под региональный спрос («обучение кинезиологии Москва»,
 * «курсы кинезиологии онлайн» — запросы из Вебмастера, 09.2026).
 *
 * Поисковая фраза «обучение кинезиологии онлайн» стоит только в title и description.
 * В тексте страницы — самостоятельный формат практикума «Тело знает всё»:
 * без кураторов и живых занятий, в своём темпе.
 *
 * Честно: школа онлайн, очного адреса нет — города перечислены как места,
 * откуда занимаются, а не как филиалы. Без цен (меняются на витрине) и без
 * медицинских обещаний.
 */

const PATH = '/obuchenie-kineziologii-onlajn';
const TITLE = 'Обучение кинезиологии онлайн — из Москвы и любого города';
const DESCRIPTION =
  'Обучение кинезиологии онлайн в школе Аватэрра: практикум мышечного тестирования для самостоятельного освоения — 6 модулей, доступ 3 месяца, из Москвы, Петербурга, любого города и страны.';

const CITIES = ['Москва', 'Санкт-Петербург', 'Екатеринбург', 'Новосибирск', 'Казань', 'Краснодар', 'Нижний Новгород', 'Самара'];

const FAQ: { q: string; a: string }[] = [
  {
    q: 'Есть ли у школы очные занятия в Москве?',
    a: 'Нет, школа Аватэрра работает онлайн: практикум проходит в личном кабинете и доступен с любого устройства. Поэтому заниматься можно из Москвы, из любого другого города и из-за рубежа.',
  },
  {
    q: 'Можно ли освоить мышечное тестирование онлайн?',
    a: 'Да. Метод начинается с работы на себе — есть техники самотестирования без партнёра. Видео, тексты, чек-листы и аудиопрактики — в личном кабинете, а вопросы по материалам задаёт помощник в кабинете.',
  },
  {
    q: 'Сколько длится практикум и в каком темпе его проходить?',
    a: 'Практикум «Тело знает всё» — 6 модулей, доступ 3 месяца с момента оплаты. Занимайтесь в своём темпе, с любого устройства. Кураторов и живых занятий в практикуме нет.',
  },
  {
    q: 'Есть ли сертификат?',
    a: 'Нет. Практикум — самостоятельное освоение материалов в своём темпе, без проверочных заданий и сертификата.',
  },
  {
    q: 'Подойдёт ли практикум, если есть проблемы со здоровьем?',
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
  const acqRef = await currentAcqRef();
  const base = normalizeSiteUrl(settings.site_url || 'https://avaterra.pro').replace(/\/$/, '');
  const pageUrl = `${base}${PATH}`;

  return (
    <>
      <JsonLdBreadcrumbList
        items={[
          { name: 'Главная', url: `${base}/` },
          { name: 'Кинезиология онлайн', url: pageUrl },
        ]}
      />
      <JsonLdFaqPage items={FAQ} />
      <main className="mx-auto max-w-3xl px-4 pb-16 pt-20 font-body md:pt-24">
        <Breadcrumbs items={[{ label: 'Главная', href: '/' }, { label: 'Кинезиология онлайн' }]} />
        <h1 className="font-heading text-3xl font-semibold text-[var(--text)] sm:text-4xl">
          Освоить мышечное тестирование самостоятельно — из Москвы и любого города
        </h1>
        <p className="mt-4 leading-relaxed text-[var(--text-muted)]">
          Школа Аватэрра предлагает практикум по прикладной кинезиологии и мышечному тестированию. Очного офиса у нас
          нет — и это осознанно: практикум проходит онлайн. Короткие уроки, практика и помощник по материалам в личном
          кабинете, поэтому заниматься одинаково удобно из Москвы, другого города или из-за рубежа.
        </p>

        <section className="mt-10">
          <h2 className="font-heading text-2xl font-semibold text-[var(--text)]">Как устроен практикум</h2>
          <ul className="mt-4 list-disc space-y-2 pl-5 text-[var(--text-muted)]">
            <li>6 модулей практикума «Тело знает всё»: видео, тексты, чек-листы и аудиопрактики в личном кабинете.</li>
            <li>Самостоятельно, в своём темпе: без кураторов и живых занятий.</li>
            <li>Помощник по материалам в личном кабинете отвечает на вопросы по урокам.</li>
            <li>Доступ 3 месяца с момента оплаты, с любого устройства.</li>
          </ul>
          <p className="mt-4 text-[var(--text-muted)]">
            Программа и условия — на{' '}
            <Link href="/course/navyki-myshechnogo-testirovaniya" className={linkClass}>
              странице практикума «Тело знает всё»
            </Link>
            , там же — лист ожидания личной работы с мастером. Если ближе мягкий вход через практики присутствия,
            посмотрите{' '}
            <Link href="/course/probuzhdenie" className={linkClass}>
              «Пробуждение»
            </Link>{' '}
            (3 недели, около 15 минут в день).
          </p>
        </section>

        <section className="mt-10">
          <h2 className="font-heading text-2xl font-semibold text-[var(--text)]">Почему мышечное тестирование можно освоить самостоятельно</h2>
          <p className="mt-4 leading-relaxed text-[var(--text-muted)]">
            Навык начинается с работы на себе: для первых шагов не нужен второй человек — есть{' '}
            <Link href="/blog/myshechnoe-testirovanie-na-sebe" className={linkClass}>
              техники самотестирования
            </Link>
            . Перед каждым тестом проводится{' '}
            <Link href="/glossary/sverka-balansa" className={linkClass}>
              сверка баланса
            </Link>
            , а разбор ошибок и типичных вопросов собран в материалах практикума. Термины, которые встречаются в
            курсе, собраны в{' '}
            <Link href="/glossary" className={linkClass}>
              глоссарии
            </Link>
            .
          </p>
        </section>

        <section className="mt-10">
          <h2 className="font-heading text-2xl font-semibold text-[var(--text)]">Откуда у нас занимаются</h2>
          <p className="mt-4 leading-relaxed text-[var(--text-muted)]">
            {CITIES.join(', ')} — и другие города и страны. Практикум на русском языке; для занятий нужны интернет и
            устройство с экраном.
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
            <a href={botDeepLink('online-landing', { ref: acqRef })} className={linkClass} rel="noopener">
              в Telegram-боте школы
            </a>{' '}
            — ответ придёт сразу. Личная работа с мастером — по листу ожидания на странице практикума.
          </p>
        </section>
      </main>
    </>
  );
}
