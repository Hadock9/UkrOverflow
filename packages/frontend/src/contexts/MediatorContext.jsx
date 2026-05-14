/**
 * Mediator Context
 * Надає доступ до Mediator через React Context
 */

import { createContext, useContext } from 'react';
import { getMediator } from '../../../mediator/src/index';

const MediatorContext = createContext(null);

export function MediatorProvider({ children }) {
  const mediator = getMediator();

  return (
    <MediatorContext.Provider value={mediator}>
      {children}
    </MediatorContext.Provider>
  );
}

export function useMediator() {
  const mediator = useContext(MediatorContext);
  if (!mediator) {
    // Повертаємо глобальний mediator, якщо контекст не доступний
    return getMediator();
  }
  return mediator;
}
