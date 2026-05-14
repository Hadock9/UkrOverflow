/**
 * Заповнення контенту для конкретного користувача.
 *
 * Використання:
 *   node src/scripts/seedForUser.js --user 11
 *
 * Створює (детерміновано, mulberry32 з seed = user_id):
 *   - 5 питань + 15 відповідей (по 3 на питання, 1 з них accepted)
 *   - 4 статті
 *   - 3 гайди
 *   - 5 snippets (JavaScript, TypeScript, Python, Go, SQL)
 *   - 2 roadmaps (steps JSON 5-7 кроків)
 *   - 3 best_practices
 *   - 3 faqs (qa_pairs JSON 3-4 пари)
 *
 * Усі вставки — лише INSERT, без TRUNCATE. created_at = NOW() - random_days,
 * updated_at = created_at, views = 5..200.
 */

import 'dotenv/config';
import bcrypt from 'bcrypt';
import pool from '../config/database.js';

// ── CLI args ──────────────────────────────────────────────────────────────────

function parseArgs(argv) {
  const args = { user: 11 };
  for (let i = 2; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === '--user' || a === '-u') {
      const next = argv[i + 1];
      const n = parseInt(next, 10);
      if (!Number.isFinite(n)) {
        throw new Error(`Невалідне значення для --user: "${next}"`);
      }
      args.user = n;
      i += 1;
    } else if (a.startsWith('--user=')) {
      const n = parseInt(a.slice('--user='.length), 10);
      if (!Number.isFinite(n)) {
        throw new Error(`Невалідне значення для --user: "${a}"`);
      }
      args.user = n;
    }
  }
  return args;
}

// ── PRNG / utils ──────────────────────────────────────────────────────────────

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
  return { rand, pick, pickN, intBetween };
}

function format(template, dict) {
  return template.replace(/\{(\w+)\}/g, (_, k) => dict[k] ?? '');
}

function tagsFor(tech, extras, pickN) {
  const techTag = String(tech).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  const others = pickN(TAG_POOL, 3);
  return Array.from(new Set([techTag, ...others, ...(extras || [])])).slice(0, 6);
}

// ── Контентні шаблони (компактна версія) ──────────────────────────────────────

const TECHS = [
  'React', 'Node.js', 'TypeScript', 'Python', 'Docker',
  'PostgreSQL', 'GraphQL', 'Redis', 'Kubernetes', 'Go',
];

const QUESTION_TOPICS = [
  'оптимізація швидкодії', 'обробка помилок', 'тестування',
  'аутентифікація', 'кешування', 'архітектура модулів',
  'логування', 'CI/CD', 'rate limiting', 'міграції БД',
];

const QUESTION_BODY_TEMPLATES = [
  'Стикнувся з {topic} у проєкті на {tech}. Які підходи зараз вважаються канонічними? Що працює у продакшені, а що — лише на тестових прикладах?',
  'Чи правильно я розумію, що для {topic} у {tech} достатньо вбудованих засобів? Чи є сенс одразу брати готову бібліотеку?',
  'Підкажіть, з чого почати, коли потрібно швидко зрозуміти {topic} у {tech}. Лежить на проді легасі-код, потрібно мінімум змін.',
  'Як ви організовуєте {topic} у {tech}, коли команда росте і кожен пише по-своєму? Шукаю конкретні правила.',
  'Що краще пропустити, а на чому сфокусуватися при опануванні {topic} у {tech}? Часу мало, проєкт «вчора».',
];

const ANSWER_TEMPLATES = [
  'Якщо коротко — для {topic} у {tech} починаємо з offline-сценарію: фіксуємо метрики, формулюємо очікування, лише потім вибираємо інструмент.',
  'У нас на проді з {tech} {topic} вирішується трьома кроками: 1) ввімкнути базове логування, 2) додати окрему dashboard з метриками, 3) налаштувати алерти на регресії.',
  'Раджу не вигадувати: для {tech} є усталений пейпер/гайд про {topic}. Прочитайте офіційну доку, переходьте до проби, лише потім — сторонні бібліотеки.',
  'З досвіду — {topic} у {tech} ламається на найпростіших речах: тайм-зони, кодування, неконсистентні поля. Налагодьте E2E-тест на цей сценарій ще до коду.',
  'Не недооцінюйте {topic} — у великому проєкті на {tech} це часто означає окрему підсистему. Виділіть {topic} у власний модуль, окремі тести, окремі релізи.',
  'Я б подивився на питання так: який ваш SLO? Якщо «має просто працювати» — підійде дефолт. Якщо є вимоги до p99 latency — для {topic} у {tech} доведеться писати під ваш профіль.',
  'Документуйте рішення: коли наступного разу хтось зачепить {topic} у {tech} — у вас вже буде runbook, замість «давайте знову подумаємо».',
];

const ARTICLE_TOPICS = [
  'паттерни проєктування', 'розбір продуктивності', 'еволюція API',
  'досвід продакшену з', 'практичний кейс із',
  'security-аудит', 'тестова стратегія для', 'оптимізація бандлу',
];

const ARTICLE_BODY_INTRO = [
  'Ця стаття — конспект продакшен-уроків, які ми отримали, коли впроваджували {tech} і обходили підводні камені {topic}.',
  'Тут зібрано перевірені у бою прийоми {topic} у {tech}, з прикладами коду й антипатернами.',
  'Чим довше живе проєкт на {tech}, тим важливіше системно дивитися на {topic}. У статті розбираємо причини й рішення.',
];

const GUIDE_TOPICS = [
  'налаштування з нуля', 'локальний dev-середовище', 'деплой на продакшен',
  'інтеграція з CI', 'налаштування авторизації', 'підключення БД',
];

const GUIDE_SECTION = [
  '## Що знадобиться\n- {tech} відповідної версії\n- доступ до тестового середовища\n- ~30 хвилин уваги',
  '## Швидкий старт\n1. Встановити залежності\n2. Створити мінімальний приклад\n3. Перевірити роботу у dev режимі',
  '## Що далі\nПісля базового сетапу варто додати тести, моніторинг і CI-перевірку конфігурації.',
];

const SNIPPET_TOPICS = [
  'дебаунс і троттлінг', 'інфініт-скрол', 'lazy loading зображень',
  'cancel токени запитів', 'кеш у localStorage', 'pub/sub шина',
  'middleware валідації', 'helper для дат', 'helper для форматування грошей',
];

const ROADMAP_TOPICS = [
  'fullstack-розробник', 'frontend з нуля до middle', 'backend з нуля до middle',
  'DevOps інженер',
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

const BEST_PRACTICE_TOPICS = [
  'обробка помилок', 'логування', 'іменування', 'структура коду',
  'code review', 'тестування', 'feature flags',
];

const BEST_PRACTICE_RULES = [
  'Не покладайтесь на неявні дефолти — описуйте кожну поведінку явно у конфігах.',
  'Будь-яка зовнішня залежність має мати таймаут, ретраї та явну обробку помилок.',
  'Зміни схеми БД виконуйте лише через міграції, які можна повторити локально.',
  'Логи мають містити контекст: requestId, userId, traceId — інакше дебаг буде болем.',
  'Жоден важливий запит у продакшені не повинен залежати від «дефолтної» поведінки фреймворку.',
];

const FAQ_TOPICS = [
  'базові питання', 'дебаг-питання', 'продуктивність',
  'структура проєкту', 'інтеграції', 'оновлення версій',
];

const FAQ_BASE_PAIRS = [
  { q: 'Чим відрізняється від попередньої версії?', a: 'Найважливіше — зміни API, нові дефолти і кілька breaking changes. Перечитайте release notes перед апгрейдом.' },
  { q: 'Як швидко перевірити, що {topic} працює правильно?', a: 'Налаштуйте мінімальний healthcheck і smoke-тести у CI. Це покриває 80% типових регресій.' },
  { q: 'Які типові помилки новачків?', a: 'Найчастіше — копіювання конфігів без розуміння, ігнорування таймаутів, відсутність логування на кордонах системи.' },
  { q: 'Як це масштабувати?', a: 'Спочатку — горизонтально (більше інстансів), потім — оптимізація гарячих шляхів. Не оптимізуйте «про запас».' },
  { q: 'Як про це поговорити з командою?', a: 'Окрема зустріч-розбір на 30 хв із чек-листом і власником рішення. Без цього домовленості «розчиняються».' },
];

const TAG_POOL = [
  'react', 'nodejs', 'typescript', 'python', 'docker', 'architecture',
  'postgresql', 'redis', 'graphql', 'kubernetes', 'go',
  'performance', 'security', 'best-practices', 'patterns',
  'auth', 'jwt', 'logging', 'observability', 'ci-cd', 'testing',
];

const LANGUAGES = ['javascript', 'typescript', 'python', 'go', 'sql'];

const DIFFICULTIES = ['beginner', 'intermediate', 'advanced'];

const CATEGORIES = ['code-style', 'architecture', 'security', 'performance', 'reliability', 'team'];

// ── Builders ──────────────────────────────────────────────────────────────────

function buildSnippetCode(language, topic) {
  switch (language) {
    case 'python':
      return `def example(value):\n    """Demo for ${topic}."""\n    return value * 2`;
    case 'go':
      return `package main\n\nimport "fmt"\n\nfunc main() {\n    fmt.Println("${topic}")\n}`;
    case 'sql':
      return `SELECT id, name\nFROM items\nWHERE active = TRUE\nORDER BY created_at DESC\nLIMIT 50; -- ${topic}`;
    case 'typescript':
      return `export function example(value: number): number {\n  // ${topic}\n  return value * 2;\n}`;
    case 'javascript':
    default:
      return `export function example(value) {\n  // ${topic}\n  return value * 2;\n}`;
  }
}

// ── Main seed для одного юзера ────────────────────────────────────────────────

async function ensureCoAuthors(connection, userId) {
  // Шукаємо інших юзерів, які можуть бути авторами відповідей.
  const [existing] = await connection.execute(
    'SELECT id FROM users WHERE id != ? LIMIT 10',
    [userId]
  );
  if (existing.length > 0) {
    return existing.map((r) => r.id);
  }

  console.log('ℹ️  Інших юзерів у БД немає — створюю 3 seed-користувачів для відповідей...');
  const passwordHash = await bcrypt.hash('password123', 10);
  const seedUsers = [
    { username: 'admin', email: 'admin@ukroverflow.local', reputation: 5000, role: 'admin', bio: 'Адмін платформи', location: 'Київ' },
    { username: 'taras', email: 'taras@ukroverflow.local', reputation: 1250, role: 'user', bio: 'Backend / Node.js', location: 'Київ' },
    { username: 'ivan', email: 'ivan@ukroverflow.local', reputation: 620, role: 'user', bio: 'Fullstack / DevOps', location: 'Львів' },
  ];

  const ids = [];
  for (const u of seedUsers) {
    try {
      const [r] = await connection.execute(
        `INSERT INTO users (username, email, password, reputation, role, bio, location, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
        [u.username, u.email, passwordHash, u.reputation, u.role, u.bio, u.location]
      );
      ids.push(r.insertId);
    } catch (e) {
      // Якщо юзер з таким username/email вже існує — підхопимо існуючий id
      if (e?.code === 'ER_DUP_ENTRY') {
        const [rows] = await connection.execute(
          'SELECT id FROM users WHERE username = ? OR email = ? LIMIT 1',
          [u.username, u.email]
        );
        if (rows[0]?.id) ids.push(rows[0].id);
      } else {
        throw e;
      }
    }
  }
  if (ids.length === 0) {
    throw new Error('Не вдалося ані знайти, ані створити співавторів для відповідей');
  }
  return ids;
}

async function insertQuestions(connection, authorId, utils, count) {
  const created = [];
  for (let i = 0; i < count; i += 1) {
    const tech = utils.pick(TECHS);
    const topic = utils.pick(QUESTION_TOPICS);
    const title = `Як організувати ${topic} у ${tech}? (#${i + 1})`;
    const body = format(utils.pick(QUESTION_BODY_TEMPLATES), { topic, tech });
    const tags = tagsFor(tech, [], utils.pickN);
    const views = utils.intBetween(5, 200);
    const days = utils.intBetween(1, 90);
    const [r] = await connection.execute(
      `INSERT INTO questions (title, body, tags, author_id, views, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, DATE_SUB(NOW(), INTERVAL ? DAY), DATE_SUB(NOW(), INTERVAL ? DAY))`,
      [title, body, JSON.stringify(tags), authorId, views, days, days]
    );
    created.push({ id: r.insertId, topic, tech });
  }
  return created;
}

async function insertAnswers(connection, questions, coAuthorIds, utils) {
  let total = 0;
  for (const q of questions) {
    const acceptedIndex = utils.intBetween(0, 2);
    for (let i = 0; i < 3; i += 1) {
      const tmpl = ANSWER_TEMPLATES[(i + q.id) % ANSWER_TEMPLATES.length];
      const body = format(tmpl, { topic: q.topic, tech: q.tech });
      const authorId = utils.pick(coAuthorIds);
      const days = utils.intBetween(0, 60);
      await connection.execute(
        `INSERT INTO answers (body, question_id, author_id, is_accepted, upvotes, downvotes, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, DATE_SUB(NOW(), INTERVAL ? DAY), DATE_SUB(NOW(), INTERVAL ? DAY))`,
        [body, q.id, authorId, i === acceptedIndex ? 1 : 0, utils.intBetween(0, 20), utils.intBetween(0, 3), days, days]
      );
      total += 1;
    }
  }
  return total;
}

async function insertArticles(connection, authorId, utils, count) {
  for (let i = 0; i < count; i += 1) {
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
    const excerpt = intro.slice(0, 270);
    const tags = tagsFor(tech, ['article'], utils.pickN);
    const days = utils.intBetween(1, 90);
    await connection.execute(
      `INSERT INTO articles (title, body, excerpt, tags, author_id, views, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, DATE_SUB(NOW(), INTERVAL ? DAY), DATE_SUB(NOW(), INTERVAL ? DAY))`,
      [title, body, excerpt, JSON.stringify(tags), authorId, utils.intBetween(5, 200), days, days]
    );
  }
}

async function insertGuides(connection, authorId, utils, count) {
  for (let i = 0; i < count; i += 1) {
    const tech = utils.pick(TECHS);
    const topic = utils.pick(GUIDE_TOPICS);
    const title = `Гайд: ${topic} для ${tech}`;
    const summary = `Покроковий мінімальний рецепт, як виконати «${topic}» у ${tech}: інструменти, послідовність і типові помилки.`;
    const body = [
      `# ${title}`,
      summary,
      ...utils.pickN(GUIDE_SECTION, 3).map((s) => format(s, { tech, topic })),
    ].join('\n\n');
    const excerpt = summary.slice(0, 270);
    const tags = tagsFor(tech, ['guide'], utils.pickN);
    const days = utils.intBetween(1, 90);
    await connection.execute(
      `INSERT INTO guides (title, summary, excerpt, body, difficulty, estimated_minutes, tags, author_id, views, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, DATE_SUB(NOW(), INTERVAL ? DAY), DATE_SUB(NOW(), INTERVAL ? DAY))`,
      [
        title, summary, excerpt, body,
        utils.pick(DIFFICULTIES), utils.intBetween(10, 60),
        JSON.stringify(tags), authorId, utils.intBetween(5, 200), days, days,
      ]
    );
  }
}

async function insertSnippets(connection, authorId, utils, count) {
  // Гарантуємо, що мови різні (JavaScript, TypeScript, Python, Go, SQL).
  const langs = [...LANGUAGES];
  for (let i = 0; i < count; i += 1) {
    const tech = utils.pick(TECHS);
    const topic = utils.pick(SNIPPET_TOPICS);
    const language = langs[i % langs.length];
    const title = `${topic} (${language})`;
    const description = `Готовий приклад для типового кейсу «${topic}» у ${tech}. Можна копіювати у проєкт як стартову точку, а далі адаптувати під свої вимоги.`;
    const code = buildSnippetCode(language, topic);
    const excerpt = description.slice(0, 270);
    const tags = tagsFor(tech, ['snippet', language], utils.pickN);
    const days = utils.intBetween(1, 90);
    await connection.execute(
      `INSERT INTO snippets (title, description, excerpt, code, language, tags, author_id, views, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, DATE_SUB(NOW(), INTERVAL ? DAY), DATE_SUB(NOW(), INTERVAL ? DAY))`,
      [title, description, excerpt, code, language, JSON.stringify(tags), authorId, utils.intBetween(5, 200), days, days]
    );
  }
}

async function insertRoadmaps(connection, authorId, utils, count) {
  for (let i = 0; i < count; i += 1) {
    const tech = utils.pick(TECHS);
    const topic = utils.pick(ROADMAP_TOPICS);
    const title = `Roadmap: ${topic} (${tech})`;
    const summary = `Дорожня карта розвитку у напрямі «${topic}» з акцентом на стек ${tech}.`;
    const stages = utils.pickN(ROADMAP_STAGES, utils.intBetween(5, 7));
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
    const excerpt = summary.slice(0, 270);
    const tags = tagsFor(tech, ['roadmap'], utils.pickN);
    const estimatedWeeks = steps.reduce((acc, s) => acc + s.estimated_weeks, 0);
    const days = utils.intBetween(1, 90);
    await connection.execute(
      `INSERT INTO roadmaps (title, summary, excerpt, body, steps, difficulty, estimated_weeks, tags, author_id, views, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, DATE_SUB(NOW(), INTERVAL ? DAY), DATE_SUB(NOW(), INTERVAL ? DAY))`,
      [
        title, summary, excerpt, body, JSON.stringify(steps),
        utils.pick(DIFFICULTIES), estimatedWeeks,
        JSON.stringify(tags), authorId, utils.intBetween(5, 200), days, days,
      ]
    );
  }
}

async function insertBestPractices(connection, authorId, utils, count) {
  for (let i = 0; i < count; i += 1) {
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
    const antiPatterns = `Антипатерн: ігнорувати ${topic} «бо зараз і так працює».`;
    const excerpt = rule.slice(0, 270);
    const tags = tagsFor(tech, ['best-practice'], utils.pickN);
    const days = utils.intBetween(1, 90);
    await connection.execute(
      `INSERT INTO best_practices (title, rule, excerpt, body, anti_patterns, category, tags, author_id, views, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, DATE_SUB(NOW(), INTERVAL ? DAY), DATE_SUB(NOW(), INTERVAL ? DAY))`,
      [
        title, rule, excerpt, body, antiPatterns, utils.pick(CATEGORIES),
        JSON.stringify(tags), authorId, utils.intBetween(5, 200), days, days,
      ]
    );
  }
}

async function insertFaqs(connection, authorId, utils, count) {
  for (let i = 0; i < count; i += 1) {
    const tech = utils.pick(TECHS);
    const topic = utils.pick(FAQ_TOPICS);
    const title = `FAQ: ${tech} — ${topic}`;
    const qaPairs = utils.pickN(FAQ_BASE_PAIRS, utils.intBetween(3, 4)).map((p) => ({
      question: format(p.q, { tech, topic }),
      answer: format(p.a, { tech, topic }),
    }));
    const body = [
      `# ${title}`,
      `Зведення відповідей на найчастіші питання щодо ${topic} у ${tech}. Підходить як швидка довідка для нових учасників команди.`,
      ...qaPairs.map((p) => `### ${p.question}\n${p.answer}`),
    ].join('\n\n');
    const excerpt = body.replace(/[#`*\n]+/g, ' ').slice(0, 270);
    const tags = tagsFor(tech, ['faq'], utils.pickN);
    const days = utils.intBetween(1, 90);
    await connection.execute(
      `INSERT INTO faqs (title, topic, excerpt, body, qa_pairs, tags, author_id, views, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, DATE_SUB(NOW(), INTERVAL ? DAY), DATE_SUB(NOW(), INTERVAL ? DAY))`,
      [
        title, tech, excerpt, body, JSON.stringify(qaPairs),
        JSON.stringify(tags), authorId, utils.intBetween(5, 200), days, days,
      ]
    );
  }
}

// ── Entry point ───────────────────────────────────────────────────────────────

async function main() {
  const args = parseArgs(process.argv);
  const userId = args.user;
  console.log(`🌱 Seed для user_id=${userId}...\n`);

  const connection = await pool.getConnection();
  try {
    const [users] = await connection.execute(
      'SELECT id, username FROM users WHERE id = ?',
      [userId]
    );
    if (users.length === 0) {
      console.error(`❌ Користувача з id=${userId} не знайдено у таблиці users.`);
      process.exit(1);
    }
    const { username } = users[0];
    console.log(`👤 Знайдено @${username} (id=${userId})\n`);

    const coAuthorIds = await ensureCoAuthors(connection, userId);
    console.log(`✓ Співавторів для відповідей: ${coAuthorIds.length}\n`);

    const utils = makeUtils(userId);

    console.log('❓ Питання (5)...');
    const questions = await insertQuestions(connection, userId, utils, 5);
    console.log(`✓ Створено питань: ${questions.length}\n`);

    console.log('💬 Відповіді (3 на питання)...');
    const answersCount = await insertAnswers(connection, questions, coAuthorIds, utils);
    console.log(`✓ Створено відповідей: ${answersCount}\n`);

    console.log('📰 Статті (4)...');
    await insertArticles(connection, userId, utils, 4);
    console.log('✓ Статей: 4\n');

    console.log('📘 Гайди (3)...');
    await insertGuides(connection, userId, utils, 3);
    console.log('✓ Гайдів: 3\n');

    console.log('✂️  Snippets (5)...');
    await insertSnippets(connection, userId, utils, 5);
    console.log('✓ Snippets: 5\n');

    console.log('🗺️  Roadmaps (2)...');
    await insertRoadmaps(connection, userId, utils, 2);
    console.log('✓ Roadmaps: 2\n');

    console.log('🛡️  Best practices (3)...');
    await insertBestPractices(connection, userId, utils, 3);
    console.log('✓ Best practices: 3\n');

    console.log('❔ FAQs (3)...');
    await insertFaqs(connection, userId, utils, 3);
    console.log('✓ FAQs: 3\n');

    console.log(
      `✓ Створено для @${username}: 5 questions, ${answersCount} answers, 4 articles, 3 guides, 5 snippets, 2 roadmaps, 3 best_practices, 3 faqs`
    );
  } catch (err) {
    console.error('❌ Помилка seed для користувача:', err);
    process.exitCode = 1;
  } finally {
    connection.release();
    await pool.end();
  }
}

main().catch(async (err) => {
  console.error('Фатальна помилка:', err);
  try { await pool.end(); } catch { /* noop */ }
  process.exit(1);
});
