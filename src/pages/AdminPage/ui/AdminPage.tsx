import React, { useEffect, useState } from 'react';
import * as styles from './AdminPage.module.scss';
import { useAppDispatch, useAppSelector } from '@/shared/store/config/AppStore';
import { authActions } from '@/shared/auth/model/slice';
import type { AuthUser, Role } from '@/shared/auth/model/types';
import { Link } from 'react-router-dom';
import { transliterate } from '@/shared/utils/transliterate/transliterate';

export const AdminPage: React.FC = () => {
  const dispatch = useAppDispatch();
  const auth = useAppSelector((s) => s.auth);
  const [users, setUsers] = useState<AuthUser[]>([]);
  type AdminTab = 'users' | 'trainers';
  const [tab, setTab] = useState<AdminTab>('users');

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<Role>('user');

  const onAdd = async () => {
    if (!firstName || !lastName || !code) return;
    try {
      const res = await fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          username: code.trim(),
          password: (password || code).trim(),
          role,
        }),
      });
      const data = await res.json();
      if (!res.ok)
        throw new Error(data?.error || 'Ошибка при создании пользователя');
      setUsers((prev) => [...prev, data.user as any]);
      setFirstName('');
      setLastName('');
      setCode('');
      setRole('user');
      setPassword('');
    } catch (e) {
      alert((e as Error).message);
    }
  };

  const onDelete = async (id: string) => {
    try {
      const res = await fetch(`/api/users/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Ошибка при удалении пользователя');
      setUsers((prev) => prev.filter((u) => u.id !== id));
      if (auth.user?.id === id) dispatch(authActions.logout());
    } catch (e) {
      alert((e as Error).message);
    }
  };

  const onLogout = () => dispatch(authActions.logout());

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/users');
        const data = await res.json();
        if (res.ok) setUsers(data.users || []);
      } catch {
        // ignore
      }
    })();
  }, []);

  // Trainers tab state
  interface Trainer {
    id: string;
    title: string;
    slug: string;
    categorySlug: string | null;
    type: string;
  }
  const [trainers, setTrainers] = useState<Trainer[]>([]);
  const [tTitle, setTTitle] = useState('');
  const [tSlug, setTSlug] = useState('');
  const [tCategory, setTCategory] = useState('');
  const [tType, setTType] = useState('custom');

  // Trainer items state
  const [tiTrainerId, setTiTrainerId] = useState('');
  const [tiOrder, setTiOrder] = useState<number>(0);
  const [tiWords, setTiWords] = useState('');
  const [tiCorrect, setTiCorrect] = useState('');
  const [tiWrong, setTiWrong] = useState('');

  // Categories state
  interface Category {
    id: string;
    name: string;
    slug: string;
    parent_id?: string | null;
    position?: number;
  }
  const [categories, setCategories] = useState<Category[]>([]);
  const [cName, setCName] = useState('');
  const [cSlug, setCSlug] = useState('');
  const [cParentId, setCParentId] = useState<string>('');
  const [cPosition, setCPosition] = useState<number>(0);

  const fetchTrainers = async () => {
    try {
      const res = await fetch('/api/trainers');
      const data = await res.json();
      if (res.ok) setTrainers(data.trainers || []);
    } catch {}
  };
  const fetchCategories = async () => {
    try {
      const res = await fetch('/api/categories');
      const data = await res.json();
      if (res.ok) setCategories(data.categories || []);
    } catch {}
  };

  useEffect(() => {
    if (tab !== 'trainers') return;
    fetchTrainers();
    fetchCategories();
  }, [tab]);

  const onAddTrainer = async () => {
    if (!tTitle) return;
    const payload = {
      title: tTitle.trim(),
      slug: (tSlug || transliterate(tTitle)).trim(),
      categorySlug: tCategory.trim() || null,
      type: tType.trim() || 'custom',
      meta: {},
    };
    try {
      const res = await fetch('/api/trainers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok)
        throw new Error(data?.error || 'Ошибка при создании тренажера');
      setTrainers((prev) => [...prev, data.trainer]);
      setTTitle('');
      setTSlug('');
      setTCategory('');
      setTType('custom');
    } catch (e) {
      alert((e as Error).message);
    }
  };

  const onDeleteTrainer = async (id: string) => {
    try {
      const res = await fetch(`/api/trainers/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Ошибка при удалении тренажера');
      setTrainers((p) => p.filter((t) => t.id !== id));
    } catch (e) {
      alert((e as Error).message);
    }
  };

  const onAddTrainerItem = async () => {
    if (!tiTrainerId) return;
    const payload = {
      orderIndex: Number.isFinite(tiOrder) ? tiOrder : 0,
      words: tiWords
        .split(',')
        .map((w) => w.trim())
        .filter(Boolean),
      correctAnswers: tiCorrect
        .split(',')
        .map((w) => w.trim())
        .filter(Boolean),
      wrongAnswers: tiWrong
        .split(',')
        .map((w) => w.trim())
        .filter(Boolean),
    };
    try {
      const res = await fetch(`/api/trainers/${tiTrainerId}/items`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || 'Ошибка при добавлении слов');
      setTiOrder(0);
      setTiWords('');
      setTiCorrect('');
      setTiWrong('');
    } catch (e) {
      alert((e as Error).message);
    }
  };

  const onAddCategory = async () => {
    if (!cName) return;
    const payload = {
      name: cName.trim(),
      slug: (cSlug || transliterate(cName)).trim(),
      parentId: cParentId || null,
      position: Number.isFinite(cPosition) ? cPosition : 0,
    };
    try {
      const res = await fetch('/api/categories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok)
        throw new Error(data?.error || 'Ошибка при создании категории');
      setCategories((prev) => [...prev, data.category]);
      setCName('');
      setCSlug('');
      setCParentId('');
      setCPosition(0);
    } catch (e) {
      alert((e as Error).message);
    }
  };
  const onDeleteCategory = async (id: string) => {
    try {
      const res = await fetch(`/api/categories/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Ошибка при удалении категории');
      setCategories((p) => p.filter((c) => c.id !== id));
    } catch (e) {
      alert((e as Error).message);
    }
  };

  if (auth.user?.role !== 'admin') {
    return (
      <div className={styles.AdminPage}>
        <div className={styles.Header}>
          <h2>Админка</h2>
          <button className={styles.Button} onClick={onLogout}>
            Выйти
          </button>
        </div>
        У вас нет прав доступа. Войдите под администратором.
      </div>
    );
  }

  return (
    <div className={styles.AdminPage}>
      <div className={styles.Header}>
        <h2>Админка</h2>
        <div style={{ display: 'flex', gap: 8 }}>
          <Link to="/" className={styles.Button}>
            На главную
          </Link>
          <button className={styles.Button} onClick={onLogout}>
            Выйти
          </button>
        </div>
      </div>

      <div className={styles.Tabs}>
        <button
          className={`${styles.Tab} ${tab === 'users' ? styles.TabActive : ''}`}
          onClick={() => setTab('users')}
        >
          Аккаунты
        </button>
        <button
          className={`${styles.Tab} ${tab === 'trainers' ? styles.TabActive : ''}`}
          onClick={() => setTab('trainers')}
        >
          Тренажеры
        </button>
      </div>

      {tab === 'users' && (
        <div className={styles.Card}>
          <h3>Добавить пользователя</h3>
          <div className={styles.Row}>
            <input
              className={styles.Input}
              placeholder="Имя"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
            />
            <input
              className={styles.Input}
              placeholder="Фамилия"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
            />
          </div>
          <div className={styles.Row}>
            <input
              className={styles.Input}
              placeholder="Код (логин)"
              value={code}
              onChange={(e) => setCode(e.target.value)}
            />
            <input
              className={styles.Input}
              placeholder="Пароль"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            <select
              className={styles.Input}
              value={role}
              onChange={(e) => setRole(e.target.value as Role)}
            >
              <option value="user">Пользователь</option>
              <option value="admin">Администратор</option>
            </select>
            <button className={styles.Button} onClick={onAdd}>
              Добавить
            </button>
          </div>
        </div>
      )}

      {tab === 'users' && (
        <>
          <h3 style={{ marginTop: 16 }}>Пользователи</h3>
          <div className={styles.Users}>
            {users.map((u) => (
              <div key={u.id} className={styles.Card}>
                <div>
                  <b>
                    {u.lastName} {u.firstName}
                  </b>
                </div>
                {'username' in u && <div>Логин: {(u as any).username}</div>}
                <div>Роль: {(u as any).role}</div>
                <div style={{ marginTop: 8 }}>
                  <button
                    className={`${styles.Button} ${styles.Danger}`}
                    onClick={() => onDelete(u.id)}
                  >
                    Удалить
                  </button>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {tab === 'trainers' && (
        <>
          <div className={styles.Card}>
            <h3>Добавить тренажер</h3>
            <div className={styles.Row}>
              <input
                className={styles.Input}
                placeholder="Название"
                value={tTitle}
                onChange={(e) => setTTitle(e.target.value)}
              />
              <input
                className={styles.Input}
                placeholder="Слаг (если пусто — из названия)"
                value={tSlug}
                onChange={(e) => setTSlug(e.target.value)}
              />
              <select
                className={styles.Input}
                value={tCategory}
                onChange={(e) => setTCategory(e.target.value)}
              >
                <option value="">Категория (необязательно)</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.slug}>
                    {c.name}
                  </option>
                ))}
              </select>
              <input
                className={styles.Input}
                placeholder="Тип"
                value={tType}
                onChange={(e) => setTType(e.target.value)}
              />
              <button className={styles.Button} onClick={onAddTrainer}>
                Добавить
              </button>
            </div>
          </div>

          <div className={styles.Card}>
            <h3>Добавить категорию</h3>
            <div className={styles.Row}>
              <input
                className={styles.Input}
                placeholder="Название"
                value={cName}
                onChange={(e) => setCName(e.target.value)}
              />
              <input
                className={styles.Input}
                placeholder="Слаг (если пусто — из названия)"
                value={cSlug}
                onChange={(e) => setCSlug(e.target.value)}
              />
              <select
                className={styles.Input}
                value={cParentId}
                onChange={(e) => setCParentId(e.target.value)}
              >
                <option value="">Родитель (необязательно)</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
              <input
                className={styles.Input}
                placeholder="Позиция"
                type="number"
                value={cPosition}
                onChange={(e) => setCPosition(Number(e.target.value))}
              />
              <button className={styles.Button} onClick={onAddCategory}>
                Добавить
              </button>
            </div>
          </div>

          <div className={styles.Card}>
            <h3>Добавить слова к тренажеру</h3>
            <div className={styles.Row}>
              <select
                className={styles.Input}
                value={tiTrainerId}
                onChange={(e) => setTiTrainerId(e.target.value)}
              >
                <option value="">Тренажер</option>
                {trainers.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.title}
                  </option>
                ))}
              </select>
              <input
                className={styles.Input}
                placeholder="Порядок"
                type="number"
                value={tiOrder}
                onChange={(e) => setTiOrder(Number(e.target.value))}
              />
            </div>
            <div className={styles.Row}>
              <input
                className={styles.Input}
                placeholder="Слова через запятую"
                value={tiWords}
                onChange={(e) => setTiWords(e.target.value)}
              />
              <input
                className={styles.Input}
                placeholder="Верные слова"
                value={tiCorrect}
                onChange={(e) => setTiCorrect(e.target.value)}
              />
              <input
                className={styles.Input}
                placeholder="Неверные слова"
                value={tiWrong}
                onChange={(e) => setTiWrong(e.target.value)}
              />
              <button className={styles.Button} onClick={onAddTrainerItem}>
                Добавить
              </button>
            </div>
          </div>

          <h3 style={{ marginTop: 16 }}>Тренажеры</h3>
          <div className={styles.Users}>
            {trainers.map((t) => (
              <div key={t.id} className={styles.Card}>
                <div>
                  <b>{t.title}</b>
                </div>
                <div>slug: {t.slug}</div>
                {t.categorySlug && <div>category: {t.categorySlug}</div>}
                <div>type: {t.type}</div>
                <div style={{ marginTop: 8 }}>
                  <button
                    className={`${styles.Button} ${styles.Danger}`}
                    onClick={() => onDeleteTrainer(t.id)}
                  >
                    Удалить
                  </button>
                </div>
              </div>
            ))}
          </div>

          <h3 style={{ marginTop: 16 }}>Категории</h3>
          <div className={styles.Users}>
            {categories.map((c) => (
              <div key={c.id} className={styles.Card}>
                <div>
                  <b>{c.name}</b>
                </div>
                <div>slug: {c.slug}</div>
                {c.parent_id && <div>parent: {c.parent_id}</div>}
                <div>position: {c.position ?? 0}</div>
                <div style={{ marginTop: 8 }}>
                  <button
                    className={`${styles.Button} ${styles.Danger}`}
                    onClick={() => onDeleteCategory(c.id)}
                  >
                    Удалить
                  </button>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
};
