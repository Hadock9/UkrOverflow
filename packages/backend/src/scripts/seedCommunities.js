/**
 * Seed: спільноти, пости, коментарі, mentor_profiles.
 *
 * Використання:
 *   node src/scripts/seedCommunities.js --user 11
 *   node src/scripts/seedCommunities.js --user 11 --large
 *
 * Лише INSERT, без TRUNCATE. Скрипт ідемпотентний на рівні slug-ів:
 * вставляється з ON DUPLICATE KEY UPDATE, тож повторні запуски не падають.
 */

import 'dotenv/config';
import pool from '../config/database.js';

function parseArgs(argv) {
  const args = { user: 11, large: false };
  for (let i = 2; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === '--user' || a === '-u') {
      const n = parseInt(argv[i + 1], 10);
      if (Number.isFinite(n)) args.user = n;
      i += 1;
    } else if (a.startsWith('--user=')) {
      const n = parseInt(a.slice('--user='.length), 10);
      if (Number.isFinite(n)) args.user = n;
    } else if (a === '--large' || a === '-l') {
      args.large = true;
    }
  }
  return args;
}

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

// ── Дані ─────────────────────────────────────────────────────────────────────

const COMMUNITIES = [
  {
    slug: 'devhub-lviv',
    name: 'DevFlow Львів',
    type: 'city',
    location: 'Львів',
    website: 'https://devhub.ua/lviv',
    description: 'Львівська спільнота розробників. Зустрічаємось офлайн на meetup-ах, обмінюємось досвідом, шукаємо колег у проєкти.',
    tags: ['frontend', 'backend', 'meetup'],
  },
  {
    slug: 'knu-devclub',
    name: 'КНУ DevClub',
    type: 'university',
    location: 'Київ',
    website: 'https://devclub.knu.ua',
    description: 'Студентський клуб розробників КНУ ім. Шевченка. Алгоритми, олімпіади, командні проєкти і ментор-сесії від випускників.',
    tags: ['students', 'algorithms'],
  },
  {
    slug: 'react-ukraine',
    name: 'React Ukraine',
    type: 'online',
    location: null,
    website: 'https://react.ua',
    description: 'Найбільша українська спільнота React-розробників. TypeScript, Next.js, performance, real-world кейси.',
    tags: ['react', 'typescript', 'frontend'],
  },
  {
    slug: 'indie-hackers-ua',
    name: 'Indie Hackers UA',
    type: 'dev_club',
    location: null,
    website: 'https://indiehackers.ua',
    description: 'Спільнота українських solopreneur-ів та indie-розробників. Запускаємо власні продукти, шерим виручку, обговорюємо ринок.',
    tags: ['startup', 'solopreneur'],
  },
  {
    slug: 'open-source-gurtom',
    name: 'Open Source Гуртом',
    type: 'online',
    location: null,
    website: 'https://oss.org.ua',
    description: 'Український open-source. Координуємо контриб’юції, перекладаємо доку, ведемо власні бібліотеки і шукаємо мейнтейнерів.',
    tags: ['oss', 'collaboration'],
  },
  {
    slug: 'devhub-kyiv',
    name: 'DevFlow Київ',
    type: 'city',
    location: 'Київ',
    website: 'https://devhub.ua/kyiv',
    description: 'Київська спільнота fullstack-розробників. Щотижневі мітинги, code review nights і спільні pet-проєкти.',
    tags: ['kyiv', 'fullstack', 'meetup'],
  },
  {
    slug: 'devhub-kharkiv',
    name: 'DevFlow Харків',
    type: 'city',
    location: 'Харків',
    website: 'https://devhub.ua/kharkiv',
    description: 'Харківські розробники: алгоритми, embedded, web. Ділимось вакансіями, менторимо студентів, запускаємо хакатони.',
    tags: ['kharkiv', 'algorithms', 'embedded'],
  },
  {
    slug: 'devhub-odesa',
    name: 'DevFlow Одеса',
    type: 'city',
    location: 'Одеса',
    website: 'https://devhub.ua/odesa',
    description: 'Одеська IT-спільнота. Mobile, backend, DevOps — зустрічі біля моря та онлайн-стріми з розборами коду.',
    tags: ['odesa', 'mobile', 'devops'],
  },
  {
    slug: 'kpi-code',
    name: 'КПІ Code Society',
    type: 'university',
    location: 'Київ',
    website: 'https://kpi.devclub.ua',
    description: 'Студенти КПІ: конкурси програмування, лабораторні проєкти, підготовка до співбесід у FAANG-стилі компаніях.',
    tags: ['kpi', 'students', 'cp'],
  },
  {
    slug: 'naukma-dev',
    name: 'NaUKMA Developers',
    type: 'university',
    location: 'Київ',
    website: 'https://naukma.dev',
    description: 'Розробники НаУКМА: open lectures, summer schools, спільні репозиторії з курсами та менторські пари.',
    tags: ['naukma', 'students'],
  },
  {
    slug: 'python-ua',
    name: 'Python Ukraine',
    type: 'online',
    location: null,
    website: 'https://python.org.ua',
    description: 'Django, FastAPI, data science, automation. Обговорюємо PEP, asyncio, типізацію та кар’єру в Python-екосистемі.',
    tags: ['python', 'django', 'fastapi'],
  },
  {
    slug: 'gamedev-ua',
    name: 'GameDev Ukraine',
    type: 'dev_club',
    location: null,
    website: 'https://gamedev.ua',
    description: 'Unity, Unreal, Godot — інді та AA-студії. Шейдери, геймдизайн, оптимізація та портфоліо для джунів.',
    tags: ['gamedev', 'unity', 'unreal'],
  },
  {
    slug: 'devops-ua',
    name: 'DevOps & Platform UA',
    type: 'online',
    location: null,
    website: 'https://devops.ua',
    description: 'Kubernetes, Terraform, observability. Ділимось runbook-ами, SRE-практиками та досвідом міграцій у хмару.',
    tags: ['devops', 'kubernetes', 'terraform'],
  },
  {
    slug: 'women-in-tech-ua',
    name: 'Women in Tech UA',
    type: 'online',
    location: null,
    website: 'https://wit.ua',
    description: 'Підтримка жінок у IT: менторство, кар’єрні консультації, безпечний простір для питань і нетворкінгу.',
    tags: ['diversity', 'mentorship', 'career'],
  },
  {
    slug: 'blockchain-kyiv',
    name: 'Blockchain Kyiv',
    type: 'dev_club',
    location: 'Київ',
    website: 'https://blockchain.kyiv.dev',
    description: 'Web3, Solidity, security audits. Розбираємо смарт-контракти, DeFi-архітектуру та регуляторний контекст в Україні.',
    tags: ['web3', 'solidity', 'security'],
  },
];

const POST_TYPES = ['discussion', 'pet_project', 'code_review', 'mentor_request', 'roadmap_request', 'team_search', 'event', 'announcement'];

const TYPE_TEMPLATES = {
  discussion: {
    titles: [
      'Як ви організовуєте код-рев’ю у розподіленій команді?',
      'Tailwind vs CSS Modules — що оберете для нового проєкту?',
      'Чи варто переходити з Express на Fastify?',
      'Як ви тримаєте монорепо у формі — Nx, Turborepo чи кастом?',
    ],
    body: 'Хочеться зібрати ваш досвід. Ми маємо чотири продуктові команди, кожна тягне свій стек. Як організовуєте процеси, метрики, шерені компоненти? Розкажіть і про граблі, і про вдалі рішення.',
    stack: () => ['javascript', 'react'],
    meta: () => ({}),
  },
  pet_project: {
    titles: [
      'Pet project: український Pomodoro з рейтинговою системою',
      'Шукаю фронтенд: budgeting-app з open banking API',
      'Pet project: AI-помічник для українських школярів',
      'Команда у hobby-проєкт: маркетплейс домашніх майстрів',
    ],
    body: 'Pet project з нуля. Маю готову ідею і базовий бекенд на Node.js + PostgreSQL. Шукаю людей, кому це цікаво, щоб разом довести до MVP. Готовий ділитися продакт-візією і навчати по дорозі.',
    stack: () => ['nodejs', 'react', 'postgresql'],
    meta: (utils) => ({
      roles: utils.pickN(['Frontend', 'Backend', 'Designer', 'QA', 'DevOps'], utils.intBetween(2, 3)),
      commitmentHoursWeek: utils.intBetween(4, 12),
      projectStage: utils.pick(['idea', 'mvp', 'production']),
    }),
  },
  code_review: {
    titles: [
      'Code review: рефакторинг useEffect-ланцюжків у React',
      'Code review: GraphQL-резолвери у NestJS',
      'Code review: оптимізація SQL-запитів у звітнику',
    ],
    body: 'Підготував PR з рефакторингом — близько 400 рядків. Хотів би почути критичний погляд: іменування, межі модулів, edge-cases. Дам контекст у коментарях. Заздалегідь дякую.',
    stack: () => ['typescript', 'react'],
    meta: () => ({
      repoUrl: 'https://github.com/devhub-ua/example-app',
      prUrl: 'https://github.com/devhub-ua/example-app/pull/42',
      focusAreas: ['readability', 'performance', 'error-handling'],
    }),
  },
  mentor_request: {
    titles: [
      'Шукаю ментора з React + TypeScript на 2 місяці',
      'Mentor wanted: системний дизайн для middle backend',
      'Шукаю ментора з Go для переходу з Node.js',
    ],
    body: 'Маю 1.5 року комерційного досвіду, хочу прокачати конкретні теми: state management, тестування і performance. Готовий працювати у форматі weekly call + перегляд PR. Скільки годин на тиждень — узгодимо.',
    stack: () => ['react', 'typescript'],
    meta: () => ({
      topic: 'React performance + архітектура',
      currentLevel: 'junior',
      goal: 'Перейти на middle за 3 місяці',
    }),
  },
  roadmap_request: {
    titles: [
      'Шукаю roadmap до middle Node.js за 6 місяців',
      'Допоможіть скласти план переходу з QA у backend',
      'Roadmap по data engineering — з чого почати?',
    ],
    body: 'Маю чіткі цілі і 10 годин на тиждень. Прошу досвідчених скласти структурований план: що читати, що писати у коді, які мілстоуни. Зворотний звʼязок гарантую — буду публікувати прогрес кожні два тижні.',
    stack: () => ['javascript', 'nodejs'],
    meta: () => ({
      goal: 'Стати middle Node.js розробником',
      currentSkills: ['JS', 'HTML', 'CSS', 'Git'],
      timelineMonths: 6,
    }),
  },
  team_search: {
    titles: [
      'Шукаю команду на хакатон EthereumKyiv',
      'Збираю команду на open-source бібліотеку для форм',
      'Шукаю партнерів для запуску SaaS у фінтех-ніші',
    ],
    body: 'Маю продуктову ідею і кілька прототипів. Шукаю людей, готових інвестувати час у спільну справу. Готовий ділитися капіталом і відповідальністю. Деталі — у дзвінку.',
    stack: () => ['typescript', 'nodejs', 'react'],
    meta: (utils) => ({
      roles: utils.pickN(['Frontend', 'Backend', 'Product', 'Sales'], utils.intBetween(2, 3)),
    }),
  },
  event: {
    titles: [
      'Meetup: Microservices у продакшені — досвід 2026',
      'Workshop: TypeScript Advanced Types за 3 години',
      'Подія: Open-source weekend у Києві',
    ],
    body: 'Запрошуємо на офлайн-зустріч. Будуть три доповіді, нетворкінг, кава і піца. Реєстрація — за посиланням нижче. Місць обмежено, приходьте заздалегідь.',
    stack: () => ['typescript'],
    meta: () => ({
      location: 'Київ, простір DevFlow',
      eventDate: '2026-06-15T18:00:00Z',
      eventLink: 'https://devhub.ua/events/meetup-2026',
    }),
  },
  announcement: {
    titles: [
      'Анонс: нова рубрика «Розбір продакшену»',
      'Оголошення: відкритий набір модераторів',
      'Анонс: щомісячний звіт спільноти за травень',
    ],
    body: 'Ділимось новинами спільноти. Розпочинаємо нову ініціативу — раз на місяць один з учасників робить розбір реального продакшен-кейсу. Хто готовий поділитись — пишіть у коментарі.',
    stack: () => ['general'],
    meta: () => ({}),
  },
};

const COMMENT_TEMPLATES = [
  'Підпишусь — теж стикався з цим. Цікаво почути конкретні цифри.',
  'Раджу глянути доку — там у розділі про performance є таблиця компромісів.',
  'У нас працює варіант B, але з допфайлом конфігурації. Готовий поділитись gist-ом.',
  'А вимірювали p99 latency? Без цифр будь-яка дискусія — філософія.',
  'Дякую за тред, додав у закладки. Корисний reference на майбутнє.',
  'Я б почав з простого MVP без оптимізацій — і вже потім дивився, що болить.',
  'Спробуйте feature flags — це зменшує ризик помилки удесятеро.',
];

const MENTOR_TEMPLATES = [
  {
    bio: 'Senior frontend з 7 роками досвіду. Спеціалізуюсь на React + TypeScript у продуктових компаніях. Допомагаю з архітектурою, перформансом і кар’єрним ростом до middle/senior.',
    stack: ['react', 'typescript', 'nextjs'],
    topics: ['architecture', 'performance', 'career'],
    languages: ['ua', 'en'],
    availability: 6,
    contact: 'Telegram @react_mentor_ua',
    price: 'Безкоштовно для junior, для senior — pay what you want',
  },
  {
    bio: 'Backend tech lead у Node.js команді. Великий досвід з PostgreSQL, мікросервісами і інфраструктурою на AWS. Веду роботу з кадровим резервом українського IT.',
    stack: ['nodejs', 'postgresql', 'aws'],
    topics: ['backend', 'system-design', 'aws'],
    languages: ['ua'],
    availability: 4,
    contact: 'Email mentor@devhub.ua',
    price: 'Без оплати, лише за рекомендацію інших ментор-сесій',
  },
  {
    bio: 'ML-інженер у скейл-апі. Python, PyTorch, MLOps. Можу провести через шлях від класичного ML до продакшен-моделей із моніторингом.',
    stack: ['python', 'pytorch', 'mlops'],
    topics: ['ml', 'data-pipelines', 'mlops'],
    languages: ['ua', 'en'],
    availability: 5,
    contact: 'Linkedin /in/ml-mentor-ua',
    price: 'Free для студентів',
  },
  {
    bio: 'Go-розробник з фокусом на платформну інженерію та Kubernetes. 5 років у продакшені, кілька великих open-source-контрибуцій.',
    stack: ['go', 'kubernetes', 'grpc'],
    topics: ['platform', 'devops', 'go'],
    languages: ['ua', 'en'],
    availability: 3,
    contact: 'Telegram @go_k8s_ua',
    price: 'Безкоштовно',
  },
  {
    bio: 'Java/Spring tech lead. Старт у банківському секторі, тепер у enterprise-стартапі. Знаю, як скейлити команди і робити сумісні з legacy рішеннями архітектури.',
    stack: ['java', 'spring', 'kafka'],
    topics: ['java', 'enterprise', 'leadership'],
    languages: ['ua'],
    availability: 4,
    contact: 'Email java.mentor@devhub.ua',
    price: 'Donation-based',
  },
  {
    bio: 'Django/Python інженер з 6 роками досвіду у data-heavy продуктах. Спеціалізуюсь на performance, data-моделюванні і internal tooling.',
    stack: ['python', 'django', 'postgresql'],
    topics: ['backend', 'data', 'optimization'],
    languages: ['ua', 'en'],
    availability: 5,
    contact: 'Telegram @py_mentor_ua',
    price: 'Безкоштовно',
  },
  {
    bio: 'Mobile-розробник, React Native + Swift. Запускав 5+ продуктових застосунків у топ-10 категорій App Store.',
    stack: ['react-native', 'swift', 'typescript'],
    topics: ['mobile', 'product', 'release'],
    languages: ['ua'],
    availability: 3,
    contact: 'Email mobile.mentor@devhub.ua',
    price: 'PWYW',
  },
  {
    bio: 'Product designer + UX researcher у B2B SaaS. Допомагаю розробникам говорити з дизайнерами однією мовою і будувати usable UI.',
    stack: ['figma', 'ux', 'design-systems'],
    topics: ['design', 'ux', 'product'],
    languages: ['ua', 'en'],
    availability: 4,
    contact: 'Telegram @ux_mentor_ua',
    price: 'Безкоштовно для студентів',
  },
  {
    bio: 'Security engineer: OWASP, pentest, secure SDLC. Проводжу через threat modeling і code review з фокусом на вразливості.',
    stack: ['security', 'owasp', 'nodejs'],
    topics: ['security', 'appsec', 'compliance'],
    languages: ['ua', 'en'],
    availability: 2,
    contact: 'Email security@devhub.ua',
    price: 'Donation-based',
  },
  {
    bio: 'Data engineer: Spark, Airflow, dbt. Будую пайплайни від raw data до аналітичних вітрин у продуктових компаніях.',
    stack: ['python', 'spark', 'airflow'],
    topics: ['data-engineering', 'etl', 'analytics'],
    languages: ['ua'],
    availability: 5,
    contact: 'Linkedin /in/data-mentor-ua',
    price: 'Безкоштовно',
  },
  {
    bio: 'QA lead з автоматизацією на Playwright і Cypress. Допомагаю командам будувати піраміду тестів і CI для регресії.',
    stack: ['playwright', 'cypress', 'typescript'],
    topics: ['qa', 'automation', 'ci'],
    languages: ['ua', 'en'],
    availability: 6,
    contact: 'Telegram @qa_mentor_ua',
    price: 'Free для open-source проєктів',
  },
  {
    bio: 'Rust-розробник у systems/low-latency. Допомагаю з ownership, async runtime і інтеграцією Rust у існуючі стеки.',
    stack: ['rust', 'tokio', 'wasm'],
    topics: ['rust', 'systems', 'performance'],
    languages: ['ua', 'en'],
    availability: 3,
    contact: 'Email rust@devhub.ua',
    price: 'PWYW',
  },
  {
    bio: 'Tech recruiter + career coach для українських розробників. CV, співбесіди, salary negotiation, перехід між ролями.',
    stack: ['career', 'interviews', 'leadership'],
    topics: ['career', 'interviews', 'soft-skills'],
    languages: ['ua', 'en'],
    availability: 8,
    contact: 'Telegram @career_mentor_ua',
    price: 'Безкоштовно для junior',
  },
  {
    bio: 'Embedded / IoT інженер. C, RTOS, прошивки, протоколи. Допомагаю студентам і джуніорам з hardware-adjacent проєктами.',
    stack: ['c', 'embedded', 'iot'],
    topics: ['embedded', 'firmware', 'hardware'],
    languages: ['ua'],
    availability: 4,
    contact: 'Email embedded@devhub.ua',
    price: 'Безкоштовно',
  },
];

// ── Допоміжне ────────────────────────────────────────────────────────────────

async function ensureOwnerExists(ownerId) {
  const [rows] = await pool.execute('SELECT id FROM users WHERE id = ?', [ownerId]);
  if (rows.length === 0) {
    throw new Error(`Користувача з id=${ownerId} не знайдено. Спершу запустіть seed.js або вкажіть валідний --user.`);
  }
}

async function loadCandidateUserIds(limit = 50) {
  const [rows] = await pool.query(`SELECT id FROM users ORDER BY id ASC LIMIT ${limit}`);
  return rows.map((r) => r.id);
}

async function insertCommunity(c, ownerId) {
  await pool.execute(
    `INSERT INTO communities (slug, name, type, description, location, website, owner_id, member_count, post_count, is_public, tags)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, 1, ?)
     ON DUPLICATE KEY UPDATE
       name = VALUES(name),
       type = VALUES(type),
       description = VALUES(description),
       location = VALUES(location),
       website = VALUES(website),
       tags = VALUES(tags)`,
    [
      c.slug, c.name, c.type, c.description, c.location, c.website,
      ownerId, c.memberCount, JSON.stringify(c.tags || []),
    ]
  );
  const [rows] = await pool.execute('SELECT id FROM communities WHERE slug = ?', [c.slug]);
  return rows[0].id;
}

async function ensureMembership(communityId, userId, role) {
  try {
    await pool.execute(
      `INSERT INTO community_memberships (community_id, user_id, role) VALUES (?, ?, ?)`,
      [communityId, userId, role]
    );
  } catch (e) {
    if (e?.code !== 'ER_DUP_ENTRY') throw e;
  }
}

async function insertPost(communityId, post) {
  const [r] = await pool.execute(
    `INSERT INTO community_posts
       (community_id, author_id, type, title, body, metadata, stack, votes, views, comment_count, status)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?)`,
    [
      communityId, post.author_id, post.type, post.title, post.body,
      JSON.stringify(post.metadata || {}),
      JSON.stringify(post.stack || []),
      post.votes, post.views, post.status,
    ]
  );
  return r.insertId;
}

async function insertComment(postId, authorId, body) {
  await pool.execute(
    `INSERT INTO community_post_comments (post_id, author_id, parent_id, body) VALUES (?, ?, NULL, ?)`,
    [postId, authorId, body]
  );
}

async function syncCommentCount(postId) {
  await pool.execute(
    `UPDATE community_posts SET comment_count = (SELECT COUNT(*) FROM community_post_comments WHERE post_id = ?) WHERE id = ?`,
    [postId, postId]
  );
}

async function syncMemberAndPostCounts(communityId) {
  await pool.execute(
    `UPDATE communities
        SET member_count = (SELECT COUNT(*) FROM community_memberships WHERE community_id = ?),
            post_count   = (SELECT COUNT(*) FROM community_posts WHERE community_id = ?)
      WHERE id = ?`,
    [communityId, communityId, communityId]
  );
}

async function upsertMentor(userId, m) {
  await pool.execute(
    `INSERT INTO mentor_profiles
       (user_id, is_active, bio, stack, topics, languages, availability_hours_week, price_note, contact_method)
     VALUES (?, 1, ?, ?, ?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE
       is_active = VALUES(is_active),
       bio = VALUES(bio),
       stack = VALUES(stack),
       topics = VALUES(topics),
       languages = VALUES(languages),
       availability_hours_week = VALUES(availability_hours_week),
       price_note = VALUES(price_note),
       contact_method = VALUES(contact_method)`,
    [
      userId, m.bio,
      JSON.stringify(m.stack), JSON.stringify(m.topics), JSON.stringify(m.languages),
      m.availability, m.price, m.contact,
    ]
  );
}

// ── Запуск ───────────────────────────────────────────────────────────────────

async function main() {
  const { user: ownerId, large } = parseArgs(process.argv);
  const postsMin = large ? 14 : 8;
  const postsMax = large ? 22 : 12;
  const maxExtraMembers = large ? 22 : 12;
  const commentChance = large ? 0.85 : 0.7;
  const userPoolLimit = large ? 50 : 30;

  console.log(`🌱 seedCommunities — owner_id=${ownerId}${large ? ' (large)' : ''}\n`);

  await ensureOwnerExists(ownerId);
  const candidateUserIds = await loadCandidateUserIds(userPoolLimit);
  if (!candidateUserIds.includes(ownerId)) candidateUserIds.push(ownerId);

  const utils = makeUtils(ownerId * 17 + 11);

  const createdCommunities = [];
  let postsTotal = 0;
  let commentsTotal = 0;
  let mentorsTotal = 0;

  for (const base of COMMUNITIES) {
    const memberCount = utils.intBetween(large ? 25 : 8, large ? 280 : 150);
    const communityId = await insertCommunity({ ...base, memberCount }, ownerId);

    await ensureMembership(communityId, ownerId, 'owner');

    const extraMembers = utils.pickN(
      candidateUserIds.filter((u) => u !== ownerId),
      Math.min(maxExtraMembers, candidateUserIds.length - 1)
    );
    for (const uid of extraMembers) {
      await ensureMembership(communityId, uid, utils.rand() < 0.15 ? 'admin' : 'member');
    }

    // Створимо стабільний пул авторів: owner + extraMembers
    const authorPool = [ownerId, ...extraMembers];

    const targetCount = utils.intBetween(postsMin, postsMax);
    const types = [...POST_TYPES];
    while (types.length < targetCount) {
      types.push(utils.pick(POST_TYPES));
    }

    for (let i = 0; i < targetCount; i += 1) {
      const t = types[i];
      const tpl = TYPE_TEMPLATES[t];
      const post = {
        author_id: utils.pick(authorPool),
        type: t,
        title: utils.pick(tpl.titles),
        body: tpl.body,
        metadata: tpl.meta(utils),
        stack: tpl.stack(utils),
        votes: utils.intBetween(0, 30),
        views: utils.intBetween(10, 800),
        status: utils.rand() < 0.85 ? 'open' : (utils.rand() < 0.5 ? 'closed' : 'filled'),
      };
      const postId = await insertPost(communityId, post);
      postsTotal += 1;

      if (utils.rand() < commentChance) {
        const cn = utils.intBetween(large ? 4 : 3, large ? 8 : 5);
        for (let j = 0; j < cn; j += 1) {
          const author = utils.pick(authorPool);
          const body = utils.pick(COMMENT_TEMPLATES);
          await insertComment(postId, author, body);
          commentsTotal += 1;
        }
        await syncCommentCount(postId);
      }
    }

    await syncMemberAndPostCounts(communityId);
    createdCommunities.push({ id: communityId, ...base });
  }

  const mentorSlots = large
    ? Math.min(MENTOR_TEMPLATES.length, candidateUserIds.length)
    : Math.min(7, MENTOR_TEMPLATES.length, candidateUserIds.length);
  const mentorUserPool = utils.pickN(
    [ownerId, ...candidateUserIds.filter((u) => u !== ownerId)],
    mentorSlots
  );
  if (!mentorUserPool.includes(ownerId)) mentorUserPool[0] = ownerId;

  for (let i = 0; i < mentorUserPool.length; i += 1) {
    const uid = mentorUserPool[i];
    const tpl = MENTOR_TEMPLATES[i % MENTOR_TEMPLATES.length];
    await upsertMentor(uid, tpl);
    mentorsTotal += 1;
  }

  console.log('✅ seedCommunities завершено.');
  console.log(`   Спільнот:     ${createdCommunities.length}`);
  console.log(`   Постів:       ${postsTotal}`);
  console.log(`   Коментарів:   ${commentsTotal}`);
  console.log(`   Mentor-ів:    ${mentorsTotal}`);
}

main()
  .catch((err) => {
    console.error('❌ seedCommunities помилка:', err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });
