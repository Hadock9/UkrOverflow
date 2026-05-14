/**
 * Header Component - Brutalism Style
 */

import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { getMediator, EventTypes } from '../../../mediator/src/index';
import './Header.css';

export function Header() {
  const { user, isAuthenticated, logout } = useAuth();
  const mediator = getMediator();

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
              <h1>DEVHUB.UA</h1>
            </Link>

            <nav className="nav">
              <Link to="/" className="nav-item">
                ХАБ
              </Link>
              <Link to="/tags" className="nav-item">
                ТЕГИ
              </Link>
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
