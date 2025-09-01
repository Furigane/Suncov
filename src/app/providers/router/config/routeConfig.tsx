import { MainPage } from '@/pages/MainPage';
import { NotFoundPage } from '@/pages/NotFoundPage';
import { TheoryPage } from '@/pages/TheoryPage';
import { TrainerPage, wordsForTrainers } from '@/pages/TrainerPage';
import { AdminPage } from '@/pages/AdminPage/ui/AdminPage';
import { LoginPage } from '@/pages/LoginPage/ui/LoginPage';
import {
  getRouteMain,
  getRouteNotFound,
  getRouteTheory,
  getRouteTrainer,
  getRouteAdmin,
  getRouteLogin,
} from '@/shared/const/router';
export const routeConfig = {
  main: {
    path: getRouteMain(),
    element: <MainPage />,
  },

  theory: {
    path: getRouteTheory(),
    element: <TheoryPage />,
  },

  admin: {
    path: getRouteAdmin(),
    element: <AdminPage />,
  },

  login: {
    path: getRouteLogin(),
    element: <LoginPage />,
  },

  ...[
    ...Object.entries(wordsForTrainers).map(([theme, words]) => ({
      path: getRouteTrainer(theme),
      element: <TrainerPage theme={theme} key={theme} words={words} />,
    })),
  ],

  notFound: {
    path: getRouteNotFound(),
    element: <NotFoundPage />,
  },
};
