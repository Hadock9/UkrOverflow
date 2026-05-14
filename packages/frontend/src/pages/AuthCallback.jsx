/**
 * /auth/callback — приймає JWT і user-payload з GitHub OAuth callback,
 * зберігає у localStorage і повертає на /.
 */

import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { auth as authApi } from '../services/api';
import { redirectToCanonicalPath } from '../utils/frontendCanonical';

export function AuthCallback() {
  const navigate = useNavigate();
  const location = useLocation();
  const [error, setError] = useState('');

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const token = params.get('token');
    const userParam = params.get('user');
    const errorParam = params.get('error');

    if (errorParam) {
      const decoded = decodeURIComponent(errorParam.replace(/\+/g, ' '));
      let msg = decoded;
      if (/redirect_uri|oauth|github|associated|misconfigured/i.test(decoded)) {
        msg =
          `${decoded} Переконайтесь, що в OAuth Apps на GitHub у полі «Authorization callback URL» указано точно той самий рядок, що й «redirect_uri» у відповіді GET /api/auth/github/status (перевірте з того самого браузера/домену).`;
      }
      setError(msg);
      const t = setTimeout(() => {
        if (!redirectToCanonicalPath('/login')) navigate('/login');
      }, 8000);
      return () => clearTimeout(t);
    }

    if (!token) {
      setError('Відсутній токен');
      const t = setTimeout(() => navigate('/login'), 2000);
      return () => clearTimeout(t);
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
        // Підтягуємо повний профіль (з GitHub-полями)
        const me = await authApi.getProfile();
        const fullUser = me.data?.data?.user;
        if (fullUser) {
          localStorage.setItem('user', JSON.stringify(fullUser));
        }
      } catch (e) {
        console.error('Не вдалося завантажити профіль після OAuth:', e);
      } finally {
        // Перезавантажуємо сторінку, щоб AuthProvider перечитав localStorage
        if (!redirectToCanonicalPath('/')) window.location.replace('/');
      }
    };

    finalize();
  }, [location.search, navigate]);

  return (
    <div className="container" style={{ textAlign: 'center', padding: '100px 20px' }}>
      {error ? (
        <div className="error">Помилка входу через GitHub: {error}</div>
      ) : (
        <div className="loading">ВХІД ЧЕРЕЗ GITHUB...</div>
      )}
    </div>
  );
}

export default AuthCallback;
