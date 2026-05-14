/**
 * Сторінка користувачів (тільки для адміністраторів)
 */

import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useMediator } from '../contexts/MediatorContext';
import { EventTypes } from '../../../mediator/src/index';
import { api } from '../services/api';
import '../styles/brutalism.css';

export function Users() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const mediator = useMediator();

  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sortBy, setSortBy] = useState('reputation');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  useEffect(() => {
    // Перевірка прав доступу
    if (!user || user.role !== 'admin') {
      alert('Доступ заборонено. Тільки для адміністраторів.');
      navigate('/');
      return;
    }

    loadUsers();
  }, [sortBy, page, user, navigate]);

  const loadUsers = async () => {
    setLoading(true);
    try {
      mediator.emit(EventTypes.API_REQUEST, { endpoint: '/users' }, 'Users');

      const response = await api.get('/users', {
        params: { sortBy, page, limit: 20 }
      });

      const { users: usersData, pagination } = response.data.data || response.data;

      setUsers(usersData || []);
      setTotalPages(pagination?.totalPages || 1);

      mediator.emit(EventTypes.API_SUCCESS, {
        endpoint: '/users',
        count: usersData?.length || 0
      }, 'Users');
    } catch (error) {
      mediator.emit(EventTypes.API_ERROR, {
        endpoint: '/users',
        error: error.message
      }, 'Users');
      console.error('Помилка завантаження користувачів:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleBlockUser = async (userId, username) => {
    if (!confirm(`Ви впевнені, що хочете заблокувати користувача ${username}?`)) {
      return;
    }

    try {
      await api.post(`/users/${userId}/block`);
      loadUsers();

      mediator.emit(EventTypes.NOTIFICATION, {
        type: 'success',
        message: `Користувача ${username} заблоковано`
      }, 'Users');
    } catch (error) {
      console.error('Помилка блокування користувача:', error);
      mediator.emit(EventTypes.NOTIFICATION, {
        type: 'error',
        message: error.response?.data?.message || 'Помилка блокування користувача'
      }, 'Users');
    }
  };

  const handleUnblockUser = async (userId, username) => {
    try {
      await api.post(`/users/${userId}/unblock`);
      loadUsers();

      mediator.emit(EventTypes.NOTIFICATION, {
        type: 'success',
        message: `Користувача ${username} розблоковано`
      }, 'Users');
    } catch (error) {
      console.error('Помилка розблокування користувача:', error);
      mediator.emit(EventTypes.NOTIFICATION, {
        type: 'error',
        message: error.response?.data?.message || 'Помилка розблокування користувача'
      }, 'Users');
    }
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('uk-UA', {
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    });
  };

  if (!user || user.role !== 'admin') {
    return null;
  }

  if (loading) {
    return <div className="container"><div className="loading">ЗАВАНТАЖЕННЯ...</div></div>;
  }

  return (
    <div className="container">
      {/* Заголовок */}
      <div className="page-header">
        <div>
          <h1 className="page-title">КОРИСТУВАЧІ</h1>
          <p className="page-subtitle">
            Управління користувачами системи
          </p>
        </div>
      </div>

      {/* Фільтри */}
      <div className="filters">
        <button
          className={`filter-btn ${sortBy === 'reputation' ? 'active' : ''}`}
          onClick={() => setSortBy('reputation')}
        >
          ЗА РЕПУТАЦІЄЮ
        </button>
        <button
          className={`filter-btn ${sortBy === 'created_at' ? 'active' : ''}`}
          onClick={() => setSortBy('created_at')}
        >
          ЗА ДАТОЮ РЕЄСТРАЦІЇ
        </button>
        <button
          className={`filter-btn ${sortBy === 'username' ? 'active' : ''}`}
          onClick={() => setSortBy('username')}
        >
          ЗА ІМ'ЯМ
        </button>
      </div>

      {/* Таблиця користувачів */}
      <table>
        <thead>
          <tr>
            <th>ID</th>
            <th>ІМ'Я КОРИСТУВАЧА</th>
            <th>EMAIL</th>
            <th>РЕПУТАЦІЯ</th>
            <th>ПИТАНЬ</th>
            <th>ВІДПОВІДЕЙ</th>
            <th>РОЛЬ</th>
            <th>ДАТА РЕЄСТРАЦІЇ</th>
            <th>ДІЇ</th>
          </tr>
        </thead>
        <tbody>
          {users.map((u) => (
            <tr key={u.id}>
              <td>{u.id}</td>
              <td>
                <Link to={`/users/${u.id}`} className="author">
                  {u.username}
                </Link>
              </td>
              <td style={{ fontFamily: 'var(--font-mono)', fontSize: '0.875rem' }}>
                {u.email}
              </td>
              <td>
                <span className="badge badge-success">{u.reputation || 0}</span>
              </td>
              <td>{u.questions_count || 0}</td>
              <td>{u.answers_count || 0}</td>
              <td>
                <span className={`badge ${u.role === 'admin' ? 'badge-primary' : ''}`}>
                  {u.role === 'admin' ? 'АДМІН' : 'КОРИСТУВАЧ'}
                </span>
              </td>
              <td style={{ fontFamily: 'var(--font-mono)', fontSize: '0.875rem' }}>
                {formatDate(u.created_at)}
              </td>
              <td>
                {u.id !== user.id && (
                  <>
                    {u.blocked ? (
                      <button
                        onClick={() => handleUnblockUser(u.id, u.username)}
                        className="btn btn-success btn-sm"
                      >
                        РОЗБЛОКУВАТИ
                      </button>
                    ) : (
                      <button
                        onClick={() => handleBlockUser(u.id, u.username)}
                        className="btn btn-danger btn-sm"
                      >
                        ЗАБЛОКУВАТИ
                      </button>
                    )}
                  </>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Пагінація */}
      {totalPages > 1 && (
        <div className="pagination">
          <button
            className="btn"
            onClick={() => setPage(page - 1)}
            disabled={page === 1}
          >
            ← ПОПЕРЕДНЯ
          </button>
          <span className="page-info">
            Сторінка {page} з {totalPages}
          </span>
          <button
            className="btn"
            onClick={() => setPage(page + 1)}
            disabled={page === totalPages}
          >
            НАСТУПНА →
          </button>
        </div>
      )}
    </div>
  );
}
