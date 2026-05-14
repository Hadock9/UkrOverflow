/**
 * Сторінка реєстрації
 */

import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useMediator } from '../contexts/MediatorContext';
import { EventTypes } from '../../../mediator/src/index';
import '../styles/brutalism.css';

export function Register() {
  const navigate = useNavigate();
  const { register } = useAuth();
  const mediator = useMediator();

  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});

  const validate = () => {
    const newErrors = {};

    if (!username.trim()) {
      newErrors.username = 'Ім\'я користувача обов\'язкове';
    } else if (username.length < 3 || username.length > 30) {
      newErrors.username = 'Ім\'я має бути від 3 до 30 символів';
    } else if (!/^[a-zA-Z0-9_]+$/.test(username)) {
      newErrors.username = 'Тільки літери, цифри та _';
    }

    if (!email.trim()) {
      newErrors.email = 'Email обов\'язковий';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      newErrors.email = 'Невірний формат email';
    }

    if (!password) {
      newErrors.password = 'Пароль обов\'язковий';
    } else if (password.length < 6) {
      newErrors.password = 'Пароль має бути мінімум 6 символів';
    }

    if (password !== confirmPassword) {
      newErrors.confirmPassword = 'Паролі не співпадають';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!validate()) {
      return;
    }

    setLoading(true);
    setErrors({});

    try {
      mediator.emit(EventTypes.USER_ACTION, {
        action: 'register_attempt',
        username
      }, 'Register');

      await register({ username, email, password });

      mediator.emit(EventTypes.USER_REGISTER, {
        username,
        email
      }, 'Register');

      mediator.emit(EventTypes.NOTIFICATION, {
        type: 'success',
        message: 'Реєстрація успішна'
      }, 'Register');

      navigate('/');
    } catch (err) {
      console.error('Помилка реєстрації:', err);

      if (err.response?.data?.errors) {
        const apiErrors = {};
        err.response.data.errors.forEach(error => {
          apiErrors[error.field] = error.message;
        });
        setErrors(apiErrors);
      } else {
        setErrors({
          general: err.response?.data?.message || 'Помилка реєстрації'
        });
      }

      mediator.emit(EventTypes.API_ERROR, {
        endpoint: '/auth/register',
        error: err.message
      }, 'Register');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container auth-container">
      <div className="auth-card">
        <h1 className="auth-title">РЕЄСТРАЦІЯ</h1>
        <p className="auth-subtitle">
          Створіть обліковий запис, щоб приєднатися до спільноти
        </p>

        <form onSubmit={handleSubmit} className="auth-form">
          {errors.general && (
            <div className="alert alert-error">
              {errors.general}
            </div>
          )}

          <div className="form-group">
            <label htmlFor="username" className="form-label">
              ІМ'Я КОРИСТУВАЧА
            </label>
            <input
              type="text"
              id="username"
              className={`form-input ${errors.username ? 'error' : ''}`}
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="taras_shevchenko"
              autoComplete="username"
            />
            {errors.username && (
              <div className="form-error">{errors.username}</div>
            )}
          </div>

          <div className="form-group">
            <label htmlFor="email" className="form-label">
              EMAIL
            </label>
            <input
              type="email"
              id="email"
              className={`form-input ${errors.email ? 'error' : ''}`}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="taras@example.com"
              autoComplete="email"
            />
            {errors.email && (
              <div className="form-error">{errors.email}</div>
            )}
          </div>

          <div className="form-group">
            <label htmlFor="password" className="form-label">
              ПАРОЛЬ
            </label>
            <input
              type="password"
              id="password"
              className={`form-input ${errors.password ? 'error' : ''}`}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              autoComplete="new-password"
            />
            {errors.password && (
              <div className="form-error">{errors.password}</div>
            )}
          </div>

          <div className="form-group">
            <label htmlFor="confirmPassword" className="form-label">
              ПІДТВЕРДІТЬ ПАРОЛЬ
            </label>
            <input
              type="password"
              id="confirmPassword"
              className={`form-input ${errors.confirmPassword ? 'error' : ''}`}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="••••••••"
              autoComplete="new-password"
            />
            {errors.confirmPassword && (
              <div className="form-error">{errors.confirmPassword}</div>
            )}
          </div>

          <button
            type="submit"
            className="btn btn-primary btn-block"
            disabled={loading}
          >
            {loading ? 'РЕЄСТРАЦІЯ...' : 'ЗАРЕЄСТРУВАТИСЯ'}
          </button>
        </form>

        <div className="auth-footer">
          <p>
            Вже є акаунт?{' '}
            <Link to="/login" className="auth-link">
              УВІЙТИ
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
