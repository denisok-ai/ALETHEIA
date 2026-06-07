/**
 * Лендинг «Пробуждение» (/course/probuzhdenie) —
 * структура блоков как у референса Tilda (зигзаг фото + текст рядом), стиль AVATERRA.
 */

export const PROBUZHDENIE_BERLINSKA_SLUG = 'probuzhdenie';

/** Дополнительный текстовый блок в той же колонке (одна секция, одно фото). */
export type ProbuzhdenieVisualExtraText = {
  eyebrow?: string;
  title: string;
  paragraphs: string[];
};

export type ProbuzhdenieVisualBlock = {
  id?: string;
  imageSrc: string;
  imageAlt: string;
  /** Классы соотношения сторон контейнера фото (по умолчанию в ряду зигзага — 4:3). */
  imageAspectClass?: string;
  eyebrow?: string;
  title: string;
  largeTitle?: boolean;
  paragraphs: string[];
  /** Второй и далее подзаголовок + абзацы под первым блоком текста. */
  extraTextBlocks?: ProbuzhdenieVisualExtraText[];
  /** Зафиксировать сторону фото при изменении числа блоков (зигзаг по чётности). */
  imageOnLeftOverride?: boolean;
  /** Как на прод-лендинге: только текст, без колонки с фото (секции «Почему» / «Что делать»). */
  omitImage?: boolean;
  list?: string[];
  listTitle?: string;
};

/**
 * Чередование фото слева/справа — по индексу среди блоков **с колонкой фото** (как на avaterra.pro):
 * индекс 0 → фото справа, 1 → слева, … Переопределение: `imageOnLeftOverride`.
 * Секции с `omitImage` не участвуют в смене стороны (только текст).
 */

export const BERLINSKA_PAINS: ProbuzhdenieVisualBlock[] = [
  {
    id: 'feel',
    /** pain-stuck: 575×1024 (портрет), не обрезать под 4:3 */
    imageAspectClass: 'aspect-[575/1024]',
    imageSrc: '/images/probuzhdenie/pain-stuck.png',
    imageAlt: 'Тяжесть и эмоциональное истощение',
    eyebrow: 'Ты чувствуешь, что',
    title: 'Устал(а) от напряжения и эмоциональной боли',
    paragraphs: [
      'Ты перепробовал(а) множество практик и техник, тренингов и курсов — но всё возвращается вновь.',
      'Ты хочешь стать лучше, исправить себя, но чем больше борешься, тем больше проблем.',
    ],
  },
  {
    id: 'retreats',
    /** week1-meditation: 666×1000 */
    imageAspectClass: 'aspect-[666/1000]',
    imageSrc: '/images/probuzhdenie/week1-meditation.png',
    imageAlt: 'После духовного опыта — возврат в обычную жизнь',
    title: 'Ретриты не помогли',
    paragraphs: [
      'Ты пережил(а) **глубокие духовные опыты**, но после возвышенных переживаний вернулся(лась) в обычную жизнь — снова проблемы, стресс и боль.',
    ],
  },
  {
    id: 'depression',
    /** hero-bg: 574×1024 */
    imageAspectClass: 'aspect-[574/1024]',
    imageSrc: '/images/probuzhdenie/hero-bg.png',
    imageAlt: 'Пустота и потеря опоры',
    title: 'Ты в депрессии',
    paragraphs: [
      'Смысла нет ни в чём, работа и отношения больше не радуют. Опора исчезла, будущее не видно.',
      'Внутри пустота, которую невозможно заполнить.',
    ],
  },
  {
    id: 'autopilot',
    /** autopilot-robots: 574×1024 */
    imageAspectClass: 'aspect-[574/1024]',
    imageSrc: '/images/probuzhdenie/autopilot-robots.png',
    imageAlt: 'Ощущение автопилота — ряды одинаковых роботов',
    title: 'Живёшь на автопилоте',
    paragraphs: [
      'Каждый день одно и то же: просыпаешься и выполняешь одни и те же действия, словно робот, исполняющий чужие сценарии.',
      'Внутри пустота и ощущение, что ты не живёшь, а существуешь.',
    ],
  },
  {
    id: 'search',
    imageSrc: '/images/probuzhdenie/cover-touch.png',
    imageAlt: 'Поиск себя и тишина внутри',
    title: 'Духовные поиски',
    paragraphs: [
      'Кто я? Зачем я? Почему так со мной?',
      'Утрачена связь с Духом, интуиция молчит, не понимаешь, куда двигаться и кому верить. Ты долго искал(а) ответы снаружи — и так и не смог(ла) их найти.',
    ],
  },
];

export const BERLINSKA_WHY: ProbuzhdenieVisualBlock = {
  id: 'why',
  omitImage: true,
  largeTitle: true,
  imageSrc: '/images/probuzhdenie/sunset-dance.png',
  imageAlt: 'Переход к свободе',
  title: 'Почему всё так сложно?',
  paragraphs: [
    'Потому что программы рулят тобой — система, которая удерживает тебя в иллюзии жизни.',
    'Ты думаешь, что выбираешь сам(а), но на самом деле тобой управляют убеждения и алгоритмы программ, живущие в клетке.',
    'А так хочется ЖИТЬ!',
  ],
};

export const BERLINSKA_WHAT_DO: ProbuzhdenieVisualBlock = {
  id: 'whatnow',
  omitImage: true,
  largeTitle: true,
  imageSrc: '/images/probuzhdenie/week3-bird-shadow.png',
  imageAlt: 'Внутренняя сила',
  title: 'Что делать?',
  paragraphs: [
    'Правда в том, что если ты это читаешь — ты уже готов(а) к пробуждению.',
    'Единственный способ вырваться из замкнутого круга — осознанность: ты перестаёшь быть тем, кто реагирует, и становишься тем, кто выбирает свою реакцию. То есть делаешь ВЫБОР.',
    'Именно тогда начинается настоящая свобода!',
  ],
};

export const BERLINSKA_COURSE_KEY: ProbuzhdenieVisualBlock = {
  id: 'course',
  imageSrc: '/images/probuzhdenie/card-cover.png',
  imageAlt: 'Ключ к пробуждению',
  eyebrow: 'Курс практик',
  title: '«Пробуждение»',
  paragraphs: [
    'Это ключ, который поможет тебе найти путь к истине и вспомнить свою суть.',
    '21 день глубоких практик настоящего момента день за днём перенастроят твоё сознание на режим осознанности.',
  ],
  listTitle: 'Ты получишь',
  list: [
    'Активируется ресурс;',
    'Уйдут системы убеждений;',
    'Вернётся состояние «здесь и сейчас»;',
    'Программы взрогнут и исчезнут;',
    'Соединимся с Источником и собственной Силой Духа.',
  ],
};

export const BERLINSKA_WEEKS: ProbuzhdenieVisualBlock[] = [
  {
    id: 'week-1',
    /** hero-awakening: 662×1024 */
    imageAspectClass: 'aspect-[662/1024]',
    imageSrc: '/images/probuzhdenie/hero-awakening.png',
    imageAlt: 'Неделя 1 — Я ЕСТЬ',
    eyebrow: 'Содержание курса · Неделя 1',
    title: 'Диагностика, осознание, согласие. Выход в «Я ЕСТЬ»',
    paragraphs: [
      'Базовые практики осознанности в повседневной жизни — выход из автопилота и возвращение внимания в настоящий момент. Осознание присутствия тела. Запуск процесса пробуждения.',
    ],
  },
  {
    id: 'week-2',
    /** week2-cleansing: 682×1024 */
    imageAspectClass: 'aspect-[682/1024]',
    imageSrc: '/images/probuzhdenie/week2-cleansing.png',
    imageAlt: 'Неделя 2 — очищение',
    eyebrow: 'Неделя 2',
    title: 'Очищение на всех планах',
    paragraphs: [
      'Практика, которая поможет пробудить энергию, освободить заблокированные эмоции и открыть канал связи с собой и Источником через тело.',
    ],
    extraTextBlocks: [
      {
        eyebrow: 'Выход из систем убеждений и программ',
        title: 'Зачатие. Новое рождение. Встреча с Жизнью',
        paragraphs: [
          'Практика, помогающая войти в контакт с собой — чтобы увидеть программы и шагнуть в новое.',
        ],
      },
    ],
  },
  {
    id: 'week-3',
    /** Картинка слева, текст справа (явный порядок колонок). */
    imageOnLeftOverride: true,
    /** week3-bird-shadow: 682×1024 */
    imageAspectClass: 'aspect-[682/1024]',
    imageSrc: '/images/probuzhdenie/week3-bird-shadow.png',
    imageAlt: 'Неделя 3 — я новая',
    eyebrow: 'Неделя 3',
    title: 'Я новая. Я источник своей силы',
    paragraphs: [
      'Уровень, на котором ты перестаёшь сражаться с собой и с миром. Всё во мне! Я в своей новой реальности!',
      'Освобождение от дуальности, выход за пределы программ и сценариев, наполнение ресурсов для перехода на новый уровень.',
    ],
  },
];
