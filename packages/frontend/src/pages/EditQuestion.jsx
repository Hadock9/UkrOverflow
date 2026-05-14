/**
 * Сторінка редагування питання
 */

import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useMediator } from '../contexts/MediatorContext';
import { useAuth } from '../contexts/AuthContext';
import { EventTypes } from '../../../mediator/src/index';
import { api } from '../services/api';
import { MarkdownEditor } from '../components/MarkdownEditor';
import '../styles/brutalism.css';

export function EditQuestion() {
  const { id } = useParams();
  const navigate = useNavigate();
  const mediator = useMediator();
  const { user } = useAuth();

  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [tagsInput, setTagsInput] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState({});

  useEffect(() => {
    loadQuestion();
  }, [id]);

  const loadQuestion = async () => {
    try {
      const response = await api.get(`/questions/${id}`);
      const questionData = response.data.data?.question || response.data.question || response.data;

      if (!user || (user.id !== questionData.author_id && user.role !== 'admin')) {
        alert('Ви не можете редагувати це питання');
        navigate(`/questions/${id}`);
        return;
      }

      setTitle(questionData.title);
      setBody(questionData.body);
      setTagsInput(Array.isArray(questionData.tags) ? questionData.tags.join(', ') : '');
    } catch (error) {
      console.error('Помилка завантаження питання:', error);
      alert('Помилка завантаження питання');
      navigate('/');
    } finally {
      setLoading(false);
    }
  };

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
        action: 'update_question',
        questionId: id
      }, 'EditQuestion');

      await api.put(`/questions/${id}`, {
        title: title.trim(),
        body: body.trim(),
        tags
      });

      mediator.emit(EventTypes.NOTIFICATION, {
        type: 'success',
        message: 'Питання оновлено'
      }, 'EditQuestion');

      navigate(`/questions/${id}`);
    } catch (error) {
      console.error('Помилка оновлення питання:', error);

      mediator.emit(EventTypes.API_ERROR, {
        endpoint: `/questions/${id}`,
        error: error.message
      }, 'EditQuestion');

      if (error.response?.data?.errors) {
        const apiErrors = {};
        error.response.data.errors.forEach(err => {
          apiErrors[err.field] = err.message;
        });
        setErrors(apiErrors);
      } else {
        alert(error.response?.data?.message || 'Помилка оновлення питання');
      }
    } finally {
      setSubmitting(false);
    }
  };

  if (!user) {
    return (
      <div className="container">
        <div className="empty-state">
          <h2>УВІЙДІТЬ, ЩОБ РЕДАГУВАТИ ПИТАННЯ</h2>
          <button onClick={() => navigate('/login')} className="btn btn-primary">
            УВІЙТИ
          </button>
        </div>
      </div>
    );
  }

  if (loading) {
    return <div className="container"><div className="loading">ЗАВАНТАЖЕННЯ...</div></div>;
  }

  return (
    <div className="container">
      <div className="page-header">
        <h1 className="page-title">РЕДАГУВАТИ ПИТАННЯ</h1>
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
        </div>

        {/* Кнопки */}
        <div className="form-actions">
          <button
            type="submit"
            className="btn btn-primary"
            disabled={submitting}
          >
            {submitting ? 'ЗБЕРЕЖЕННЯ...' : 'ЗБЕРЕГТИ ЗМІНИ'}
          </button>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => navigate(`/questions/${id}`)}
            disabled={submitting}
          >
            СКАСУВАТИ
          </button>
        </div>
      </form>
    </div>
  );
}
