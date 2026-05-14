/**
 * Header Component - Brutalism Style
 */

import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { getMediator, EventTypes } from '../../../mediator/src/index';
import './Header.css';
import { NotificationBell } from './NotificationBell';

export function Header() {
  const { user, isAuthenticated, logout } = useAuth();
  const mediator = getMediator();
  const navigate = useNavigate();
  const [searchQ, setSearchQ] = useState('');

  const handleLogout = async () => {
    await logout();
    await mediator.emit(EventTypes.USER_LOGOUT, {}, 'Header');
  };

  return (
    <header className="header">
      <div className="container">
        <div className="header-content">
          <div className="header-left">
            <Link to="/" className="header-logo">
              <span className="header-logo-inner">
                <img
                  src="/devflow-icon.svg"
                  alt=""
                  className="header-logo-img"
                  width={40}
                  height={40}
                  decoding="async"
                />
                <h1>DevFlow</h1>
              </span>
            </Link>

            <form
              className="header-search"
              onSubmit={(e) => {
                e.preventDefault();
                const q = searchQ.trim();
                if (q.length < 2) return;
                navigate(`/search?q=${encodeURIComponent(q)}&page=1`);
              }}
              style={{ display: 'flex', alignItems: 'center', gap: 6, marginRight: 12 }}
            >
              <input
                type="search"
                value={searchQ}
                onChange={(e) => setSearchQ(e.target.value)}
                placeholder="Пошук…"
                aria-label="Глобальний пошук"
                style={{
                  width: 160,
                  maxWidth: '28vw',
                  padding: '6px 10px',
                  border: '2px solid #000',
                  fontFamily: 'var(--font-mono)',
                  fontSize: 13,
                }}
              />
              <button type="submit" className="btn" style={{ padding: '6px 10px', fontSize: 12 }}>
                OK
              </button>
            </form>

            <nav className="nav">
              <Link to="/" className="nav-item">
                ХАБ
              </Link>
              <Link to="/tags" className="nav-item">
                ТЕГИ
              </Link>
              <Link to="/communities" className="nav-item">КОМ'ЮНІТІ</Link>
              <Link to="/mentors" className="nav-item">МЕНТОРИ</Link>
              <Link to="/devs" className="nav-item">РОЗРОБНИКИ</Link>
              {user && user.role === 'admin' && (
                <Link to="/users" className="nav-item">
                  КОРИСТУВАЧІ
                </Link>
              )}
            </nav>
          </div>

          <div className="header-right">
            {isAuthenticated ? (
              <>
                <NotificationBell />
                <div className="user-menu">
                  <Link to="/profile" className="user-link">
                    <span className="badge">{user?.reputation || 0}</span>
                    <span>{user?.username}</span>
                  </Link>
                  <button onClick={handleLogout} className="btn">
                    ВИЙТИ
                  </button>
                </div>
              </>
            ) : (
              <>
                <Link to="/login" className="btn">
                  УВІЙТИ
                </Link>
                <Link to="/register" className="btn btn-primary">
                  РЕЄСТРАЦІЯ
                </Link>
              </>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}

export default Header;
