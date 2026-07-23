/**
 * SEO-заголовки и описания для статей блога, у которых title обрезается в выдаче.
 *
 * Аудит 23.07.2026: 14 статей имели title длиннее 65 символов (с суффиксом
 * «| АВАТЕРРА»), у перенесённых из Telegram заголовком служило первое
 * предложение поста — до 172 символов, по таким запросам никто не ищет.
 *
 * Меняются ТОЛЬКО title и (где задано) description — SEO-обёртка страницы.
 * h1 и текст статьи не трогаем: контент переносится из канала «один в один»
 * по решению владельца, а h1 — часть этого контента.
 *
 * Запуск: npx tsx scripts/blog-fix-seo-titles.ts [--dry]
 */
import { prisma } from '../lib/db';
import { pingIndexNow } from '../lib/indexnow';

const FIXES: Array<{ slug: string; title: string; description?: string }> = [
  // Статьи из базы знаний — синхронно с lib/content/kb-seo-articles.ts
  { slug: 'myshechnoe-testirovanie-obuchenie', title: 'Обучение мышечному тестированию с нуля' },
  { slug: 'karta-emotsiy', title: 'Карта эмоций: как понять свои чувства' },
  { slug: 'myshechnoe-testirovanie-dlya-psihologov', title: 'Мышечное тестирование для психологов и коучей' },
  { slug: 'zhizn-na-avtopilote', title: 'Жизнь на автопилоте: как выйти и вернуться к себе' },
  { slug: 'kak-vybrat-kurs-avaterra', title: 'Как выбрать курс: «Тело не врёт» или «Пробуждение»' },

  // Перенесённые из Telegram: заголовок-предложение → заголовок-запрос
  {
    slug: 'byvaet-chto-nedelya-proletaet-tak-bystro-chto-k-vecheru',
    title: 'Забота о себе, когда нет времени',
    description:
      'Неделя пролетает, а тело где-то далеко? Почему для контакта с собой не нужен целый час в день и с каких микропрактик начать.',
  },
  {
    slug: 'v-seredine-dnya-vy-vdrug-lovite-sebya-na-tom-chto-chelyust',
    title: 'Зажатая челюсть и поднятые плечи: откуда напряжение',
    description:
      'Вы просто сидите за столом, а тело в защитной реакции: почему челюсть сжимается без видимой причины и как снять застывшее напряжение.',
  },
  {
    slug: 'vy-kogda-nibud-zamechali-kak-mnogo-my-znaem-no-kak-malo',
    title: 'Почему знания не меняют жизнь: телесный опыт',
    description:
      'Десятки книг и курсов, а тело живёт по старым сценариям. Почему знание без телесного опыта остаётся информацией и что с этим делать.',
  },
  {
    slug: 'vy-sidite-za-stolom-pete-chay-i-odnovremenno-chitaete',
    title: 'Практика присутствия за чашкой чая',
    description:
      'Минутная практика осознанности за обычным чаепитием: как вернуть внимание в тело, не выделяя отдельное время на медитацию.',
  },
  {
    slug: 'vy-zamechali-chto-dazhe-posle-otpuska-ili-vyhodnyh',
    title: 'Почему напряжение не уходит даже после отдыха',
    description:
      'Отпуск прошёл, а плечи приподняты и в груди тяжесть? Это след стресса, который остаётся в теле, — и вот как с ним работать.',
  },
  {
    slug: 'vy-zamechali-chto-prozhivaete-den-a-vecherom-s-trudom',
    title: 'День прошёл, а вспомнить нечего: режим автопилота',
    description:
      'Кофе, работа, диван, телефон — и так по кругу. Как распознать состояние автопилота и вернуть ощущение, что жизнь происходит с вами.',
  },

  // Просто длинные — укоротить
  { slug: 'kurs-telo-ne-vret-eto-obuchenie-myshechnomu-testirovaniyu', title: 'Курс «Тело не врёт»: чему учит и кому подходит' },
  { slug: 'probuzhdenie-21-den-osoznannosti', title: 'Курс «Пробуждение»: 21 день практик осознанности' },
  { slug: 'pochemu-problemy-vozvrashautysya', title: 'Почему проблемы возвращаются: заряд в теле' },
];

async function main() {
  const dry = process.argv.includes('--dry');
  const changed: string[] = [];

  for (const f of FIXES) {
    const post = await prisma.blogPost.findUnique({
      where: { slug: f.slug },
      select: { id: true, title: true, description: true },
    });
    if (!post) {
      console.log(`  ? нет статьи: ${f.slug}`);
      continue;
    }
    const data: { title: string; description?: string } = { title: f.title };
    if (f.description) data.description = f.description;
    if (post.title === f.title && (!f.description || post.description === f.description)) continue;
    if (!dry) await prisma.blogPost.update({ where: { id: post.id }, data });
    changed.push(f.slug);
    console.log(`  ✎ ${f.slug}\n      «${post.title.slice(0, 60)}…» → «${f.title}»`);
  }

  console.log(`\nОбновлено: ${changed.length}${dry ? ' (проверка, без записи)' : ''}`);

  if (!dry && changed.length > 0) {
    const row = await prisma.systemSetting.findUnique({ where: { key: 'site_url' } });
    const base = (row?.value || '').trim().replace(/\/$/, '');
    if (base.startsWith('https://') && !base.includes('localhost')) {
      const r = await pingIndexNow(base, [
        ...changed.map((s) => `${base}/blog/${s}`),
        `${base}/blog`,
      ]);
      console.log(`IndexNow: ${r.ok ? `принято (HTTP ${r.status})` : 'НЕ доставлено'}`);
    }
  }
  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
