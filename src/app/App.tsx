import { AppRouter } from './providers/router/ui/AppRouter';
import React from 'react';

export const App = () => {
  // Не ограничиваем доступ ко всему сайту. Вход/админка отдельно.
  return <AppRouter />;
};
