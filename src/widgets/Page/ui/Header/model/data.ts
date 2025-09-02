/* eslint-disable ulbi-tv-plugin/layer-imports */
import { HeaderMenu, HeaderRoutes } from './types';
import { wordsForTrainers } from '@/pages/TrainerPage';

export const headerCategories: HeaderMenu = {
  'Части речи': ['Вводное слово', 'Вводное слово2'],
  Тесты: ['Склонение', 'Склонение2'],
  Диктанты: [],
  Теория: [],
  Тренажеры: [],
};

export const headerRoutesCategories: HeaderRoutes = {
  'Части речи': 'parts-of-speech',
  Тесты: 'tests',
  Диктанты: 'dictants',
  Теория: 'theory',
  Тренажеры: 'trainers',
};
