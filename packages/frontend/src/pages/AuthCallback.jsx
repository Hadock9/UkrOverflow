/**
 * /auth/callback — приймає JWT і user-payload з OAuth (GitHub / Google),
 * зберігає у localStorage і повертає на /.
 */

import { useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { auth as authApi } from '../services/api';
import { redirectToCanonicalPath } from '../utils/frontendCanonical';
import '../styles/brutalism.css';
import './AuthCallback.css';

const REDIRECT_HOME_MS = 6000;

function decodeErrorParam(raw) {
  if (!raw) return '';
  return decodeURIComponent(raw.replace(/\+/g, ' ')).trim();
}

function buildErrorView(decoded, provider) {
  const isGithub = provider === 'github' || /github/i.test(decoded);
  const isGoogle = provider === 'google' || /google/i.test(decoded);
  const isAccountConflict = /вже прив['’]язаний до іншого користувача/i.test(decoded);

  if (isAccountConflict) {
    const service = isGoogle ? 'Google' : isGithub ? 'GitHub' : 'OAuth';
    return {
      variant: 'conflict',
      icon: '🔗',
      title: `Не вдалося увійти через ${service}`,
      message: decoded,
      hint: `Спробуйте увійти email і паролем, якщо у вас уже є акаунт DevFlow, або використайте інший ${service}-профіль.`,
      hintCode: null,
    };
  }

  const needsCallbackHint =
    /redirect_uri|callback url|misconfigured|associated with another oauth|bad_verification_code/i.test(
      decoded
    );

  if (needsCallbackHint && isGithub) {
    return {
      variant: 'warn',
      icon: '⚙️',
      title: 'Помилка налаштування GitHub OAuth',
      message: decoded,
      hint:
        'У GitHub → Settings → Developer settings → OAuth Apps переконайтесь, що в полі «Authorization callback URL» вказано точно той самий рядок, що й redirect_uri у відповіді:',
      hintCode: 'GET /api/auth/github/status → redirect_uri',
    };
  }

  if (needsCallbackHint && isGoogle) {
    return {
      variant: 'warn',
      icon: '⚙️',
      title: 'Помилка налаштування Google OAuth',
      message: decoded,
      hint:
        'У Google Cloud Console → Credentials → OAuth client додайте Authorized redirect URI, який збігається з redirect_uri у GET /api/auth/google/status.',
      hintCode: null,
    };
  }

  return {
    variant: 'warn',
    icon: '⚠️',
    title: 'Помилка входу',
    message: decoded,
    hint: null,
    hintCode: null,
  };
}

export function AuthCallback() {
  const navigate = useNavigate();
  const location = useLocation();
  const [errorView, setErrorView] = useState(null);
  const [secondsLeft, setSecondsLeft] = useState(Math.ceil(REDIRECT_HOME_MS / 1000));

  const params = useMemo(() => new URLSearchParams(location.search), [location.search]);

  useEffect(() => {
    const token = params.get('token');
    const userParam = params.get('user');
    const errorParam = params.get('error');
    const provider = params.get('provider') || '';

    if (errorParam) {
      const decoded = decodeErrorParam(errorParam);
      setErrorView(buildErrorView(decoded, provider));
      return undefined;
    }

    if (!token) {
      setErrorView({
        variant: 'warn',
        icon: '⚠️',
        title: 'Помилка входу',
        message: 'Відсутній токен авторизації.',
        hint: 'Спробуйте увійти ще раз зі сторінки входу.',
        hintCode: null,
      });
      return undefined;
    }

    const finalize = async () => {
      try {
        localStorage.setItem('token', token);
        if (userParam) {
          try {
            const u = JSON.parse(userParam);
            localStorage.setItem('user', JSON.stringify(u));
          } catch {
            /* ignore */
          }
        }
        const me = await authApi.getProfile();
        const fullUser = me.data?.data?.user;
        if (fullUser) {
          localStorage.setItem('user', JSON.stringify(fullUser));
        }
      } catch (e) {
        console.error('Не вдалося завантажити профіль після OAuth:', e);
      } finally {
        if (!redirectToCanonicalPath('/')) window.location.replace('/');
      }
    };

    finalize();
    return undefined;
  }, [params]);

  useEffect(() => {
    if (!errorView) return undefined;

    const goHome = () => {
      if (!redirectToCanonicalPath('/')) navigate('/', { replace: true });
    };

    const tick = setInterval(() => {
      setSecondsLeft((s) => {
        if (s <= 1) {
          clearInterval(tick);
          goHome();
          return 0;
        }
        return s - 1;
      });
    }, 1000);

    const hard = setTimeout(goHome, REDIRECT_HOME_MS);

    return () => {
      clearInterval(tick);
      clearTimeout(hard);
    };
  }, [errorView, navigate]);

  if (errorView) {
    const cardClass = `auth-callback-card auth-callback-card--${errorView.variant}`;
    return (
      <div className="container auth-callback-page">
        <article className={cardClass} role="alert" aria-live="polite">
          <div className="auth-callback-icon" aria-hidden>
            {errorView.icon}
          </div>
          <h1 className="auth-callback-title">{errorView.title}</h1>
          <p className="auth-callback-message">{errorView.message}</p>
          {errorView.hint && (
            <p className="auth-callback-hint">
              {errorView.hint}
              {errorView.hintCode && <code>{errorView.hintCode}</code>}
            </p>
          )}
          <div className="auth-callback-actions">
            <Link to="/" className="btn btn-primary">
              НА ГОЛОВНУ
            </Link>
            <Link to="/login" className="btn btn-secondary">
              УВІЙТИ ІНАКШЕ
            </Link>
            <p className="auth-callback-countdown">
              Автоматичне перенаправлення через {secondsLeft} с…
            </p>
          </div>
        </article>
      </div>
    );
  }

  return (
    <div className="container auth-callback-loading">
      <div className="loading">ВХІД…</div>
    </div>
  );
}

export default AuthCallback;
