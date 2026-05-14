/**
 * Seed файл - початкові дані для бази
 */

import bcrypt from 'bcrypt';
import pool from '../config/database.js';

async function seed() {
  const connection = await pool.getConnection();

  try {
    console.log('🌱 Початок заповнення бази даних...\n');

    // 0. Очищення таблиць
    console.log('🧹 Очищення існуючих даних...');
    await connection.execute('SET FOREIGN_KEY_CHECKS = 0');
    await connection.execute('TRUNCATE TABLE votes');
    await connection.execute('TRUNCATE TABLE bookmarks');
    await connection.execute('TRUNCATE TABLE answers');
    await connection.execute('TRUNCATE TABLE questions');
    await connection.execute('TRUNCATE TABLE users');
    await connection.execute('TRUNCATE TABLE notifications');
    await connection.execute('SET FOREIGN_KEY_CHECKS = 1');
    console.log('✓ Таблиці очищено\n');

    // 1. Створення тестових користувачів
    console.log('👤 Створення користувачів...');

    const hashedPasswordUser = await bcrypt.hash('password123', 10);
    const hashedPasswordAdmin = await bcrypt.hash('admin123', 10);

    const users = [
      {
        username: 'admin',
        email: 'admin@ukroverflow.com',
        password: hashedPasswordAdmin,
        reputation: 5000,
        role: 'admin',
        bio: 'Головний адміністратор платформи',
        location: 'Київ, Україна'
      },
      {
        username: 'taras_shevchenko',
        email: 'taras@ukroverflow.com',
        password: hashedPasswordUser,
        reputation: 1250,
        role: 'user',
        bio: 'Активний учасник спільноти',
        location: 'Київ, Україна'
      },
      {
        username: 'lesya_ukrainka',
        email: 'lesya@ukroverflow.com',
        password: hashedPasswordUser,
        reputation: 850,
        role: 'moderator',
        bio: 'Модератор спільноти',
        location: 'Луцьк, Україна'
      },
      {
        username: 'ivan_franko',
        email: 'ivan@ukroverflow.com',
        password: hashedPasswordUser,
        reputation: 620,
        role: 'user',
        bio: 'Розробник та ентузіаст',
        location: 'Львів, Україна'
      }
    ];

    for (const user of users) {
      await connection.execute(
        `INSERT INTO users (username, email, password, reputation, role, bio, location, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
        [user.username, user.email, user.password, user.reputation, user.role, user.bio, user.location]
      );
    }

    console.log(`✓ Створено ${users.length} користувачів\n`);

    // 2. Створення тестових питань
    console.log('❓ Створення питань...');

    const questions = [
      {
        title: 'Як налаштувати React Router в Vite проекті?',
        body: 'Намагаюся налаштувати React Router v6 у новому проекті на Vite, але маршрути не працюють. Що я роблю не так?',
        tags: ['react', 'vite', 'react-router'],
        author_id: 2
      },
      {
        title: 'Яка різниця між let, const та var в JavaScript?',
        body: 'Не можу зрозуміти, коли використовувати let, const або var. Хтось може пояснити різницю?',
        tags: ['javascript', 'змінні', 'es6'],
        author_id: 2
      },
      {
        title: 'Як реалізувати паттерн Mediator в JavaScript?',
        body: 'Потрібно створити централізовану систему подій для великого додатку. Хто має досвід з паттерном Mediator?',
        tags: ['javascript', 'patterns', 'architecture'],
        author_id: 3
      },
      {
        title: 'Чим MySQL відрізняється від PostgreSQL для веб-API?',
        body: 'Обираю БД для Node.js + Express. Які практичні відмінності важливі для невеликого стартапу?',
        tags: ['mysql', 'postgresql', 'backend'],
        author_id: 4
      },
      {
        title: 'Як правильно зберігати паролі користувачів у Node.js?',
        body: 'Чи достатньо bcrypt і який work factor обрати у 2025 році?',
        tags: ['nodejs', 'security', 'bcrypt'],
        author_id: 2
      },
      {
        title: 'Що таке CORS і чому браузер блокує запити до API?',
        body: 'Фронт на localhost:5173, API на localhost:3338. Отримую CORS error. Як це виправити на Express?',
        tags: ['cors', 'express', 'frontend'],
        author_id: 3
      },
      {
        title: 'Як організувати структуру папок у React-проєкті?',
        body: 'features vs pages vs components — як не зробити «кашу» коли проєкт росте?',
        tags: ['react', 'architecture', 'best-practices'],
        author_id: 4
      },
      {
        title: 'Чим корисний TanStack Query (React Query)?',
        body: 'Зараз використовую useEffect + fetch. Чи варто переходити на react-query і що він дає з коробки?',
        tags: ['react', 'tanstack-query', 'async'],
        author_id: 2
      },
      {
        title: 'Як дебажити WebSocket у браузері?',
        body: 'Підключення до ws://localhost інколи обривається. Які інструменти та прийоми допомагають знайти причину?',
        tags: ['websocket', 'devtools', 'debugging'],
        author_id: 1
      },
      {
        title: 'Що таке JWT і коли його не варто використовувати?',
        body: 'Чи достатньо зберігати JWT лише в localStorage? Які альтернативи для SPA?',
        tags: ['jwt', 'auth', 'security'],
        author_id: 3
      }
    ];

    const questionIds = [];

    for (const q of questions) {
      const [result] = await connection.execute(
        `INSERT INTO questions (title, body, tags, author_id, views, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, NOW(), NOW())`,
        [q.title, q.body, JSON.stringify(q.tags), q.author_id, Math.floor(Math.random() * 100)]
      );
      questionIds.push(result.insertId);
    }

    console.log(`✓ Створено ${questions.length} питань\n`);

    // 3. Створення тестових відповідей
    console.log('💬 Створення відповідей...');

    const answers = [
      {
        body: 'Спробуйте використати BrowserRouter з react-router-dom. Не забудьте обгорнути весь додаток у Router компонент.',
        question_id: questionIds[0],
        author_id: 1,
        is_accepted: true
      },
      {
        body: 'Перевірте, що у vite.config.js base відповідає вашому деплою, і що маршрути огорнуті в <Routes> / <Route path="..." element={...} />.',
        question_id: questionIds[0],
        author_id: 3,
        is_accepted: false
      },
      {
        body: 'let — для змінних, які перепризначаються; const — коли посилання не змінюється (але вміст об’єкта можна міняти); var — функціональна область видимості, у сучасному коді краще не використовувати.',
        question_id: questionIds[1],
        author_id: 2,
        is_accepted: true
      },
      {
        body: 'У суворому режимі const і let не піднімаються (hoisting) так, як var. Тому оголошуйте змінні до використання.',
        question_id: questionIds[1],
        author_id: 4,
        is_accepted: false
      },
      {
        body: 'Можу порадити окремий клас Mediator з методами on, off та emit. Події реєструються в одному місці — простіше тестувати й розширювати.',
        question_id: questionIds[2],
        author_id: 1,
        is_accepted: true
      },
      {
        body: 'Для React інколи достатньо контексту + reducer; Mediator має сенс, коли багато незалежних модулів мають взаємодіяти без жорстких залежностей.',
        question_id: questionIds[2],
        author_id: 4,
        is_accepted: false
      },
      {
        body: 'MySQL часто простіше хостити дешево; PostgreSQL сильніший у складних запитах, JSONB, CTE. Для типового CRUD обидва підходять — дивіться на команду й хмару.',
        question_id: questionIds[3],
        author_id: 1,
        is_accepted: true
      },
      {
        body: 'Зверніть увагу на транзакції та блокування: у Postgres SERIALIZABLE поводиться передбачуваніше в складних кейсах.',
        question_id: questionIds[3],
        author_id: 3,
        is_accepted: false
      },
      {
        body: 'bcrypt (або argon2) + сіль (salt) автоматично у bcrypt. Work factor 10–12 для dev, 12+ для prod — баланс швидкості й стійкості.',
        question_id: questionIds[4],
        author_id: 1,
        is_accepted: true
      },
      {
        body: 'Ніколи не зберігайте пароль у відкритому вигляді. Порівнюйте лише хеш; додайте rate limiting на логін.',
        question_id: questionIds[4],
        author_id: 3,
        is_accepted: false
      },
      {
        body: 'На Express: app.use(cors({ origin: "http://localhost:5173", credentials: true })) якщо потрібні кукі. У продакшені whitelist доменів.',
        question_id: questionIds[5],
        author_id: 2,
        is_accepted: true
      },
      {
        body: 'Переконайтесь, що preflight OPTIONS не блокується middleware авторизації.',
        question_id: questionIds[5],
        author_id: 4,
        is_accepted: false
      },
      {
        body: 'Популярний варіант: pages/ для маршрутів, features/ для доменної логіки, shared/ui для дрібних компонентів. Головне — узгодити правило в команді.',
        question_id: questionIds[6],
        author_id: 3,
        is_accepted: true
      },
      {
        body: 'Уникайте глибоких відносних імпортів ../../../ — краще alias у vite/tsconfig (@/components).',
        question_id: questionIds[6],
        author_id: 1,
        is_accepted: false
      },
      {
        body: 'TanStack Query дає кеш, дедуплікацію запитів, refetch при фокусі, статуси loading/error без ручного boilerplate.',
        question_id: questionIds[7],
        author_id: 4,
        is_accepted: true
      },
      {
        body: 'Почніть з useQuery для GET і useMutation для POST/PUT — цього достатньо для більшості форм і списків.',
        question_id: questionIds[7],
        author_id: 2,
        is_accepted: false
      },
      {
        body: 'У Chrome DevTools → Network → WS можна бачити кадри. Логуйте onopen/onerror/onclose на клієнті та сервері.',
        question_id: questionIds[8],
        author_id: 2,
        is_accepted: true
      },
      {
        body: 'Перевірте проксі (nginx) на таймаути та idle disconnect; інколи потрібні ping/pong heartbeat кадри.',
        question_id: questionIds[8],
        author_id: 4,
        is_accepted: false
      },
      {
        body: 'JWT — підписаний токен стану; не зберігайте у ньому секрети. HttpOnly cookie + sameSite зменшує ризик XSS крадіжки сесії порівняно з localStorage.',
        question_id: questionIds[9],
        author_id: 1,
        is_accepted: true
      },
      {
        body: 'Для високої безпеки розгляньте короткоживучі access-токени + refresh у HttpOnly або сесії на сервері.',
        question_id: questionIds[9],
        author_id: 2,
        is_accepted: false
      }
    ];

    const answerIds = [];
    for (const answer of answers) {
      const [result] = await connection.execute(
        `INSERT INTO answers (body, question_id, author_id, is_accepted, created_at, updated_at)
         VALUES (?, ?, ?, ?, NOW(), NOW())`,
        [answer.body, answer.question_id, answer.author_id, answer.is_accepted]
      );
      answerIds.push(result.insertId);
    }

    console.log(`✓ Створено ${answers.length} відповідей\n`);

    // 4. Створення тестових голосів
    console.log('👍 Створення голосів...');

    const votes = [
      // питання
      { user_id: 1, entity_type: 'question', entity_id: questionIds[0], vote_type: 'up' },
      { user_id: 2, entity_type: 'question', entity_id: questionIds[0], vote_type: 'up' },
      { user_id: 3, entity_type: 'question', entity_id: questionIds[0], vote_type: 'up' },
      { user_id: 4, entity_type: 'question', entity_id: questionIds[0], vote_type: 'up' },
      { user_id: 1, entity_type: 'question', entity_id: questionIds[1], vote_type: 'up' },
      { user_id: 3, entity_type: 'question', entity_id: questionIds[1], vote_type: 'up' },
      { user_id: 4, entity_type: 'question', entity_id: questionIds[1], vote_type: 'down' },
      { user_id: 2, entity_type: 'question', entity_id: questionIds[2], vote_type: 'up' },
      { user_id: 4, entity_type: 'question', entity_id: questionIds[2], vote_type: 'up' },
      { user_id: 1, entity_type: 'question', entity_id: questionIds[3], vote_type: 'up' },
      { user_id: 2, entity_type: 'question', entity_id: questionIds[3], vote_type: 'up' },
      { user_id: 3, entity_type: 'question', entity_id: questionIds[4], vote_type: 'up' },
      { user_id: 4, entity_type: 'question', entity_id: questionIds[4], vote_type: 'up' },
      { user_id: 1, entity_type: 'question', entity_id: questionIds[5], vote_type: 'up' },
      { user_id: 2, entity_type: 'question', entity_id: questionIds[5], vote_type: 'down' },
      { user_id: 3, entity_type: 'question', entity_id: questionIds[6], vote_type: 'up' },
      { user_id: 1, entity_type: 'question', entity_id: questionIds[7], vote_type: 'up' },
      { user_id: 4, entity_type: 'question', entity_id: questionIds[7], vote_type: 'up' },
      { user_id: 2, entity_type: 'question', entity_id: questionIds[8], vote_type: 'up' },
      { user_id: 3, entity_type: 'question', entity_id: questionIds[8], vote_type: 'up' },
      { user_id: 1, entity_type: 'question', entity_id: questionIds[9], vote_type: 'up' },
      { user_id: 4, entity_type: 'question', entity_id: questionIds[9], vote_type: 'down' },
      // відповіді (індекси відповідають порядку вставки answers)
      { user_id: 2, entity_type: 'answer', entity_id: answerIds[0], vote_type: 'up' },
      { user_id: 3, entity_type: 'answer', entity_id: answerIds[0], vote_type: 'up' },
      { user_id: 4, entity_type: 'answer', entity_id: answerIds[0], vote_type: 'up' },
      { user_id: 1, entity_type: 'answer', entity_id: answerIds[1], vote_type: 'up' },
      { user_id: 3, entity_type: 'answer', entity_id: answerIds[2], vote_type: 'up' },
      { user_id: 1, entity_type: 'answer', entity_id: answerIds[2], vote_type: 'up' },
      { user_id: 4, entity_type: 'answer', entity_id: answerIds[3], vote_type: 'up' },
      { user_id: 2, entity_type: 'answer', entity_id: answerIds[4], vote_type: 'up' },
      { user_id: 3, entity_type: 'answer', entity_id: answerIds[4], vote_type: 'up' },
      { user_id: 1, entity_type: 'answer', entity_id: answerIds[5], vote_type: 'down' },
      { user_id: 2, entity_type: 'answer', entity_id: answerIds[6], vote_type: 'up' },
      { user_id: 4, entity_type: 'answer', entity_id: answerIds[6], vote_type: 'up' },
      { user_id: 1, entity_type: 'answer', entity_id: answerIds[7], vote_type: 'up' },
      { user_id: 2, entity_type: 'answer', entity_id: answerIds[8], vote_type: 'up' },
      { user_id: 3, entity_type: 'answer', entity_id: answerIds[8], vote_type: 'up' },
      { user_id: 4, entity_type: 'answer', entity_id: answerIds[8], vote_type: 'up' },
      { user_id: 1, entity_type: 'answer', entity_id: answerIds[9], vote_type: 'up' },
      { user_id: 2, entity_type: 'answer', entity_id: answerIds[10], vote_type: 'up' },
      { user_id: 3, entity_type: 'answer', entity_id: answerIds[11], vote_type: 'up' },
      { user_id: 1, entity_type: 'answer', entity_id: answerIds[12], vote_type: 'up' },
      { user_id: 4, entity_type: 'answer', entity_id: answerIds[12], vote_type: 'up' },
      { user_id: 2, entity_type: 'answer', entity_id: answerIds[13], vote_type: 'up' },
      { user_id: 3, entity_type: 'answer', entity_id: answerIds[14], vote_type: 'up' },
      { user_id: 1, entity_type: 'answer', entity_id: answerIds[15], vote_type: 'up' },
      { user_id: 2, entity_type: 'answer', entity_id: answerIds[16], vote_type: 'up' },
      { user_id: 4, entity_type: 'answer', entity_id: answerIds[17], vote_type: 'up' },
      { user_id: 3, entity_type: 'answer', entity_id: answerIds[18], vote_type: 'up' }
    ];

    for (const vote of votes) {
      await connection.execute(
        `INSERT INTO votes (user_id, entity_type, entity_id, vote_type, created_at)
         VALUES (?, ?, ?, ?, NOW())`,
        [vote.user_id, vote.entity_type, vote.entity_id, vote.vote_type]
      );
    }

    console.log(`✓ Створено ${votes.length} голосів\n`);

    console.log('✅ Заповнення бази завершено успішно!');
    console.log('\n📊 Тестові дані:');
    console.log(`   Користувачів: ${users.length}`);
    console.log(`   Питань: ${questions.length}`);
    console.log(`   Відповідей: ${answers.length}`);
    console.log(`   Голосів: ${votes.length}`);
    console.log('\n🔑 Тестові облікові дані:');
    console.log('   👤 Користувач:');
    console.log('      Email: taras@ukroverflow.com');
    console.log('      Пароль: password123');
    console.log('   👑 Адміністратор:');
    console.log('      Email: admin@ukroverflow.com');
    console.log('      Пароль: admin123');
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
