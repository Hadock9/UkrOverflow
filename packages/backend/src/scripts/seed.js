/**
 * Seed knowledge hub: 10 користувачів, 7×70 = 490 контент-юнітів,
 * 700 відповідей (по 10 на 70 питань) і легкі голоси.
 *
 * Усі дані генеруються детерміновано (mulberry32 PRNG з фіксованим seed),
 * тож повторний запуск дає той самий контент.
 */

import bcrypt from 'bcrypt';
import pool from '../config/database.js';

const PER_TYPE = 70;
const ANSWERS_PER_QUESTION = 10;

const TECHS = [
  'React', 'Vue', 'Angular', 'Svelte', 'Next.js', 'Nuxt',
  'Node.js', 'Express', 'Fastify', 'NestJS',
  'Python', 'Django', 'Flask', 'FastAPI',
  'Go', 'Rust', 'Java', 'Spring Boot', 'Kotlin', 'C#', '.NET',
  'TypeScript', 'JavaScript',
  'PostgreSQL', 'MySQL', 'MongoDB', 'Redis', 'ClickHouse',
  'Docker', 'Kubernetes', 'AWS', 'GCP', 'Azure', 'Terraform',
  'GraphQL', 'REST API', 'WebSocket', 'gRPC',
  'Vite', 'Webpack', 'Tailwind CSS', 'Sass',
  'Jest', 'Vitest', 'Playwright', 'Cypress',
  'TanStack Query', 'Redux', 'Zustand',
  'Strapi', 'Prisma', 'Drizzle ORM',
];

const QUESTION_TOPICS = [
  'оптимізація швидкодії', 'витоки пам’яті', 'кешування', 'обробка помилок', 'тестування',
  'CI/CD', 'безпека', 'інтеграція з REST', 'інтеграція з GraphQL', 'WebSocket з’єднання',
  'аутентифікація', 'JWT і refresh-токени', 'CORS', 'rate limiting', 'логування',
  'моніторинг', 'трасування', 'мікросервіси', 'event-driven архітектура', 'CQRS',
];

const ARTICLE_TOPICS = [
  'глибокий аналіз архітектури', 'паттерни проєктування', 'еволюція API',
  'розбір продуктивності', 'що нового у', 'як ми мігрували на',
  'досвід продакшену з', 'порівняння підходів у', 'практичний кейс із',
  'security-аудит', 'тестова стратегія для', 'оптимізація бандлу',
  'state management у', 'design system на', 'observability у',
];

const GUIDE_TOPICS = [
  'налаштування з нуля', 'локальний dev-середовище', 'деплой на продакшен',
  'інтеграція з CI', 'налаштування авторизації', 'підключення БД',
  'налаштування WebSocket', 'налаштування файлових завантажень',
  'інтеграція платежів', 'інтеграція аналітики',
];

const SNIPPET_TOPICS = [
  'дебаунс і троттлінг', 'інфініт-скрол', 'lazy loading зображень',
  'cancel токени запитів', 'кеш у localStorage', 'pub/sub шина',
  'middleware валідації', 'middleware логування', 'helper для дат',
  'helper для форматування грошей',
];

const ROADMAP_TOPICS = [
  'fullstack-розробник', 'frontend з нуля до middle', 'backend з нуля до middle',
  'DevOps інженер', 'QA automation', 'мобільний розробник',
  'data engineer', 'security engineer', 'platform engineer',
  'технічний лідер',
];

const BEST_PRACTICE_TOPICS = [
  'обробка помилок', 'логування', 'іменування', 'структура коду',
  'code review', 'тестування', 'мерж-стратегія', 'версіонування',
  'feature flags', 'трасування',
];

const FAQ_TOPICS = [
  'базові питання', 'дебаг-питання', 'продуктивність', 'налагодження',
  'структура проєкту', 'інтеграції', 'оновлення версій', 'екосистема',
  'тестування', 'деплой',
];

const QUESTION_BODY_TEMPLATES = [
  'Стикнувся з {topic} у проєкті на {tech}. Які підходи зараз вважаються канонічними? Що працює у продакшені, а що — лише на тестових прикладах?',
  'Чи правильно я розумію, що для {topic} у {tech} достатньо вбудованих засобів? Чи є сенс одразу брати готову бібліотеку?',
  'Підкажіть, з чого почати, коли потрібно швидко зрозуміти {topic} у {tech}. Лежить на проді легасі-код, потрібно мінімум змін.',
  'Як ви організовуєте {topic} у {tech}, коли команда росте і кожен пише по-своєму? Шукаю конкретні правила.',
  'Що краще пропустити, а на чому сфокусуватися при опануванні {topic} у {tech}? Часу мало, проєкт «вчора».',
];

const ANSWER_TEMPLATES = [
  'Якщо коротко — для {topic} у {tech} починаємо з offline-сценарію: фіксуємо метрики, формулюємо очікування, лише потім вибираємо інструмент. Інакше легко зайняти час «полірувати» проблему, якої немає.',
  'У нас на проді з {tech} {topic} вирішується трьома кроками: 1) ввімкнути базове логування, 2) додати окрему dashboard з метриками, 3) налаштувати алерти на регресії. Без цього будь-яка зміна — у темряву.',
  'Раджу не вигадувати: для {tech} є усталений пейпер/гайд про {topic}. Прочитайте RFC або офіційну доку, переходьте до проби, лише потім дивіться на сторонні бібліотеки.',
  'З власного досвіду — {topic} у {tech} ламається на найпростіших речах: тайм-зони, кодування, неконсистентні поля. Налагодьте E2E-тест на цей сценарій ще до коду.',
  'Не недооцінюйте {topic} — у великому проєкті на {tech} це часто означає окрему підсистему. Виділіть {topic} у власний модуль, окремі тести, окремі релізи.',
  'Я б подивився на питання так: який ваш SLO? Якщо «має просто працювати» — підійде дефолт. Якщо є вимоги до p99 latency — для {topic} у {tech} доведеться писати під ваш профіль.',
  'Сумарно бачимо такі граблі при {topic} у {tech}: 1) приховані ретраї, 2) кешовані заголовки, 3) непомітні side-effects. Регулярно лінтуйте кожен з пунктів.',
  'Краще зробити просто і повільно, ніж складно і «майже». Для {topic} у {tech} перший прохід — наївна реалізація без оптимізацій, потім профілювання і вже після — точкові доопрацювання.',
  'Документуйте рішення: коли наступного разу хтось зачепить {topic} у {tech} — у вас вже буде runbook, замість «давайте знову подумаємо».',
  'Не забудьте про спостережуваність: у проєкті на {tech} жоден кейс із {topic} не повинен зникнути без сліду в логах і метриках.',
];

const ARTICLE_BODY_INTRO = [
  'Ця стаття — конспект продакшен-уроків, які ми отримали, коли впроваджували {tech} і обходили підводні камені {topic}.',
  'Тут зібрано перевірені у бою прийоми {topic} у {tech}, з прикладами коду й антипатернами.',
  'Чим довше живе проєкт на {tech}, тим важливіше системно дивитися на {topic}. У статті розбираємо причини й рішення.',
];

const GUIDE_SECTION = [
  '## Що знадобиться\n- {tech} відповідної версії\n- доступ до тестового середовища\n- ~30 хвилин уваги',
  '## Швидкий старт\n1. Встановити залежності\n2. Створити мінімальний приклад\n3. Перевірити роботу у dev режимі',
  '## Що далі\nПісля базового сетапу варто додати тести, моніторинг і CI-перевірку конфігурації.',
];

const ROADMAP_STAGES = [
  'Основи мови / середовища',
  'Стандартна бібліотека і пакетний менеджер',
  'Інструменти збірки і dev workflow',
  'Тестування (unit / integration)',
  'Архітектура і паттерни',
  'Продуктивність і профілювання',
  'Безпека і надійність',
  'CI/CD і деплой',
  'Моніторинг і observability',
  'Лідерство і код-рев’ю',
];

const BEST_PRACTICE_RULES = [
  'Не покладайтесь на неявні дефолти — описуйте кожну поведінку явно у конфігах.',
  'Будь-яка зовнішня залежність має мати таймаут, ретраї та явну обробку помилок.',
  'Зміни схеми БД виконуйте лише через міграції, які можна повторити локально.',
  'Логи мають містити контекст: requestId, userId, traceId — інакше дебаг буде болем.',
  'Жоден важливий запит у продакшені не повинен залежати від «дефолтної» поведінки фреймворку.',
];

const FAQ_BASE_PAIRS = [
  { q: 'Чим відрізняється від попередньої версії?', a: 'Найважливіше — зміни API, нові дефолти і кілька breaking changes. Перечитайте release notes перед апгрейдом.' },
  { q: 'Як швидко перевірити, що {topic} працює правильно?', a: 'Налаштуйте мінімальний healthcheck і smoke-тести у CI. Це покриває 80% типових регресій.' },
  { q: 'Які типові помилки новачків?', a: 'Найчастіше — копіювання конфігів без розуміння, ігнорування таймаутів, відсутність логування на кордонах системи.' },
  { q: 'Як це масштабувати?', a: 'Спочатку — горизонтально (більше інстансів), потім — оптимізація гарячих шляхів. Не оптимізуйте «про запас».' },
  { q: 'Як про це поговорити з командою?', a: 'Окрема зустріч-розбір на 30 хв із чек-листом і власником рішення. Без цього домовленості «розчиняються».' },
];

const TAG_POOL = [
  'react', 'vue', 'angular', 'svelte', 'next-js', 'nuxt',
  'nodejs', 'express', 'fastify', 'nestjs',
  'python', 'django', 'flask', 'fastapi',
  'go', 'rust', 'java', 'spring-boot', 'kotlin', 'csharp', 'dotnet',
  'typescript', 'javascript',
  'postgresql', 'mysql', 'mongodb', 'redis',
  'docker', 'kubernetes', 'aws', 'gcp',
  'graphql', 'rest', 'websocket', 'grpc',
  'vite', 'webpack', 'tailwind',
  'jest', 'vitest', 'playwright', 'cypress',
  'tanstack-query', 'redux', 'zustand',
  'prisma', 'drizzle',
  'architecture', 'performance', 'security', 'best-practices', 'patterns',
  'auth', 'jwt', 'cors', 'rate-limit', 'logging', 'observability',
  'microservices', 'event-driven', 'cqrs', 'devops', 'ci-cd',
];

const LANGUAGES = ['javascript', 'typescript', 'python', 'go', 'rust', 'java', 'sql', 'bash'];

const DIFFICULTIES = ['beginner', 'intermediate', 'advanced'];

const CATEGORIES = ['code-style', 'architecture', 'security', 'performance', 'reliability', 'team'];

function mulberry32(seed) {
  let a = seed >>> 0;
  return function rand() {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function makeUtils(seed) {
  const rand = mulberry32(seed);
  const pick = (arr) => arr[Math.floor(rand() * arr.length)];
  const pickN = (arr, n) => {
    const copy = [...arr];
    const out = [];
    for (let i = 0; i < n && copy.length; i += 1) {
      const idx = Math.floor(rand() * copy.length);
      out.push(copy.splice(idx, 1)[0]);
    }
    return out;
  };
  const intBetween = (min, max) => Math.floor(rand() * (max - min + 1)) + min;
  const fill = (n, fn) => Array.from({ length: n }, (_, i) => fn(i));
  return { rand, pick, pickN, intBetween, fill };
}

function format(template, dict) {
  return template.replace(/\{(\w+)\}/g, (_, k) => dict[k] ?? '');
}

function tagsFor(tech, extras, pickN) {
  const techTag = String(tech).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  const others = pickN(TAG_POOL, 3);
  return Array.from(new Set([techTag, ...others, ...(extras || [])])).slice(0, 6);
}

async function clear(connection) {
  console.log('🧹 Очищення таблиць...');
  await connection.execute('SET FOREIGN_KEY_CHECKS = 0');
  const tables = [
    'votes',
    'bookmarks',
    'notifications',
    'answers',
    'questions',
    'article_views',
    'articles',
    'guide_views',
    'guides',
    'snippet_views',
    'snippets',
    'roadmap_views',
    'roadmaps',
    'best_practice_views',
    'best_practices',
    'faq_views',
    'faqs',
    'content_bookmarks',
    'content_views',
    'content_answers',
    'content_items',
    'question_views',
    'users',
  ];
  for (const t of tables) {
    try {
      await connection.execute(`TRUNCATE TABLE ${t}`);
    } catch (e) {
      if (e?.code !== 'ER_NO_SUCH_TABLE' && e?.errno !== 1146) throw e;
    }
  }
  await connection.execute('SET FOREIGN_KEY_CHECKS = 1');
  console.log('✓ Таблиці очищено\n');
}

async function createUsers(connection) {
  console.log('👤 Створення користувачів...');
  const adminHash = await bcrypt.hash('admin123', 10);
  const userHash = await bcrypt.hash('password123', 10);

  const seedUsers = [
    { username: 'admin', email: 'admin@ukroverflow.com', password: adminHash, reputation: 5000, role: 'admin', bio: 'Головний адмін платформи', location: 'Київ' },
    { username: 'taras_shevchenko', email: 'taras@ukroverflow.com', password: userHash, reputation: 1250, role: 'user', bio: 'Backend / Node.js', location: 'Київ' },
    { username: 'lesya_ukrainka', email: 'lesya@ukroverflow.com', password: userHash, reputation: 850, role: 'moderator', bio: 'Frontend архітектура', location: 'Луцьк' },
    { username: 'ivan_franko', email: 'ivan@ukroverflow.com', password: userHash, reputation: 620, role: 'user', bio: 'Fullstack / DevOps', location: 'Львів' },
    { username: 'olha_kobylianska', email: 'olha@ukroverflow.com', password: userHash, reputation: 410, role: 'user', bio: 'Data engineering', location: 'Чернівці' },
    { username: 'mykhailo_kotsiubynsky', email: 'mykhailo@ukroverflow.com', password: userHash, reputation: 530, role: 'user', bio: 'Бекенд + Python', location: 'Вінниця' },
    { username: 'lina_kostenko', email: 'lina@ukroverflow.com', password: userHash, reputation: 720, role: 'user', bio: 'Поетика чистого коду', location: 'Полтава' },
    { username: 'panas_myrny', email: 'panas@ukroverflow.com', password: userHash, reputation: 310, role: 'user', bio: 'QA / автотести', location: 'Миргород' },
    { username: 'volodymyr_vynnychenko', email: 'volodymyr@ukroverflow.com', password: userHash, reputation: 480, role: 'user', bio: 'Mobile + React Native', location: 'Дніпро' },
    { username: 'mariia_zankovetska', email: 'mariia@ukroverflow.com', password: userHash, reputation: 360, role: 'user', bio: 'UI / accessibility', location: 'Одеса' },
  ];

  const ids = [];
  for (const u of seedUsers) {
    const [r] = await connection.execute(
      `INSERT INTO users (username, email, password, reputation, role, bio, location, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
      [u.username, u.email, u.password, u.reputation, u.role, u.bio, u.location]
    );
    ids.push(r.insertId);
  }
  console.log(`✓ Створено ${ids.length} користувачів\n`);
  return ids;
}

function buildQuestion(i, utils, userIds) {
  const tech = utils.pick(TECHS);
  const topic = utils.pick(QUESTION_TOPICS);
  const title = `Як організувати ${topic} у ${tech}? (#${i + 1})`;
  const body = format(utils.pick(QUESTION_BODY_TEMPLATES), { topic, tech });
  return {
    title,
    body,
    tags: tagsFor(tech, [], utils.pickN),
    author_id: utils.pick(userIds),
    views: utils.intBetween(5, 600),
    topic,
    tech,
  };
}

function buildArticle(i, utils, userIds) {
  const tech = utils.pick(TECHS);
  const topic = utils.pick(ARTICLE_TOPICS);
  const title = `${topic.charAt(0).toUpperCase()}${topic.slice(1)} — ${tech}`;
  const intro = format(utils.pick(ARTICLE_BODY_INTRO), { tech, topic });
  const body = [
    `# ${title}`,
    intro,
    `## Контекст\nКоли команди тільки починають працювати з ${tech}, у них накопичується безліч різнорідних рішень навколо ${topic}. Розглянемо, як уніфікувати цей досвід.`,
    `## Що працює на практиці\n- послідовна структура коду\n- автоматичні перевірки у CI\n- спільні дашборди й алерти`,
    `## Висновок\n${topic} у ${tech} не варто залишати «на потім». Інвестиція в інструменти зараз окупається стократно під час інцидентів.`,
  ].join('\n\n');
  return {
    title,
    body,
    excerpt: intro.slice(0, 270),
    tags: tagsFor(tech, ['article'], utils.pickN),
    author_id: utils.pick(userIds),
    views: utils.intBetween(20, 1200),
  };
}

function buildGuide(i, utils, userIds) {
  const tech = utils.pick(TECHS);
  const topic = utils.pick(GUIDE_TOPICS);
  const title = `Гайд: ${topic} для ${tech}`;
  const summary = `Покроковий мінімальний рецепт, як виконати «${topic}» у ${tech}: інструменти, послідовність і типові помилки.`;
  const body = [
    `# ${title}`,
    summary,
    ...utils.pickN(GUIDE_SECTION, 3).map((s) => format(s, { tech, topic })),
  ].join('\n\n');
  return {
    title,
    summary,
    body,
    difficulty: utils.pick(DIFFICULTIES),
    estimatedMinutes: utils.intBetween(10, 60),
    tags: tagsFor(tech, ['guide'], utils.pickN),
    author_id: utils.pick(userIds),
    views: utils.intBetween(10, 800),
  };
}

function buildSnippet(i, utils, userIds) {
  const tech = utils.pick(TECHS);
  const topic = utils.pick(SNIPPET_TOPICS);
  const language = utils.pick(LANGUAGES);
  const title = `${topic} (${language})`;
  const description = `Готовий приклад для типового кейсу «${topic}» у ${tech}. Можна копіювати у проєкт як стартову точку, а далі адаптувати під свої вимоги.`;
  const code =
    language === 'python'
      ? `def example(value):\n    \"\"\"Demo for ${topic}.\"\"\"\n    return value * 2`
      : language === 'go'
      ? `package main\n\nimport "fmt"\n\nfunc main() {\n    fmt.Println("${topic}")\n}`
      : language === 'sql'
      ? `SELECT id, name\nFROM items\nWHERE active = TRUE\nORDER BY created_at DESC\nLIMIT 50; -- ${topic}`
      : language === 'bash'
      ? `#!/usr/bin/env bash\n# ${topic}\nset -euo pipefail\necho "demo"`
      : `export function example(value) {\n  // ${topic}\n  return value * 2;\n}`;
  return {
    title,
    description,
    code,
    language,
    tags: tagsFor(tech, ['snippet', language], utils.pickN),
    author_id: utils.pick(userIds),
    views: utils.intBetween(5, 500),
  };
}

function buildRoadmap(i, utils, userIds) {
  const topic = utils.pick(ROADMAP_TOPICS);
  const tech = utils.pick(TECHS);
  const title = `Roadmap: ${topic} (${tech})`;
  const summary = `Дорожня карта розвитку у напрямі «${topic}» з акцентом на стек ${tech}.`;
  const stages = utils.pickN(ROADMAP_STAGES, utils.intBetween(5, 8));
  const steps = stages.map((stage, idx) => ({
    order: idx + 1,
    title: stage,
    description: `Етап ${idx + 1}: ${stage} — практика на проєктах із ${tech}.`,
    estimated_weeks: utils.intBetween(2, 8),
  }));
  const body = [
    `# ${title}`,
    summary,
    ...steps.map((s) => `## ${s.order}. ${s.title}\n${s.description} (≈${s.estimated_weeks} тижнів)`),
  ].join('\n\n');
  return {
    title,
    summary,
    body,
    steps,
    difficulty: utils.pick(DIFFICULTIES),
    estimatedWeeks: steps.reduce((acc, s) => acc + s.estimated_weeks, 0),
    tags: tagsFor(tech, ['roadmap'], utils.pickN),
    author_id: utils.pick(userIds),
    views: utils.intBetween(20, 900),
  };
}

function buildBestPractice(i, utils, userIds) {
  const tech = utils.pick(TECHS);
  const topic = utils.pick(BEST_PRACTICE_TOPICS);
  const rule = utils.pick(BEST_PRACTICE_RULES);
  const title = `Best practice: ${topic} у ${tech}`;
  const body = [
    `# ${title}`,
    `**Правило:** ${rule}`,
    `## Чому це важливо`,
    `«${topic}» у ${tech} — це місце, де команди швидко отримують технічний борг. Чітке правило зменшує кількість суперечок на код-рев’ю та робить onboarding простішим.`,
    `## Антипатерн`,
    `Найгірше — мовчазна домовленість «ми всі знаємо, як треба». Вона завжди ламається з приходом нового розробника.`,
  ].join('\n\n');
  return {
    title,
    rule,
    body,
    antiPatterns: `Антипатерн: ігнорувати ${topic} «бо зараз і так працює».`,
    category: utils.pick(CATEGORIES),
    tags: tagsFor(tech, ['best-practice'], utils.pickN),
    author_id: utils.pick(userIds),
    views: utils.intBetween(15, 700),
  };
}

function buildFaq(i, utils, userIds) {
  const tech = utils.pick(TECHS);
  const topic = utils.pick(FAQ_TOPICS);
  const title = `FAQ: ${tech} — ${topic}`;
  const qaPairs = utils.pickN(FAQ_BASE_PAIRS, 4).map((p) => ({
    question: format(p.q, { tech, topic }),
    answer: format(p.a, { tech, topic }),
  }));
  const body = [
    `# ${title}`,
    `Зведення відповідей на найчастіші питання щодо ${topic} у ${tech}. Підходить як швидка довідка для нових учасників команди.`,
    ...qaPairs.map((p) => `### ${p.question}\n${p.answer}`),
  ].join('\n\n');
  return {
    title,
    topic: tech,
    body,
    qaPairs,
    tags: tagsFor(tech, ['faq'], utils.pickN),
    author_id: utils.pick(userIds),
    views: utils.intBetween(10, 600),
  };
}

async function insertQuestions(connection, userIds, utils) {
  console.log(`❓ Створення ${PER_TYPE} питань...`);
  const ids = [];
  for (let i = 0; i < PER_TYPE; i += 1) {
    const q = buildQuestion(i, utils, userIds);
    const [r] = await connection.execute(
      `INSERT INTO questions (title, body, tags, author_id, views, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, NOW(), NOW())`,
      [q.title, q.body, JSON.stringify(q.tags), q.author_id, q.views]
    );
    ids.push({ id: r.insertId, q });
  }
  console.log(`✓ Питань: ${ids.length}\n`);
  return ids;
}

async function insertAnswers(connection, questions, userIds, utils) {
  console.log(`💬 Створення ${PER_TYPE * ANSWERS_PER_QUESTION} відповідей (по ${ANSWERS_PER_QUESTION} на питання)...`);
  let total = 0;
  for (const { id: qid, q } of questions) {
    const acceptedIndex = utils.intBetween(0, ANSWERS_PER_QUESTION - 1);
    for (let i = 0; i < ANSWERS_PER_QUESTION; i += 1) {
      const tmpl = ANSWER_TEMPLATES[(i + qid) % ANSWER_TEMPLATES.length];
      const body = format(tmpl, { topic: q.topic, tech: q.tech });
      const authorId = utils.pick(userIds.filter((u) => u !== q.author_id)) || utils.pick(userIds);
      await connection.execute(
        `INSERT INTO answers (body, question_id, author_id, is_accepted, upvotes, downvotes, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, NOW(), NOW())`,
        [body, qid, authorId, i === acceptedIndex ? 1 : 0, utils.intBetween(0, 20), utils.intBetween(0, 3)]
      );
      total += 1;
    }
  }
  console.log(`✓ Відповідей: ${total}\n`);
}

async function insertArticles(connection, userIds, utils) {
  console.log(`📰 Створення ${PER_TYPE} статей...`);
  for (let i = 0; i < PER_TYPE; i += 1) {
    const a = buildArticle(i, utils, userIds);
    await connection.execute(
      `INSERT INTO articles (title, body, excerpt, tags, author_id, views, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, NOW(), NOW())`,
      [a.title, a.body, a.excerpt, JSON.stringify(a.tags), a.author_id, a.views]
    );
  }
  console.log('✓ Статей: 70\n');
}

async function insertGuides(connection, userIds, utils) {
  console.log(`📘 Створення ${PER_TYPE} гайдів...`);
  for (let i = 0; i < PER_TYPE; i += 1) {
    const g = buildGuide(i, utils, userIds);
    const excerpt = g.summary.slice(0, 270);
    await connection.execute(
      `INSERT INTO guides (title, summary, excerpt, body, difficulty, estimated_minutes, tags, author_id, views, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
      [g.title, g.summary, excerpt, g.body, g.difficulty, g.estimatedMinutes, JSON.stringify(g.tags), g.author_id, g.views]
    );
  }
  console.log('✓ Гайдів: 70\n');
}

async function insertSnippets(connection, userIds, utils) {
  console.log(`✂️  Створення ${PER_TYPE} snippets...`);
  for (let i = 0; i < PER_TYPE; i += 1) {
    const s = buildSnippet(i, utils, userIds);
    const excerpt = s.description.slice(0, 270);
    await connection.execute(
      `INSERT INTO snippets (title, description, excerpt, code, language, tags, author_id, views, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
      [s.title, s.description, excerpt, s.code, s.language, JSON.stringify(s.tags), s.author_id, s.views]
    );
  }
  console.log('✓ Snippets: 70\n');
}

async function insertRoadmaps(connection, userIds, utils) {
  console.log(`🗺️  Створення ${PER_TYPE} roadmap-ів...`);
  for (let i = 0; i < PER_TYPE; i += 1) {
    const r = buildRoadmap(i, utils, userIds);
    const excerpt = r.summary.slice(0, 270);
    await connection.execute(
      `INSERT INTO roadmaps (title, summary, excerpt, body, steps, difficulty, estimated_weeks, tags, author_id, views, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
      [
        r.title,
        r.summary,
        excerpt,
        r.body,
        JSON.stringify(r.steps),
        r.difficulty,
        r.estimatedWeeks,
        JSON.stringify(r.tags),
        r.author_id,
        r.views,
      ]
    );
  }
  console.log('✓ Roadmaps: 70\n');
}

async function insertBestPractices(connection, userIds, utils) {
  console.log(`🛡️  Створення ${PER_TYPE} best practices...`);
  for (let i = 0; i < PER_TYPE; i += 1) {
    const bp = buildBestPractice(i, utils, userIds);
    const excerpt = bp.rule.slice(0, 270);
    await connection.execute(
      `INSERT INTO best_practices (title, rule, excerpt, body, anti_patterns, category, tags, author_id, views, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
      [bp.title, bp.rule, excerpt, bp.body, bp.antiPatterns, bp.category, JSON.stringify(bp.tags), bp.author_id, bp.views]
    );
  }
  console.log('✓ Best practices: 70\n');
}

async function insertFaqs(connection, userIds, utils) {
  console.log(`❔ Створення ${PER_TYPE} FAQ...`);
  for (let i = 0; i < PER_TYPE; i += 1) {
    const f = buildFaq(i, utils, userIds);
    const excerpt = f.body.replace(/[#`*\n]+/g, ' ').slice(0, 270);
    await connection.execute(
      `INSERT INTO faqs (title, topic, excerpt, body, qa_pairs, tags, author_id, views, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
      [f.title, f.topic, excerpt, f.body, JSON.stringify(f.qaPairs), JSON.stringify(f.tags), f.author_id, f.views]
    );
  }
  console.log('✓ FAQs: 70\n');
}

async function insertVotes(connection, questions, userIds, utils) {
  console.log('👍 Створення голосів на питаннях...');
  let total = 0;
  for (const { id: qid, q } of questions) {
    const voters = utils.pickN(userIds.filter((u) => u !== q.author_id), utils.intBetween(2, 5));
    for (const voter of voters) {
      try {
        await connection.execute(
          `INSERT INTO votes (user_id, entity_type, entity_id, vote_type, created_at)
           VALUES (?, 'question', ?, ?, NOW())`,
          [voter, qid, utils.rand() < 0.85 ? 'up' : 'down']
        );
        total += 1;
      } catch (e) {
        if (e?.code !== 'ER_DUP_ENTRY') throw e;
      }
    }
  }
  console.log(`✓ Голосів: ${total}\n`);
}

async function seed() {
  const connection = await pool.getConnection();
  try {
    console.log('🌱 Початок заповнення бази даних (knowledge hub)...\n');
    await clear(connection);
    const userIds = await createUsers(connection);
    const utils = makeUtils(42);

    const questions = await insertQuestions(connection, userIds, utils);
    await insertAnswers(connection, questions, userIds, utils);
    await insertArticles(connection, userIds, utils);
    await insertGuides(connection, userIds, utils);
    await insertSnippets(connection, userIds, utils);
    await insertRoadmaps(connection, userIds, utils);
    await insertBestPractices(connection, userIds, utils);
    await insertFaqs(connection, userIds, utils);
    await insertVotes(connection, questions, userIds, utils);

    console.log('✅ Заповнення бази завершено успішно!\n');
    console.log('📊 Підсумок:');
    console.log(`   👥 Користувачів:    ${userIds.length}`);
    console.log(`   ❓ Питань:          ${PER_TYPE}`);
    console.log(`   💬 Відповідей:      ${PER_TYPE * ANSWERS_PER_QUESTION}`);
    console.log(`   📰 Статей:          ${PER_TYPE}`);
    console.log(`   📘 Гайдів:          ${PER_TYPE}`);
    console.log(`   ✂️  Snippets:        ${PER_TYPE}`);
    console.log(`   🗺️  Roadmaps:        ${PER_TYPE}`);
    console.log(`   🛡️  Best practices:  ${PER_TYPE}`);
    console.log(`   ❔ FAQs:            ${PER_TYPE}`);
    console.log('\n🔑 Тестові облікові дані:');
    console.log('   admin@ukroverflow.com / admin123');
    console.log('   taras@ukroverflow.com / password123');
  } catch (error) {
    console.error('❌ Помилка заповнення:', error);
    throw error;
  } finally {
    connection.release();
    await pool.end();
  }
}

seed().catch((error) => {
  console.error('Фатальна помилка:', error);
  process.exit(1);
});
