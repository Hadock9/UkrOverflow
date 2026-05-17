/**
 * Header Component - Brutalism Style
 */

import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { getMediator, EventTypes } from '../../../mediator/src/index';
import { LiveSearchBox } from './LiveSearchBox';
import './Header.css';
import './LiveSearchBox.css';
import { NotificationBell } from './NotificationBell';

const NAV_LINKS = [
  { to: '/', label: 'ГОЛОВНА', end: true },
  { to: '/hub', label: 'ХАБ' },
  { to: '/news', label: 'НОВИНИ' },
  { to: '/tags', label: 'ТЕГИ' },
  { to: '/activity', label: 'АКТИВНІСТЬ', short: 'АКТИВ.' },
  { to: '/pair-rooms', label: 'КОЛАБОРАЦІЯ' },
  { to: '/challenges', label: 'ЧЕЛЕНДЖІ' },
  { to: '/communities', label: "КОМ'ЮНІТІ", short: "КОМ'Ю." },
  { to: '/mentors', label: 'МЕНТОРИ' },
  { to: '/devs', label: 'РОЗРОБНИКИ', short: 'DEVS' },
];

function NavLink({ to, label, short, end, onNavigate }) {
  const location = useLocation();
  const isActive = end
    ? location.pathname === '/'
    : location.pathname === to || location.pathname.startsWith(`${to}/`);

  return (
    <Link
      to={to}
      className={`nav-item${isActive ? ' active' : ''}`}
      title={short ? label : undefined}
      onClick={onNavigate}
    >
      <span className="nav-item-label nav-item-label--full">{label}</span>
      {short ? <span className="nav-item-label nav-item-label--short">{short}</span> : null}
    </Link>
  );
}

export function Header() {
  const { user, isAuthenticated, logout } = useAuth();
  const mediator = getMediator();
  const location = useLocation();
  const [searchQ, setSearchQ] = useState('');
  const [navOpen, setNavOpen] = useState(false);

  useEffect(() => {
    setNavOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    document.body.classList.toggle('header-nav-open', navOpen);
    return () => document.body.classList.remove('header-nav-open');
  }, [navOpen]);

  const handleLogout = async () => {
    await logout();
    await mediator.emit(EventTypes.USER_LOGOUT, {}, 'Header');
  };

  const closeNav = () => setNavOpen(false);

  return (
    <header className="header">
      <div className="container">
        <div className="header-content">
          <div className="header-top">
            <Link to="/" className="header-logo" onClick={closeNav}>
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

            <div className="header-search-slot">
              <LiveSearchBox
                value={searchQ}
                onChange={setSearchQ}
                variant="header"
              />
            </div>

            <button
              type="button"
              className="header-nav-toggle"
              aria-expanded={navOpen}
              aria-controls="header-main-nav"
              onClick={() => setNavOpen((v) => !v)}
            >
              {navOpen ? 'ЗАКРИТИ' : 'МЕНЮ'}
            </button>

            <div className="header-right">
              {isAuthenticated ? (
                <>
                  <NotificationBell />
                  <div className="user-menu">
                    <Link to="/profile" className="user-link" onClick={closeNav}>
                      <span className="badge">{user?.reputation || 0}</span>
                      <span className="user-link-name">{user?.username}</span>
                    </Link>
                    <button type="button" onClick={handleLogout} className="btn">
                      ВИЙТИ
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <Link to="/login" className="btn" onClick={closeNav}>
                    УВІЙТИ
                  </Link>
                  <Link to="/register" className="btn btn-primary" onClick={closeNav}>
                    РЕЄСТРАЦІЯ
                  </Link>
                </>
              )}
            </div>
          </div>

          <nav
            id="header-main-nav"
            className={`header-nav${navOpen ? ' is-open' : ''}`}
            aria-label="Головна навігація"
          >
            {NAV_LINKS.map((item) => (
              <NavLink key={item.to} {...item} onNavigate={closeNav} />
            ))}
            {user?.role === 'admin' && (
              <NavLink to="/users" label="КОРИСТУВАЧІ" short="АДМІН" onNavigate={closeNav} />
            )}
          </nav>
        </div>
      </div>
    </header>
  );
}

export default Header;
