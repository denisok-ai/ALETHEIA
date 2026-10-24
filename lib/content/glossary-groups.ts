/**
 * Хаб словаря /glossary: вводный текст и разбиение терминов по темам (подзаголовки H2).
 *
 * Зачем: аудит Google (docs/seo/google-seo-playbook-2026-10-24.md) — хаб «обнаружен, но не
 * проиндексирован»: плоский список терминов без текста. Здесь — вводный текст и темы.
 * Сами термины (название, short, body) — в lib/content/glossary.ts, его не меняем здесь.
 *
 * Правило: каждый slug из GLOSSARY_TERMS стоит ровно в одной теме; несуществующих slug нет.
 * Проверяет tests/unit/glossary-hub.test.ts — новый термин добавляется сюда же.
 */

export type GlossaryGroup = {
  /** Подзаголовок H2 на хабе. Без частицы «не». */
  title: string;
  /** Slug терминов из GLOSSARY_TERMS; внутри темы выводятся по алфавиту термина. */
  slugs: readonly string[];
};

export const GLOSSARY_GROUPS: readonly GlossaryGroup[] = [
  {
    title: 'Мышечный тест и техника',
    slugs: [
      'myshechnoe-testirovanie',
      'prikladnaya-kineziologiya',
      'sverka-balansa',
      'indikatornaya-myshtsa',
      'samotestirovanie',
      'kolco-v-kolce',
      'otvet-tela',
    ],
  },
  {
    title: 'Тело и подсознание',
    slugs: [
      'telesnaya-pamyat',
      'obratnaya-svyaz-tela',
      'podsoznanie',
      'ustanovka',
      'stress-reaktsiya',
      'psihosomatika',
      'trigger',
    ],
  },
  {
    title: 'Эмоции и стресс',
    slugs: [
      'emotsionalnyy-zaryad',
      'karta-emotsiy',
      'vnutrenniy-konflikt',
      'vtorichnaya-vygoda',
      'strah-proyavlyatsya',
      'regress',
    ],
  },
  {
    title: 'Практики и состояния',
    slugs: ['lobnyy-obhvat', 'praktika-prisutstviya', 'zazemlenie', 'resursnoe-sostoyanie', 'avtopilot'],
  },
  {
    title: 'Курсы и школа',
    slugs: ['kineziolog', 'granitsy-podhoda', 'kurs-telo-znaet-vse', 'kurs-probuzhdenie', 'tatyana-streltsova'],
  },
];

/**
 * Вводный текст хаба под H1 (Markdown: абзацы и внутренние ссылки).
 * 120–200 слов без разметки — проверяет тест. Оговорка про лечение и диагнозы — обязательна.
 */
export const GLOSSARY_HUB_INTRO = `Словарь собирает термины, которые встречаются в статьях и курсах школы Аватэрра: мышечное тестирование и связанные с ним понятия, телесные практики, работа со стрессом и эмоциями. Каждое определение короткое и честное: что термин значит в подходе школы, где его границы и что здесь не обещают.

Пользоваться словарём удобно по темам: они идут ниже, внутри темы термины расположены по алфавиту. Открыв страницу термина, вы найдёте подробное объяснение, частые вопросы и ссылки на статьи и курс.

Новичку стоит начать с четырёх понятий. [Мышечное тестирование](/glossary/myshechnoe-testirovanie) объясняет сам принцип, [самотестирование](/glossary/samotestirovanie) показывает, как проверить себя без партнёра, [ответ тела «да» и «нет»](/glossary/otvet-tela) расшифровывает сигнал, а [эмоциональный заряд](/glossary/emotsionalnyy-zaryad) помогает понять силу переживания.

Системно технику разбирают в практикуме [«Тело знает всё»](/course/navyki-myshechnogo-testirovaniya): он идёт в вашем темпе, без живых занятий, и учит работать с откликом тела.

Важная оговорка. Школа не лечит и не ставит диагнозов, а подход не заменяет врача и психотерапевта. Научного подтверждения точности мышечного теста пока нет, поэтому любой результат — повод присмотреться к себе, а не окончательный вывод.`;
