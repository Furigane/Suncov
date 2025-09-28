/* eslint-disable ulbi-tv-plugin/layer-imports */
import { HeaderMenu, HeaderRoutes, HeaderSubMenu } from './types';
import { wordsForTrainers } from '@/pages/TrainerPage';

const TRAINERS_SPECIAL_KEY = '\u0417\u0430\u0434\u0430\u043d\u0438\u0435 9';

const staticTrainerGroups: HeaderMenu['\u0422\u0440\u0435\u043d\u0430\u0436\u0435\u0440\u044b'] = [
  ...Object.keys(wordsForTrainers)
    .filter((key) => wordsForTrainers[key].inHeader && key !== TRAINERS_SPECIAL_KEY)
    .sort((a, b) => a.localeCompare(b, 'ru')),
  {
    theme: TRAINERS_SPECIAL_KEY,
    items: [
      { subtheme: '\u0427\u0430\u0441\u0442\u044c 1' },
      { subtheme: '\u0427\u0430\u0441\u0442\u044c 2' },
      { subtheme: '\u0427\u0430\u0441\u0442\u044c 3' },
    ],
  },
];

const staticDictantGroups: HeaderSubMenu[] = [
  {
    theme: '\u041e\u0440\u0444\u043e\u0433\u0440\u0430\u0444\u0438\u044f',
    items: [
      { subtheme: '\u041f\u0440\u0430\u0432\u043e\u043f\u0438\u0441\u0430\u043d\u0438\u0435 \u041d \u0438 \u041d\u041d' },
      { subtheme: '\u0421\u043b\u0438\u0442\u043d\u043e, \u0440\u0430\u0437\u0434\u0435\u043b\u044c\u043d\u043e, \u0447\u0435\u0440\u0435\u0437 \u0434\u0435\u0444\u0438\u0441' },
    ],
  },
  {
    theme: '\u041f\u0443\u043d\u043a\u0442\u0443\u0430\u0446\u0438\u044f',
    items: [
      { subtheme: '\u0421\u041f\u041f \u0438 \u0441\u043b\u043e\u0436\u043d\u044b\u0435 \u043f\u0440\u0435\u0434\u043b\u043e\u0436\u0435\u043d\u0438\u044f' },
      { subtheme: '\u041e\u0434\u043d\u043e\u0440\u043e\u0434\u043d\u044b\u0435 \u0447\u043b\u0435\u043d\u044b' },
    ],
  },
];

const staticPartsOfSpeech: HeaderMenu['\u0427\u0430\u0441\u0442\u0438 \u0440\u0435\u0447\u0438'] = [
  '\u0421\u0443\u0449\u0435\u0441\u0442\u0432\u0438\u0442\u0435\u043b\u044c\u043d\u043e\u0435',
  '\u0413\u043b\u0430\u0433\u043e\u043b',
  '\u041f\u0440\u0438\u0447\u0430\u0441\u0442\u0438\u0435',
];

const staticTests: HeaderMenu['\u0422\u0435\u0441\u0442\u044b'] = [
  '\u0421\u043a\u043b\u043e\u043d\u0435\u043d\u0438\u0435',
  '\u041e\u0440\u0444\u043e\u0433\u0440\u0430\u0444\u0438\u044f',
  '\u041f\u0443\u043d\u043a\u0442\u0443\u0430\u0446\u0438\u044f',
];

export const headerCategories: HeaderMenu = {
  '\u0427\u0430\u0441\u0442\u0438 \u0440\u0435\u0447\u0438': staticPartsOfSpeech,
  \u0422\u0435\u0441\u0442\u044b: staticTests,
  \u0414\u0438\u043a\u0442\u0430\u043d\u0442\u044b: staticDictantGroups,
  \u0422\u0435\u043e\u0440\u0438\u044f: [],
  \u0422\u0440\u0435\u043d\u0430\u0436\u0435\u0440\u044b: staticTrainerGroups,
};

export const headerRoutesCategories: HeaderRoutes = {
  '\u0427\u0430\u0441\u0442\u0438 \u0440\u0435\u0447\u0438': 'parts-of-speech',
  \u0422\u0435\u0441\u0442\u044b: 'tests',
  \u0414\u0438\u043a\u0442\u0430\u043d\u0442\u044b: 'dictants',
  \u0422\u0435\u043e\u0440\u0438\u044f: 'theory',
  \u0422\u0440\u0435\u043d\u0430\u0436\u0435\u0440\u044b: 'trainers',
};
