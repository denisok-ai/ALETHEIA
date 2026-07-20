import type { Metadata } from 'next';
import Link from 'next/link';
import { getSystemSettings } from '@/lib/settings';
import { buildPublicPageMetadata } from '@/lib/seo/metadata-helpers';
import { DEFAULT_OG_IMAGE_PATH } from '@/lib/seo/pages';
import { normalizeSiteUrl } from '@/lib/site-url';
import { getPdnOperatorPublic } from '@/lib/pdn-public';
import { PDN_DOCS_VERSION } from '@/lib/consent-log';

const DESCRIPTION =
  'Текст согласия на обработку персональных данных для пользователей сайта AVATERRA (avaterra.pro).';

export async function generateMetadata(): Promise<Metadata> {
  const settings = await getSystemSettings();
  const base = normalizeSiteUrl(settings.site_url || 'https://avaterra.pro').replace(/\/$/, '');
  const canonical = `${base}/pd-consent`;
  return {
    ...buildPublicPageMetadata({
      title: 'Согласие на обработку персональных данных',
      description: DESCRIPTION,
      canonical,
      ogImageUrl: `${base}${DEFAULT_OG_IMAGE_PATH}`,
    }),
  };
}

/**
 * Отдельный документ — шаблон согласия на обработку ПДн (152-ФЗ). Фиксируется отметкой на формах и в журнале ConsentLog.
 */
export default function PdConsentPage() {
  const op = getPdnOperatorPublic();
  const site = 'https://avaterra.pro';

  return (
    <div className="mx-auto max-w-3xl px-4 py-16 font-body">
      <h1 className="font-heading text-3xl font-semibold text-[var(--text)]">
        Согласие на обработку персональных данных
      </h1>
      <p className="mt-2 text-sm text-[var(--text-muted)]">
        Редакция документов: {PDN_DOCS_VERSION}. Актуальная политика:{' '}
        <Link href="/privacy" className="text-plum underline hover:opacity-90">
          /privacy
        </Link>
        .
      </p>

      <div className="mt-10 max-w-[var(--prose-max-width)] space-y-6 leading-[var(--leading-body)] text-[var(--text)]">
        <p>
          Настоящим я, пользователь сайта <strong>{site}</strong>, действуя свободно, своей волей и в своём интересе,
          даю согласие <strong>{op.name}</strong>
          {op.inn ? ` (ИНН ${op.inn})` : ''}
          {op.ogrnip ? `, ОГРНИП ${op.ogrnip}` : ''}
          {op.address ? `, зарегистрированному по адресу: ${op.address}` : ''} (далее — Оператор), на обработку моих
          персональных данных на следующих условиях.
        </p>

        <section>
          <h2 className="font-heading text-xl font-semibold text-[var(--text)]">1. Перечень персональных данных</h2>
          <p className="mt-2">Оператор вправе обрабатывать следующие данные, которые я указываю на Сайте:</p>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            <li>фамилия, имя, отчество (при указании) или иное имя;</li>
            <li>контактный телефон;</li>
            <li>адрес электронной почты;</li>
            <li>иные сведения, сообщаемые мной в формах, комментариях, обращениях;</li>
            <li>технические данные, автоматически получаемые при использовании Сайта (IP-адрес, cookie и т.п.).</li>
          </ul>
        </section>

        <section>
          <h2 className="font-heading text-xl font-semibold text-[var(--text)]">
            2. Цели и действия с персональными данными
          </h2>
          <p className="mt-2">
            Обработка осуществляется в целях: обработки заявок; связи со мной; регистрации и работы личного кабинета;
            заключения, исполнения и сопровождения договоров на оказание услуг; приёма оплат; предоставления доступа к
            материалам курса; направления сервисных уведомлений; обработки обращений в поддержку; обеспечения безопасности
            Сайта; улучшения работы Сайта (при отдельном согласии на аналитические cookie); исполнения требований
            законодательства РФ.
          </p>
          <p className="mt-2">
            Оператор вправе совершать действия: сбор, запись, систематизацию, накопление, хранение, уточнение,
            использование, передачу (предоставление, доступ) — в объёме, необходимом для указанных целей, а также
            обезличивание, блокирование, удаление и уничтожение персональных данных.
          </p>
        </section>

        <section>
          <h2 className="font-heading text-xl font-semibold text-[var(--text)]">3. Срок действия согласия</h2>
          <p className="mt-2">
            Согласие действует до достижения целей обработки, отзыва согласия субъектом или до истечения сроков хранения,
            установленных законодательством РФ, в зависимости от того, какое событие наступит ранее, если иное не
            предусмотрено договором.
          </p>
        </section>

        <section>
          <h2 className="font-heading text-xl font-semibold text-[var(--text)]">4. Отзыв согласия</h2>
          <p className="mt-2">
            Я вправе отозвать согласие, направив Оператору обращение на email{' '}
            <a href={`mailto:${op.dpoEmail}`} className="text-plum underline hover:opacity-90">
              {op.dpoEmail}
            </a>
            {op.address ? ` или по почтовому адресу ${op.address}` : ''}. Отзыв не влияет на законность обработки до
            момента отзыва.
          </p>
        </section>

        <section>
          <h2 className="font-heading text-xl font-semibold text-[var(--text)]">5. Ознакомление с Политикой</h2>
          <p className="mt-2">
            Я подтверждаю, что ознакомлен(а) с{' '}
            <Link href="/privacy" className="text-plum underline hover:opacity-90">
              Политикой в отношении обработки персональных данных
            </Link>
            , размещённой на Сайте.
          </p>
        </section>
      </div>

      <Link href="/" className="mt-12 inline-block text-[#D4AF37] hover:underline">
        ← На главную
      </Link>
    </div>
  );
}
