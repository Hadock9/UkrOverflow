/**
 * Сторінка створення нового питання
 */

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMediator } from '../contexts/MediatorContext';
import { useAuth } from '../contexts/AuthContext';
import { EventTypes } from '../../../mediator/src/index';
import { api } from '../services/api';
import { MarkdownEditor } from '../components/MarkdownEditor';
import { AITagSuggester } from '../components/AITagSuggester';
import '../styles/brutalism.css';

export function NewQuestion() {
  const navigate = useNavigate();
  const mediator = useMediator();
  const { user } = useAuth();

  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [tagsInput, setTagsInput] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState({});

  const validate = () => {
    const newErrors = {};

    if (!title.trim()) {
      newErrors.title = 'Заголовок обов\'язковий';
    } else if (title.length < 10) {
      newErrors.title = 'Заголовок має бути мінімум 10 символів';
    } else if (title.length > 255) {
      newErrors.title = 'Заголовок має бути максимум 255 символів';
    }

    if (!body.trim()) {
      newErrors.body = 'Текст питання обов\'язковий';
    } else if (body.length < 30) {
      newErrors.body = 'Текст питання має бути мінімум 30 символів';
    }

    if (!tagsInput.trim()) {
      newErrors.tags = 'Додайте хоча б один тег';
    }

    const tags = tagsInput.split(',').map(t => t.trim()).filter(Boolean);
    if (tags.length > 5) {
      newErrors.tags = 'Максимум 5 тегів';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!user) {
      alert('Увійдіть, щоб створити питання');
      navigate('/login');
      return;
    }

    if (!validate()) {
      return;
    }

    setSubmitting(true);

    try {
      const tags = tagsInput
        .split(',')
        .map(t => t.trim().toLowerCase())
        .filter(Boolean);

      mediator.emit(EventTypes.USER_ACTION, {
        action: 'create_question',
        tagsCount: tags.length
      }, 'NewQuestion');

      const response = await api.post('/questions', {
        title: title.trim(),
        body: body.trim(),
        tags
      });

      const questionData = response.data.data?.question || response.data.question || response.data;

      mediator.emit(EventTypes.QUESTION_CREATE, {
        questionId: questionData.id,
        title: title.trim()
      }, 'NewQuestion');

      mediator.emit(EventTypes.NOTIFICATION, {
        type: 'success',
        message: 'Питання створено'
      }, 'NewQuestion');

      navigate(`/questions/${questionData.id}`);
    } catch (error) {
      console.error('Помилка створення питання:', error);

      mediator.emit(EventTypes.API_ERROR, {
        endpoint: '/questions',
        error: error.message
      }, 'NewQuestion');

      if (error.response?.data?.errors) {
        const apiErrors = {};
        error.response.data.errors.forEach(err => {
          apiErrors[err.field] = err.message;
        });
        setErrors(apiErrors);
      } else {
        alert(error.response?.data?.message || 'Помилка створення питання');
      }
    } finally {
      setSubmitting(false);
    }
  };

  if (!user) {
    return (
      <div className="container">
        <div className="empty-state">
          <h2>УВІЙДІТЬ, ЩОБ СТВОРИТИ ПИТАННЯ</h2>
          <button onClick={() => navigate('/login')} className="btn btn-primary">
            УВІЙТИ
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="container">
      <div className="page-header">
        <h1 className="page-title">НОВЕ ПИТАННЯ</h1>
        <p className="page-subtitle">
          Формат knowledge hub для проблем, обговорень і відповідей від спільноти
        </p>
      </div>

      <div className="question-card" style={{ marginBottom: 'var(--space-4)' }}>
        <div className="question-content">
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 'var(--space-2)', alignItems: 'center' }}>
            <span className="tag">Питання</span>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => navigate('/create')}
              disabled={submitting}
            >
              ІНШІ ФОРМАТИ
            </button>
          </div>
          <p style={{ marginTop: 'var(--space-2)', marginBottom: 0 }}>
            Далі тут з’являться окремі форми для статей, міні-гайдів, snippets, roadmap-ів, best practices та FAQ.
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="question-form">
        {/* Заголовок */}
        <div className="form-group">
          <label htmlFor="title" className="form-label">
            ЗАГОЛОВОК
          </label>
          <input
            type="text"
            id="title"
            className={`form-input ${errors.title ? 'error' : ''}`}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Наприклад: Як налаштувати React Router в Vite?"
            maxLength={255}
          />
          {errors.title && <div className="form-error">{errors.title}</div>}
          <div className="form-hint">
            Будьте конкретним та уявіть, що ви задаєте питання іншій людині
          </div>
        </div>

        {/* Тіло питання */}
        <div className="form-group">
          <label htmlFor="body" className="form-label">
            ОПИС ПРОБЛЕМИ
          </label>
          <MarkdownEditor
            value={body}
            onChange={setBody}
            showPreview={true}
          />
          {errors.body && <div className="form-error">{errors.body}</div>}
          <div className="form-hint">
            Включіть всі деталі, які можуть допомогти іншим зрозуміти вашу проблему.
            Підтримується Markdown форматування.
          </div>
        </div>

        {/* Теги */}
        <div className="form-group">
          <label htmlFor="tags" className="form-label">
            ТЕГИ
          </label>
          <input
            type="text"
            id="tags"
            className={`form-input ${errors.tags ? 'error' : ''}`}
            value={tagsInput}
            onChange={(e) => setTagsInput(e.target.value)}
            placeholder="react, javascript, vite (через кому)"
          />
          {errors.tags && <div className="form-error">{errors.tags}</div>}

          {/* AI Tag Suggester */}
          <AITagSuggester
            title={title}
            body={body}
            onTagsSelected={(aiTags) => {
              const currentTags = tagsInput ? tagsInput.split(',').map(t => t.trim()).filter(Boolean) : [];
              const newTags = [...new Set([...currentTags, ...aiTags])].slice(0, 5);
              setTagsInput(newTags.join(', '));
            }}
          />

          <div className="form-hint">
            Додайте до 5 тегів для опису теми вашого питання (розділені комами)
          </div>
        </div>

        {/* Кнопки */}
        <div className="form-actions">
          <button
            type="submit"
            className="btn btn-primary"
            disabled={submitting}
          >
            {submitting ? 'СТВОРЕННЯ...' : 'ОПУБЛІКУВАТИ ПИТАННЯ'}
          </button>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => navigate('/')}
            disabled={submitting}
          >
            СКАСУВАТИ
          </button>
        </div>
      </form>

      {/* Поради */}
      <div className="tips-section">
        <h3 className="tips-title">ПОРАДИ ДЛЯ ГАРНОГО ПИТАННЯ:</h3>
        <ul className="tips-list">
          <li>Напишіть ясний та конкретний заголовок</li>
          <li>Опишіть проблему детально</li>
          <li>Покажіть, що ви вже спробували</li>
          <li>Додайте приклади коду, якщо це доречно</li>
          <li>Виберіть відповідні теги</li>
          <li>Перечитайте питання перед публікацією</li>
        </ul>
      </div>
    </div>
  );
}
