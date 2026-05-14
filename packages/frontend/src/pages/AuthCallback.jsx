/**
 * /auth/callback — приймає JWT і user-payload з GitHub OAuth callback,
 * зберігає у localStorage і повертає на /.
 */

import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { auth as authApi } from '../services/api';

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
      setError(errorParam);
      const t = setTimeout(() => navigate('/login'), 2500);
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
        window.location.replace('/');
      }
    };

    finalize();
  }, [location.search, navigate]);

  return (
    <div className="container" style={{ textAlign: 'center', padding: '100px 20px' }}>
      {error ? (
        <div className="error">GITHUB AUTH ERROR: {error}</div>
      ) : (
        <div className="loading">ВХОДИМО ЧЕРЕЗ GITHUB...</div>
      )}
    </div>
  );
}

export default AuthCallback;
