/**
 * Auth Context з інтеграцією Mediator
 */

import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { auth } from '../services/api';
import { getMediator, EventTypes } from '../../../mediator/src/index';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const mediator = getMediator();

  const logout = useCallback(async () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setUser(null);

    await mediator.emit(EventTypes.USER_LOGOUT, {}, 'AuthProvider');
  }, [mediator]);

  useEffect(() => {
    mediator.register('AuthProvider', { name: 'AuthProvider' });

    // Завантаження користувача з localStorage
    const loadUser = async () => {
      const token = localStorage.getItem('token');
      const savedUser = localStorage.getItem('user');

      if (token && savedUser) {
        try {
          setUser(JSON.parse(savedUser));

          // Перевірка токену
          const response = await auth.getProfile();
          setUser(response.data.data.user);
          localStorage.setItem('user', JSON.stringify(response.data.data.user));
        } catch (error) {
          console.error('Помилка завантаження профілю:', error);
          await logout();
        }
      }

      setLoading(false);
    };

    loadUser();

    return () => {
      mediator.unregister('AuthProvider');
    };
  }, [logout, mediator]);

  const login = async (credentials) => {
    try {
      const response = await auth.login(credentials);
      const { user, token } = response.data.data;

      localStorage.setItem('token', token);
      localStorage.setItem('user', JSON.stringify(user));
      setUser(user);

      await mediator.emit(EventTypes.USER_LOGIN, { user }, 'AuthProvider');

      return { success: true };
    } catch (error) {
      await mediator.emit(EventTypes.ERROR, {
        message: error.response?.data?.message || 'Помилка входу',
        context: 'login'
      }, 'AuthProvider');

      return {
        success: false,
        message: error.response?.data?.message || 'Помилка входу'
      };
    }
  };

  const register = async (data) => {
    try {
      const response = await auth.register(data);
      const { user, token } = response.data.data;

      localStorage.setItem('token', token);
      localStorage.setItem('user', JSON.stringify(user));
      setUser(user);

      await mediator.emit(EventTypes.USER_REGISTER, { user }, 'AuthProvider');

      return { success: true };
    } catch (error) {
      await mediator.emit(EventTypes.ERROR, {
        message: error.response?.data?.message || 'Помилка реєстрації',
        context: 'register'
      }, 'AuthProvider');

      return {
        success: false,
        message: error.response?.data?.message || 'Помилка реєстрації'
      };
    }
  };

  const updateProfile = async (data) => {
    try {
      const response = await auth.updateProfile(data);
      const updatedUser = response.data.data.user;

      localStorage.setItem('user', JSON.stringify(updatedUser));
      setUser(updatedUser);

      await mediator.emit(EventTypes.USER_PROFILE_UPDATE, { user: updatedUser }, 'AuthProvider');

      return { success: true };
    } catch (error) {
      return {
        success: false,
        message: error.response?.data?.message || 'Помилка оновлення профілю'
      };
    }
  };

  const value = {
    user,
    loading,
    login,
    register,
    logout,
    updateProfile,
    isAuthenticated: !!user
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

/** Хук поруч з провайдером — стандартний патерн для контексту. */
// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth має використовуватися всередині AuthProvider');
  }
  return context;
}

export default AuthContext;
