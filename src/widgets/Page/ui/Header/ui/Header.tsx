import { Flex } from '@/shared/lib/Stack';
import * as styles from './Header.module.scss';
import { Fragment, memo, useEffect, useState } from 'react';
import { headerCategories, headerRoutesCategories } from '../model/data';
import { HeaderCategoryType, HeaderMenu } from '../model/types';
import { Link, matchPath } from 'react-router-dom';
import { transliterate } from '@/shared/utils/transliterate';
import { isInJest } from '@/shared/tests/isInJest';
import { getRouteLogin } from '@/shared/const/router';

import { FetchProvider } from '../lib/FetchProvider/FetchProvider';
import { useAppDispatch, useAppSelector } from '@/shared/store/config/AppStore';
import { authActions } from '@/shared/auth/model/slice';

interface HeaderProps {
  withHomeButton?: boolean;
}

export const Header: React.FC<HeaderProps> = memo(
  ({ withHomeButton = true }): React.JSX.Element => {
    // Обработка наведения на категории
    const [headerHoveredCategory, setHoveredHeaderCategory] = useState<
      string | null
    >(null);

    // Реализация показа подменю при наведении на категорию
    const [visibleSubmenu, setVisibleSubmenu] = useState<string | null>(null);

    // Получение дата-атрибутов из html
    const getAttr = (name: string) => document?.body?.getAttribute(name) ?? '';
    const getBool = (name: string) => (document?.body?.getAttribute(name) ?? 'false') === 'true';

    const publicUrl = isInJest() ? '' : getAttr('data-publicurl');
    const isDev = getBool('data-isdev');

    const startPath = isDev ? '' : `/${publicUrl}`;

    // Делаем категории хедера стейтом
    
    const [categories, setCategories] = useState<HeaderMenu>(headerCategories);

    // Отображение загрузки, если категории не загружены
    const [categoriesLoading, setCategoriesLoading] = useState<boolean>(true);

    const isMobile =
      typeof window !== 'undefined' &&
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(max-width: 768px)').matches;

    const dispatch = useAppDispatch();
    const auth = useAppSelector((s) => s.auth);
    const [loginOpen, setLoginOpen] = useState(false);
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [loginError, setLoginError] = useState<string | null>(null);

    const onLogin = async (e: React.FormEvent) => {
      e.preventDefault();
      setLoginError(null);
      try {
        const res = await fetch('/api/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username, password }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data?.error || 'Ошибка входа');
        dispatch(authActions.setAuthenticated(data.user));
        setLoginOpen(false);
        setUsername('');
        setPassword('');
      } catch (err: any) {
        setLoginError(err.message || 'Ошибка входа');
      }
    };

    useEffect(() => {
      if (!isMobile) return;
      const handleDocumentClick = (e: MouseEvent) => {
        if (!(e.target as HTMLElement).closest(`.${styles.Header}`)) {
          setHoveredHeaderCategory(null);
          setVisibleSubmenu(null);
        }
      };
      document.addEventListener('click', handleDocumentClick);
      return () => document.removeEventListener('click', handleDocumentClick);
    }, [isMobile]);

    return (
      <header className={styles.Header}>
          <FetchProvider
            setCategories={setCategories}
            setCategoriesLoading={setCategoriesLoading}
          >
          <Flex maxHeight>
            {Object.entries(categories).map(([category, submenu]) => {
              // Инициализация ссылки предмета навигации
              const itemLink = `/${headerRoutesCategories[category as HeaderCategoryType]}`;

              // Инициализация начала data-testid
              const dataTestID = `Header__${category.replace(' ', '_')}`;

              return (
                <Flex
                  onMouseLeave={() => setHoveredHeaderCategory(null)}
                  key={category}
                  direction="column"
                  relative
                  maxHeight
                >
                  <Flex
                    maxHeight
                    justify="center"
                    onMouseEnter={() => !isMobile && setHoveredHeaderCategory(category)}
                    onClick={() => {
                      if (isMobile && submenu.length > 0) {
                        setHoveredHeaderCategory((prev) =>
                          prev === category ? null : category,
                        );
                      }
                    }}
                    tabIndex={0}
                    className={`${styles.Header__item}
                ${matchPath(itemLink, window.location.pathname) && styles.Header__item__active}`}
                    data-testid={dataTestID}
                    role={submenu.length > 0 ? 'button' : undefined}
                  >
                    {submenu.length > 0 ? (
                      <>{category}</>
                    ) : (
                      <Link to={itemLink}>{category}</Link>
                    )}
                  </Flex>

                  {submenu.length > 0 && (
                    <Flex
                      align="start"
                      className={`${styles.Header__submenu} 
            ${headerHoveredCategory === category && styles.Header__submenu__active}`}
                      direction="column"
                      data-testid={`${dataTestID}__submenu`}
                    >
                      {submenu.map((menuItem) => {
                        const isUsual = typeof menuItem === 'string';

                        return (
                          <Fragment key={isUsual ? menuItem : menuItem.theme}>
                            {isUsual
                              ? (() => {
                                  // Инициализация предмета подменю
                                  const submenuItemLink: string = `/${headerRoutesCategories[category as HeaderCategoryType]}/${transliterate(menuItem)}`;

                                  return (
                                    <Link
                                      to={submenuItemLink}
                                      className={`${styles.Header__submenu__item} 
                                    ${
                                      matchPath(
                                        `${startPath}${submenuItemLink}`,
                                        window.location.pathname,
                                      ) && styles.Header__submenu__item__active
                                    }`}
                                      onClick={() => setHoveredHeaderCategory(null)}
                                    >
                                      {menuItem}
                                    </Link>
                                  );
                                })()
                              : (() => {
                                  // Ссылки на подменю
                                  const submenuItemLink = (
                                    subTheme: string,
                                  ): string => {
                                    if (category === 'Тренажеры') {
                                      const trainerSubTheme = `задание 9 — ${subTheme}`;
                                      return `/${headerRoutesCategories[category as HeaderCategoryType]}/${transliterate(trainerSubTheme)}`;
                                    }

                                    return `/${headerRoutesCategories[category as HeaderCategoryType]}/${transliterate(menuItem.theme)}/${transliterate(subTheme)}`;
                                  };

                                  // Разбитие подменю на слайсы по 10 штук
                                  const submenuItems = menuItem.items.reduce<
                                    Array<typeof menuItem.items>
                                  >((acc, item, index) => {
                                    const chunkIndex = Math.floor(index / 10);

                                    if (!acc[chunkIndex]) {
                                      acc[chunkIndex] = [];
                                    }

                                    acc[chunkIndex].push(item);
                                    return acc;
                                  }, []);

                                  const isTrainerCategory = category === 'Тренажеры';
                                  const parentLink = isTrainerCategory
                                    ? `/${headerRoutesCategories[category as HeaderCategoryType]}/${transliterate(menuItem.theme)}`
                                    : undefined;

                                  return (
                                    <Flex
                                      onMouseLeave={() => setVisibleSubmenu(null)}
                                      align="start"
                                    >
                                      {isTrainerCategory ? (
                                        <Link
                                          to={parentLink!}
                                          className={`${styles.Header__submenu__item} 
                                    ${
                                      window.location.pathname.startsWith(
                                        `${startPath}/${headerRoutesCategories[category as HeaderCategoryType]}/${transliterate(menuItem.theme)}`,
                                      ) && styles.Header__submenu__item__active
                                    }`}
                                          onMouseEnter={() => setVisibleSubmenu(menuItem.theme)}
                                        >
                                          {menuItem.theme}
                                        </Link>
                                      ) : (
                                        <span
                                          className={`${styles.Header__submenu__item} 
                                    ${
                                      window.location.pathname.startsWith(
                                        `${startPath}/${headerRoutesCategories[category as HeaderCategoryType]}/${transliterate(menuItem.theme)}/`,
                                      ) && styles.Header__submenu__item__active
                                    }`}
                                          onMouseEnter={() => setVisibleSubmenu(menuItem.theme)}
                                        >
                                          {menuItem.theme}
                                        </span>
                                      )}

                                      <Flex
                                        align="start"
                                        data-testid={`${dataTestID}__submenu__submenu`}
                                        className={`${styles.Header__submenu__submenu} 
                                        ${visibleSubmenu === menuItem.theme && styles.Header__submenu__submenu__visible}`}
                                      >
                                        {submenuItems.map((items) => (
                                          <Flex
                                            key={items[0].subtheme}
                                            direction="column"
                                            align="start"
                                            className={
                                              styles.Header__submenu__submenu__column
                                            }
                                          >
                                            {items.map((item) => (
                                              <Link
                                                className={`${styles.Header__submenu__item} 
                                              ${
                                                matchPath(
                                                  `${startPath}${submenuItemLink(
                                                    item.subtheme,
                                                  )}`,
                                                  window.location.pathname,
                                                ) &&
                                                styles.Header__submenu__item__active
                                              }`}
                                                to={submenuItemLink(item.subtheme)}
                                                key={item.subtheme}
                                              >
                                                {item.subtheme}
                                              </Link>
                                            ))}
                                          </Flex>
                                        ))}
                                      </Flex>
                                    </Flex>
                                  );
                                })()}
                          </Fragment>
                        );
                      })}
                    </Flex>
                  )}
                </Flex>
              );
            })}
          </Flex>
{/* 
          {categoriesLoading && (
            <Flex maxHeight justify="center">
              <span className={styles.Header__item}>Идёт загрузка...</span>
            </Flex>
          )} */}

          <div style={{display: 'flex', alignItems: 'center'}}>
            <Flex maxHeight justify="center" className={styles.Header__item}>
            <Link to="/">Домой</Link>
          </Flex>
          <Flex maxHeight>
            {auth.isAuthenticated ? (
              <>
                {auth.user?.role === 'admin' && (
                  <Link to="/admin" className={styles.Header__item}>Админка</Link>
                )}
                <span
                  className={styles.Header__item}
                  role="button"
                  tabIndex={0}
                  onClick={async () => { try { await fetch('/api/auth/logout', { method: 'POST' }); } catch(_){}; dispatch(authActions.logout()); }}
                >
                  Выйти
                </span>
              </>
            ) : (
              <span
                className={styles.Header__item}
                role="button"
                tabIndex={0}
                onClick={() => setLoginOpen(true)}
              >
                Войти
              </span>
            )}
          </Flex>
          </div>
          </FetchProvider>

      {loginOpen && (
        <div className={styles.LoginOverlay} onClick={() => setLoginOpen(false)}>
          <div className={styles.LoginCard} onClick={(e) => e.stopPropagation()}>
            <div style={{ fontWeight: 600, fontSize: 18, marginBottom: 10 }}>Вход</div>
            <form onSubmit={onLogin}>
              <div className={styles.LoginField}>
                <label>Логин</label>
                <input className={styles.LoginInput} value={username} onChange={(e) => setUsername(e.target.value)} />
              </div>
              <div className={styles.LoginField}>
                <label>Пароль</label>
                <input type="password" className={styles.LoginInput} value={password} onChange={(e) => setPassword(e.target.value)} />
              </div>
              {loginError && <div style={{ color: '#e53935', marginBottom: 8 }}>{loginError}</div>}
              <button className={styles.LoginButton} type="submit">Войти</button>
            </form>
            <div className={styles.LoginClose} onClick={() => setLoginOpen(false)}>Закрыть</div>
            <div className={styles.LoginClose}>Админ по умолчанию: admin / admin</div>
          </div>
        </div>
      )}

      </header>
    );
  },
);

Header.displayName = 'Header';
