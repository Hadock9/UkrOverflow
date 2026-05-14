/**
 * Сторінка входу
 */

import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useMediator } from '../contexts/MediatorContext';
import { EventTypes } from '../../../mediator/src/index';
import { githubLoginUrl } from '../services/api';
import '../styles/brutalism.css';

export function Login() {
  const navigate = useNavigate();
  const { login } = useAuth();
  const mediator = useMediator();

  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!identifier.trim() || !password) {
      setError('Заповніть всі поля');
      return;
    }

    setLoading(true);

    try {
      mediator.emit(EventTypes.USER_ACTION, {
        action: 'login_attempt',
        identifier
      }, 'Login');

      await login({ identifier, password });

      mediator.emit(EventTypes.USER_LOGIN, { identifier }, 'Login');
      mediator.emit(EventTypes.NOTIFICATION, {
        type: 'success',
        message: 'Успішний вхід'
      }, 'Login');

      navigate('/');
    } catch (err) {
      console.error('Помилка входу:', err);
      setError(err.response?.data?.message || 'Невірний email/ім\'я або пароль');

      mediator.emit(EventTypes.USER_LOGOUT, {
        reason: 'login_failed'
      }, 'Login');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container auth-container">
      <div className="auth-card">
        <h1 className="auth-title">ВХІД</h1>
        <p className="auth-subtitle">
          Увійдіть, щоб ставити питання та відповідати
        </p>

        <form onSubmit={handleSubmit} className="auth-form">
          {error && (
            <div className="alert alert-error">
              {error}
            </div>
          )}

          <div className="form-group">
            <label htmlFor="identifier" className="form-label">
              EMAIL АБО ІМ'Я КОРИСТУВАЧА
            </label>
            <input
              type="text"
              id="identifier"
              className="form-input"
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              placeholder="email@example.com"
              autoComplete="username"
            />
          </div>

          <div className="form-group">
            <label htmlFor="password" className="form-label">
              ПАРОЛЬ
            </label>
            <input
              type="password"
              id="password"
              className="form-input"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              autoComplete="current-password"
            />
          </div>

          <button
            type="submit"
            className="btn btn-primary btn-block"
            disabled={loading}
          >
            {loading ? 'ВХІД...' : 'УВІЙТИ'}
          </button>
        </form>

        <div style={{ margin: 'var(--space-3) 0', textAlign: 'center', opacity: 0.6 }}>
          АБО
        </div>

        <a
          href={githubLoginUrl()}
          className="btn btn-block"
          style={{ background: '#0d1117', color: '#fff', borderColor: '#0d1117', textDecoration: 'none', textAlign: 'center' }}
        >
          УВІЙТИ ЧЕРЕЗ GITHUB
        </a>

        <div className="auth-footer">
          <p>
            Немає акаунту?{' '}
            <Link to="/register" className="auth-link">
              ЗАРЕЄСТРУВАТИСЯ
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
