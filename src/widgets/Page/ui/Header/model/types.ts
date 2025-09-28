export interface HeaderSubItem {
  subtheme: string;
  slug?: string;
}

export interface HeaderSubMenu {
  items: HeaderSubItem[];
  theme: string;
}

export type HeaderCategoryTitle =
  | 'Части речи'
  | 'Тесты'
  | 'Диктанты'
  | 'Теория'
  | 'Тренажеры';

export type HeaderMenu = {
  'Части речи': string[];
  Тесты: string[];
  Диктанты: HeaderSubMenu[];
  Теория: string[];
  Тренажеры: Array<string | HeaderSubMenu>;
};

export type HeaderCategoryType = HeaderCategoryTitle;

export type HeaderRoutes = Record<HeaderCategoryType, string>;