import { Flex } from '@/shared/lib/Stack';
import * as styles from './Header.module.scss';
import { Fragment, memo, useEffect, useState } from 'react';
import { headerCategories, headerRoutesCategories } from '../model/data';
import { HeaderCategoryType, HeaderMenu } from '../model/types';
import { Link, matchPath } from 'react-router-dom';
import { transliterate } from '@/shared/utils/transliterate';
import { isInJest } from '@/shared/tests/isInJest';

import { FetchProvider } from '../lib/FetchProvider/FetchProvider';
import { useAppDispatch, useAppSelector } from '@/shared/store/config/AppStore';
import { authActions } from '@/shared/auth/model/slice';

interface HeaderProps {
  withHomeButton?: boolean;
}

export const Header: React.FC<HeaderProps> = memo(
  ({ withHomeButton = true }): React.JSX.Element => {
    const [headerHoveredCategory, setHoveredHeaderCategory] = useState<string | null>(null);
    const [visibleSubmenu, setVisibleSubmenu] = useState<string | null>(null);

    const getAttr = (name: string) => document?.body?.getAttribute(name) ?? '';
    const getBool = (name: string) => (document?.body?.getAttribute(name) ?? 'false') === 'true';

    const publicUrl = isInJest() ? '' : getAttr('data-publicurl');
    const isDev = getBool('data-isdev');
    const startPath = isDev ? '' : `/${publicUrl}`;

    const [categories, setCategories] = useState<HeaderMenu>(headerCategories);
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
        <FetchProvider setCategories={setCategories} setCategoriesLoading={setCategoriesLoading}>
          <Flex maxHeight>
            {(Object.entries(categories) as Array<[string, any[]]>).map(([category, submenu]) => {
              const routeSlug =
                headerRoutesCategories[category as HeaderCategoryType] ?? 'trainers';
              const itemLink = `/${routeSlug}`;
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
                        setHoveredHeaderCategory((prev) => (prev === category ? null : category));
                      }
                    }}
                    tabIndex={0}
                    className={`${styles.Header__item} ${
                      matchPath(itemLink, window.location.pathname) && styles.Header__item__active
                    }`}
                    data-testid={dataTestID}
                    role={submenu.length > 0 ? 'button' : undefined}
                  >
                    {submenu.length > 0 ? <>{category}</> : <Link to={itemLink}>{category}</Link>}
                  </Flex>

                  {submenu.length > 0 && (
                    <Flex
                      align="start"
                      className={`${styles.Header__submenu} ${
                        headerHoveredCategory === category && styles.Header__submenu__active
                      }`}
                      direction="column"
                      data-testid={`${dataTestID}__submenu`}
                    >
                      {submenu.map((menuItem: any) => {
                        const isUsual = typeof menuItem === 'string';

                        return (
                          <Fragment key={isUsual ? menuItem : menuItem.theme}>
                            {isUsual
                              ? (() => {
                                  const submenuItemLink = `/${headerRoutesCategories[
                                    category as HeaderCategoryType
                                  ]}/${transliterate(menuItem)}`;

                                  return (
                                    <Link
                                      to={submenuItemLink}
                                      className={`${styles.Header__submenu__item} ${
                                        matchPath(`${startPath}${submenuItemLink}`, window.location.pathname) &&
                                        styles.Header__submenu__item__active
                                      }`}
                                      onClick={() => setHoveredHeaderCategory(null)}
                                    >
                                      {menuItem}
                                    </Link>
                                  );
                                })()
                              : (() => {
                                  // IMPORTANT: ╤Б╤В╤А╨╛╨╕╨╝ ╤Б╤Б╤Л╨╗╨║╨╕
                                  const submenuItemLink = (subTheme: string, slug?: string): string => {
                                    if (category === 'Тренажеры') {
                                      // /trainers/:slug
                                      return `/${headerRoutesCategories[category as HeaderCategoryType]}/${slug}`;
                                    }
                                    // ╨╛╨▒╤Л╤З╨╜╤Л╨╡ ╤А╨░╨╖╨┤╨╡╨╗╤Л
                                    return `/${headerRoutesCategories[category as HeaderCategoryType]}/${transliterate(
                                      menuItem.theme,
                                    )}/${transliterate(subTheme)}`;
                                  };

                                  // ╨║╨╛╨╗╨╛╨╜╨║╨╕ ╨┐╨╛ 10 ╤Н╨╗╨╡╨╝╨╡╨╜╤В╨╛╨▓
                                  const submenuItems = menuItem.items.reduce(
                                    (acc: Array<typeof menuItem.items>, item: any, index: number) => {
                                      const chunkIndex = Math.floor(index / 10);
                                      if (!acc[chunkIndex]) acc[chunkIndex] = [];
                                      acc[chunkIndex].push(item);
                                      return acc;
                                    },
                                    [],
                                  );

                                  const isTrainerCategory = category === 'Тренажеры';

                                  return (
                                    <Flex onMouseLeave={() => setVisibleSubmenu(null)} align="start">
                                      {/* ╨Ч╨░╨│╨╛╨╗╨╛╨▓╨╛╨║ ╨║╨╛╨╗╨╛╨╜╨║╨╕ */}
                                      <span
                                        className={`${styles.Header__submenu__item} ${
                                          window.location.pathname.startsWith(
                                            `${startPath}/${headerRoutesCategories[category as HeaderCategoryType]}/${transliterate(
                                              menuItem.theme,
                                            )}`,
                                          ) && styles.Header__submenu__item__active
                                        }`}
                                        onMouseEnter={() => setVisibleSubmenu(menuItem.theme)}
                                      >
                                        {menuItem.theme}
                                      </span>

                                      <Flex
                                        align="start"
                                        data-testid={`${dataTestID}__submenu__submenu`}
                                        className={`${styles.Header__submenu__submenu} ${
                                          visibleSubmenu === menuItem.theme &&
                                          styles.Header__submenu__submenu__visible
                                        }`}
                                      >
                                        {submenuItems.map((items: any[]) => (
                                          <Flex
                                            key={(items[0]?.slug as string) || items[0]?.subtheme}
                                            direction="column"
                                            align="start"
                                            className={styles.Header__submenu__submenu__column}
                                          >
                                            {items.map((item: any) => {
                                              const link = submenuItemLink(item.subtheme, item.slug);
                                              const key = item.slug ?? item.subtheme;
                                              return (
                                                <Link
                                                  className={`${styles.Header__submenu__item} ${
                                                    matchPath(`${startPath}${link}`, window.location.pathname) &&
                                                    styles.Header__submenu__item__active
                                                  }`}
                                                  to={link}
                                                  key={key}
                                                >
                                                  {item.subtheme}
                                                </Link>
                                              );
                                            })}
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

          <div style={{ display: 'flex', alignItems: 'center' }}>
            {withHomeButton && (
              <Flex maxHeight justify="center" className={styles.Header__item}>
                <Link to="/">Домой</Link>
              </Flex>
            )}
            <Flex maxHeight>
              {auth.isAuthenticated ? (
                <>
                  {auth.user?.role === 'admin' && (
                    <Link to="/admin" className={styles.Header__item}>
                      Админка
                    </Link>
                  )}
                  <span
                    className={styles.Header__item}
                    role="button"
                    tabIndex={0}
                    onClick={async () => {
                      try {
                        await fetch('/api/auth/logout', { method: 'POST' });
                      } catch {}
                      dispatch(authActions.logout());
                    }}
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
                  <input
                    className={styles.LoginInput}
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                  />
                </div>
                <div className={styles.LoginField}>
                  <label>Пароль</label>
                  <input
                    type="password"
                    className={styles.LoginInput}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                </div>
                {loginError && <div style={{ color: '#e53935', marginBottom: 8 }}>{loginError}</div>}
                <button className={styles.LoginButton} type="submit">
                  Войти
                </button>
              </form>
              <div className={styles.LoginClose} onClick={() => setLoginOpen(false)}>
                Закрыть
              </div>
            </div>
          </div>
        )}
      </header>
    );
  },
);

Header.displayName = 'Header';
