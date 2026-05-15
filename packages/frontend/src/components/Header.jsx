/**
 * Header Component - Brutalism Style
 */

import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { getMediator, EventTypes } from '../../../mediator/src/index';
import { LiveSearchBox } from './LiveSearchBox';
import './Header.css';
import './LiveSearchBox.css';
import { NotificationBell } from './NotificationBell';

export function Header() {
  const { user, isAuthenticated, logout } = useAuth();
  const mediator = getMediator();
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

            <LiveSearchBox
              value={searchQ}
              onChange={setSearchQ}
              variant="header"
            />

            <nav className="nav">
              <Link to="/" className="nav-item">
                ГОЛОВНА
              </Link>
              <Link to="/hub" className="nav-item">
                ХАБ
              </Link>
              <Link to="/news" className="nav-item">
                НОВИНИ
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
