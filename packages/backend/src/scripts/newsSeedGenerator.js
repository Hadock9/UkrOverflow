/**
 * Генератор українських tech-новин у стилі DOU для bulk seed.
 */

import { slugify, uniqueSlug } from '../utils/slug.js';

export const NEWS_CATEGORIES = ['salary', 'career', 'tech', 'community', 'events', 'ai'];

export const CATEGORY_LABELS_UA = {
  salary: 'Зарплати',
  career: 'Карʼєра',
  tech: 'Технології',
  community: 'Спільнота',
  events: 'Події',
  ai: 'ШІ / ML',
};

const CITIES = ['Київ', 'Львів', 'Харків', 'Дніпро', 'Одеса', 'Вінниця', 'Івано-Франківськ', 'Варшава', 'Прага', 'Берлін'];
const STACKS = ['React', 'Node.js', 'Python', 'Go', 'Vue', 'TypeScript', 'Java', 'Kotlin', 'Rust', '.NET'];
const ROLES = ['Junior', 'Middle', 'Senior', 'Lead', 'Staff', 'Fullstack', 'Frontend', 'Backend', 'DevOps', 'QA'];
const COMPANIES = ['SoftServe', 'EPAM', 'GlobalLogic', 'Grammarly', 'Ajax Systems', 'Preply', 'MacPaw', 'Rozetka Tech', 'Nova Digital', 'Ciklum'];
const CONFERENCES = ['IT Arena', 'JEEConf', 'DevFest Ukraine', 'PyCon Ukraine', 'React Kyiv', 'NodeUA', 'Highload++ Kyiv', 'Ukrainian Cybersecurity Day'];
const TOPICS = ['remote-first', 'релокація', 'defense tech', 'edtech', 'фінтех', 'продуктовий підхід', 'open source', 'менторство'];

const TITLE_TEMPLATES = {
  salary: [
    'Опитування зарплат {role} у {city}: медіана ${amount} на місяць',
    'Ринок {stack}: скільки платять {role} у 2025–2026',
    'Компанія {company} підняла вилку для {stack}-інженерів',
    'DOU-стиль: чому {role} з {city} обирають контракт замість ФОП',
    'Зарплатний дайджест: {stack} у product vs outsource',
  ],
  career: [
    'Як вийти на {role} без комерційного досвіду: план на 6 місяців',
    'Віддалена робота та {topic}: що питають на співбесідах',
    'Релокація в {city}: досвід українських {stack}-розробників',
    'Карʼєрний трек {role}: що вчити після {stack}',
    'Чому рекрутери шукають {stack} + soft skills у 2026',
  ],
  tech: [
    '{stack} 2026: оновлення, яке варто спланувати в backlog',
    'Міграція legacy на {stack}: кейс українського SaaS',
    'Code review для {stack}: чеклист від команди {company}',
    'Monorepo + {stack}: практика українських продуктових команд',
    'Performance: як прискорили API на {stack} у 3 рази',
  ],
  community: [
    'Спільнота {city}: meetup про {stack} та {topic}',
    'Open source з України: {topic} і {stack}',
    'Менторство для джуніорів: досвід {company} та волонтерів',
    'Pet-проєкти на DevFlow: як знайти команду для {stack}',
    'Українські розробники в {topic}: історії з GitHub',
  ],
  events: [
    '{conference}: програма та воркшопи з {stack}',
    'Квитки на {conference} у {city}: що чекати від спікерів',
    'Afterparty {conference}: нетворкінг для {role}',
    'Виступ про {topic} на {conference} — ключові тези',
    'Як підготуватися до {conference}, якщо ви {role} зі {stack}',
  ],
  ai: [
    'AI-асистенти для {stack}: що реально працює в продакшені',
    'Copilot vs локальні LLM: досвід команди з {city}',
    'Генерація тестів для {stack}: економія часу чи борг?',
    'RAG для внутрішньої документації: кейс {company}',
    'Етика ШІ у {topic}: рекомендації для українських продуктів',
  ],
};

const BODY_INTROS = {
  salary: [
    'За даними опитувань спільноти та вакансій на DevFlow, ринок українського IT залишається конкурентним для сильних кандидатів.',
    'Аналітики порівняли вилки в product, outsource та стартапах — розкид залежить від міста, англійської та досвіду з продакшеном.',
  ],
  career: [
    'Карʼєрні консультанти радять фокусуватися на вимірюваних результатах: pet-проєкти, open source, чіткий профіль на GitHub.',
    'Українські команди все частіше оцінюють кандидатів за системним мисленням, а не лише за списком фреймворків.',
  ],
  tech: [
    'Інженери діляться практиками, які зменшують техборг без зупинки релізного циклу.',
    'У статті — конкретні кроки міграції, метрики до/після та ризики, які варто закласти в план.',
  ],
  community: [
    'Локальні спільноти знову поєднують офлайн і онлайн: короткі доклади, live-coding та менторські слоти.',
    'Учасники відзначають, що нетворкінг працює краще, коли є спільна тема — наприклад, внесок у defense tech або edtech.',
  ],
  events: [
    'Організатори анонсували треки для джуніорів, продуктових менеджерів та інженерів з досвідом у distributed systems.',
    'На конференції будуть стенди рекрутингу, але головна цінність — обмін досвідом між командами з різних доменів.',
  ],
  ai: [
    'Команди експериментують з LLM обережно: спочатку внутрішні інструменти, потім — фічі для користувачів з чіткими обмеженнями.',
    'Експерти наголошують: вимірюйте якість на реальних репозиторіях і не замінюйте code review сліпою автогенерацією.',
  ],
};

const BODY_BULLETS = [
  'Порада: фіксуйте baseline метрик (час CI, покриття тестами) перед великими змінами.',
  'Для джуніорів корисно публікувати короткі нотатки з pet-проєктів у community hub DevFlow.',
  'Безпека: не вставляйте секрети в промпти; використовуйте окремі sandbox-середовища.',
  'Рекрутинг: чіткий summary у профілі підвищує відгук на перше повідомлення.',
  'Менторство: оберіть одну вузьку тему (наприклад, code review або деплой) на перший місяць.',
];

function pick(arr, index) {
  return arr[index % arr.length];
}

function randomAmount(index) {
  const bases = [1200, 1800, 2500, 3200, 4500, 6000, 8500];
  return bases[index % bases.length];
}

function buildBody(category, index) {
  const intro = pick(BODY_INTROS[category], index);
  const bullets = [
    pick(BODY_BULLETS, index),
    pick(BODY_BULLETS, index + 3),
    pick(BODY_BULLETS, index + 7),
  ];
  const stack = pick(STACKS, index);
  const city = pick(CITIES, index + 2);
  return `${intro}

Контекст: ${pick(TOPICS, index)} у сегменті ${pick(COMPANIES, index)} / ${city}.

Що варто знати:
- ${bullets[0]}
- ${bullets[1]}
- ${bullets[2]}

Стек обговорення: ${stack}, ${pick(ROLES, index + 1)}. Матеріал підготовлено для стрічки DevFlow — українського knowledge & community hub для розробників.`;
}

function fillTitle(template, index) {
  return template
    .replace('{role}', pick(ROLES, index))
    .replace('{city}', pick(CITIES, index))
    .replace('{stack}', pick(STACKS, index))
    .replace('{company}', pick(COMPANIES, index))
    .replace('{conference}', pick(CONFERENCES, index))
    .replace('{topic}', pick(TOPICS, index))
    .replace('{amount}', String(randomAmount(index)));
}

export function buildSummary(text, max = 500) {
  const source = (text || '')
    .replace(/[#>*_`\-]+/g, ' ')
    .replace(/\[(.*?)\]\((.*?)\)/g, '$1')
    .replace(/\s+/g, ' ')
    .trim();
  if (!source) return '';
  return source.length > max ? `${source.slice(0, max - 3)}...` : source;
}

export function tagsForCategory(category, index) {
  const base = {
    salary: ['зарплати', 'dou', 'ринок'],
    career: ['карʼєра', 'remote', 'співбесіда'],
    tech: ['розробка', 'backend', 'frontend'],
    community: ['спільнота', 'meetup', 'україна'],
    events: ['конференція', 'нетворкінг'],
    ai: ['ai', 'llm', 'інструменти'],
  }[category] || ['devflow'];
  const extra = pick(STACKS, index).toLowerCase().replace('.', '');
  return [...base, extra].slice(0, 5);
}

/** 8 зразкових новин для швидкого seed */
export const SAMPLE_NEWS = [
  {
    title: 'Українські стартапи активно впроваджують AI у продукти розробки',
    category: 'ai',
    isPinned: true,
    tags: ['ai', 'стартапи', 'україна'],
    body: `Українські IT-компанії дедалі частіше інтегрують генеративний штучний інтелект у внутрішні інструменти: від code review до підготовки документації.

За даними спільнот розробників, найбільший попит мають рішення для:
- автоматичного рефакторингу legacy-коду;
- генерації тестів і технічних специфікацій;
- підсумків довгих тредів у Slack/Teams.

Експерти радять починати з вузьких use-case і вимірювати якість на реальних репозиторіях, а не лише на демо-прикладах.`,
  },
  {
    title: 'TypeScript 5.8: що варто знати фронтенд-командам',
    category: 'tech',
    tags: ['typescript', 'frontend'],
    body: `Нова гілка TypeScript приносить покращення інференсу, швидшу перевірку великих monorepo та зручніші діагностики для conditional types.

Для українських продуктових команд це означає менше «червоних хвиль» після оновлення залежностей і простіший онбординг джуніорів.

Рекомендований план міграції:
1. Оновити \`typescript\` і \`@types/*\` у lockfile.
2. Увімкнути \`strict\` поетапно в нових пакетах.
3. Зафіксувати baseline помилок у CI, щоб не накопичувати борг.`,
  },
  {
    title: 'DevFlow Community Hub: як об’єднати менторство та pet-проєкти',
    category: 'community',
    tags: ['devflow', 'спільнота', 'менторство'],
    body: `Платформа DevFlow поєднує knowledge hub і community hub: питання, статті, спільноти за містами та університетами, а також профілі менторів.

Ключова ідея — не розривати навчання від практики: пост у спільноті може посилатися на гайд у хабі, а ментор бачить стек кандидата з GitHub-профілю.

Для дипломних проєктів така архітектура демонструє повний цикл: від збору знань до реальної взаємодії між розробниками.`,
  },
  {
    title: 'Безпека API: чеклист для українських SaaS на Node.js',
    category: 'tech',
    tags: ['security', 'nodejs', 'api'],
    body: `Після серії інцидентів у світовому SaaS українські команди посилюють базову гігієну API:

- rate limiting на публічних ендпоінтах;
- валідація вхідних даних (express-validator / zod);
- helmet + коректний CORS у продакшені;
- секрети лише в env, без комітів у git;
- аудит залежностей (\`npm audit\`, Dependabot).

Окремо варто перевірити WebSocket-канали: автентифікація при підключенні та обмеження broadcast-ів.`,
  },
  {
    title: 'Віддалена робота 2026: тренди для fullstack в Україні',
    category: 'career',
    tags: ['карʼєра', 'remote', 'fullstack'],
    body: `Ринок стабілізувався: компанії шукають інженерів, які вміють закривати фічу end-to-end — від UI до деплою.

Популярні стеки у вакансіях:
- React + Node.js + PostgreSQL;
- Next.js + serverless functions;
- Vue/Nuxt для B2B-панелей.

Кандидати з активним open source та зрозумілим профілем на DevFlow/GitHub отримують більше відгуків на перше повідомлення.`,
  },
  {
    title: 'MySQL 8 і JSON-поля: практика для knowledge hub',
    category: 'tech',
    tags: ['mysql', 'backend', 'database'],
    body: `Теги, метадані постів і GitHub-профілі зручно зберігати в JSON-колонках MySQL 8 з індексацією через generated columns або JSON_CONTAINS.

У DevFlow теги нормалізуються на бекенді, а міграції виконуються ідемпотентно (\`CREATE TABLE IF NOT EXISTS\`, \`ensureColumn\`).

Порада: для fulltext-пошуку комбінуйте FULLTEXT індекси з окремим глобальним пошуком по кількох таблицях.`,
  },
  {
    title: 'IT Arena 2026: що чекати від головної tech-конференції України',
    category: 'events',
    isPinned: true,
    tags: ['it-arena', 'конференція', 'львів'],
    body: `IT Arena традиційно збирає продуктових лідерів, інвесторів та інженерів з усього світу. У 2026 році акцент — на AI в продукті, кібербезпеці та відновленні українського tech-експорту.

Очікувані треки:
- Product & Growth для B2B SaaS;
- Engineering leadership;
- Defense tech та civic tech.

Квитки розбирають швидко — варто планувати поїздку та нетворкінг заздалегідь.`,
  },
  {
    title: 'Опитування зарплат Middle React у Києві: медіана $3200',
    category: 'salary',
    isPinned: true,
    tags: ['зарплати', 'react', 'київ'],
    body: `За агрегованими даними спільноти, медіана для Middle React/TypeScript у Києві коливається між $2800 та $3800 залежно від домену (fintech vs adtech).

На вилку впливають:
- англійська для daily standup з клієнтом;
- досвід з design systems;
- участь у code review та менторстві джуніорів.

Аутсорс і продуктові компанії все ще мають різні «пакети» бонусів — порівнюйте total compensation, а не лише gross.`,
  },
  {
    title: 'Open source з України: як долучитися через GitHub і спільноти',
    category: 'community',
    tags: ['opensource', 'github', 'україна'],
    body: `Локальні meetup-и та онлайн-спільноти знову збирають контриб’юторів у defense tech, edtech і fintech.

Перші кроки:
1. Обрати проєкт з міткою \`good first issue\`.
2. Прочитати CONTRIBUTING і code style.
3. Зв’язати PR з issue і описати тест-план.

На DevFlow можна публікувати pet-проєкти в community hub і прикріплювати репозиторії з GitHub — це підвищує видимість для менторів і рекрутерів.`,
  },
];

/**
 * Генерує N новин з унікальними slug.
 * @param {number} count
 * @param {{ seedOffset?: number, pinnedSlots?: number[] }} opts
 */
export function generateBulkNews(count, { seedOffset = 0, pinnedSlots = [0, 1, 17, 89, 201] } = {}) {
  const taken = new Set();
  const items = [];
  const pinnedSet = new Set(pinnedSlots);

  for (let i = 0; i < count; i += 1) {
    const globalIndex = seedOffset + i;
    const category = NEWS_CATEGORIES[globalIndex % NEWS_CATEGORIES.length];
    const templates = TITLE_TEMPLATES[category];
    const title = fillTitle(pick(templates, globalIndex), globalIndex);
    const body = buildBody(category, globalIndex);
    const baseSlug = slugify(title) || `news-${globalIndex}`;
    const slug = uniqueSlug(`${baseSlug}-${globalIndex}`, taken);
    const tags = tagsForCategory(category, globalIndex);
    const isPinned = pinnedSet.has(i);

    items.push({
      title,
      body,
      summary: buildSummary(body, 500),
      slug,
      category,
      tags,
      isPinned: Boolean(isPinned),
      views: 5 + (globalIndex * 17) % 2400,
    });
  }
  return items;
}

/** Злити зразкові + згенеровані до targetCount */
export function buildNewsDataset(targetCount) {
  if (targetCount <= SAMPLE_NEWS.length) {
    return SAMPLE_NEWS.slice(0, targetCount).map((item, i) => {
      const body = item.body;
      const taken = new Set();
      return {
        ...item,
        summary: buildSummary(body, 500),
        slug: uniqueSlug(slugify(item.title) || `news-${i}`, taken),
        category: item.category || 'tech',
        views: 10 + i * 3,
      };
    });
  }

  const taken = new Set();
  const fromSamples = SAMPLE_NEWS.map((item, i) => ({
    title: item.title,
    body: item.body,
    summary: buildSummary(item.body, 500),
    slug: uniqueSlug(slugify(item.title) || `news-${i}`, taken),
    category: item.category || 'tech',
    tags: item.tags,
    isPinned: Boolean(item.isPinned),
    views: 50 + i * 11,
  }));

  const generated = generateBulkNews(targetCount - SAMPLE_NEWS.length, {
    seedOffset: SAMPLE_NEWS.length,
    pinnedSlots: [24, 156],
  });

  return [...fromSamples, ...generated];
}
