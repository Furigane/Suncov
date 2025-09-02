import React, { useEffect, useMemo, useState } from 'react';
import * as styles from './AdminPage.module.scss';
import { useAppDispatch, useAppSelector } from '@/shared/store/config/AppStore';
import { authActions } from '@/shared/auth/model/slice';
import type { AuthUser, Role } from '@/shared/auth/model/types';
import { Link } from 'react-router-dom';
import { transliterate } from '@/shared/utils/transliterate/transliterate';

type AnyObj = Record<string, any>;

/* ========================= helpers ========================= */

const normUser = (u: AnyObj): AuthUser & { username?: string; role?: Role } => ({
  id: u.id,
  firstName: u.first_name ?? u.firstName ?? '',
  lastName: u.last_name ?? u.lastName ?? '',
  ...(u.username ? { username: u.username } : {}),
  ...(u.role ? { role: u.role } : {}),
} as any);

const normCategory = (c: AnyObj) => ({
  id: c.id,
  name: c.name,
  slug: c.slug,
  parent_id: c.parent_id ?? null,
  position: typeof c.position === 'number' ? c.position : 0,
});

const normTrainer = (t: AnyObj) => ({
  id: t.id,
  title: t.title,
  slug: t.slug,
  categorySlug: t.category_slug ?? t.categorySlug ?? null,
  type: t.type,
  meta: t.meta ?? {},
});
type Trainer = ReturnType<typeof normTrainer>;
type Category = ReturnType<typeof normCategory>;

type TrainerItem = {
  id: string;
  trainer_id: string;
  order_index: number;
  payload: AnyObj;
  answer: string | null;
  created_at?: string;
};

const toTrainerCreateBody = (t: {
  title: string; slug: string; categorySlug: string | null; type: string; meta?: AnyObj;
}) => ({
  title: t.title,
  slug: t.slug,
  category_slug: t.categorySlug,
  type: t.type,
  meta: t.meta ?? {},
});

const toCategoryCreateBody = (c: {
  name: string; slug: string; parentId: string | null; position: number;
}) => ({
  name: c.name,
  slug: c.slug,
  parent_id: c.parentId,
  position: c.position,
});

async function jsonFetch<T = any>(input: RequestInfo, init?: RequestInit): Promise<T> {
  const res = await fetch(input, init);
  let data: any = null;
  try { data = await res.json(); } catch {}
  if (!res.ok) {
    const msg = data?.error || res.statusText || 'Request error';
    const details = data?.details ? `\n${data.details}` : '';
    throw new Error(`${msg}${details}`);
  }
  return data as T;
}

/* =============================== component =============================== */

export const AdminPage: React.FC = () => {
  const dispatch = useAppDispatch();
  const auth = useAppSelector((s) => s.auth);
  const onLogout = () => dispatch(authActions.logout());

  type AdminTab = 'users' | 'trainers';
  const [tab, setTab] = useState<AdminTab>('trainers');

  /* ---------------- Users ---------------- */
  const [users, setUsers] = useState<AuthUser[]>([]);
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<Role>('user');

  const fetchUsers = async () => {
    const data = await jsonFetch<{ users: AnyObj[] }>('/api/users');
    setUsers((data.users || []).map(normUser));
  };
  const onAddUser = async () => {
    if (!firstName || !lastName || !code) return;
    const data = await jsonFetch<{ user: AnyObj }>('/api/users', {
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
    setUsers((prev) => [...prev, normUser(data.user)]);
    setFirstName(''); setLastName(''); setCode(''); setPassword(''); setRole('user');
  };
  const onDeleteUser = async (id: string) => {
    await jsonFetch(`/api/users/${id}`, { method: 'DELETE' });
    setUsers((p) => p.filter((u) => u.id !== id));
    if (auth.user?.id === id) dispatch(authActions.logout());
  };
  useEffect(() => { fetchUsers().catch(()=>{}); }, []);

  /* --------- Categories / Trainers --------- */
  const [categories, setCategories] = useState<Category[]>([]);
  const [trainers, setTrainers] = useState<Trainer[]>([]);

  const fetchCategories = async () => {
    const data = await jsonFetch<{ categories: AnyObj[] }>('/api/categories');
    setCategories((data.categories || []).map(normCategory));
  };
  const fetchTrainers = async () => {
    const data = await jsonFetch<{ trainers: AnyObj[] }>('/api/trainers');
    setTrainers((data.trainers || []).map(normTrainer));
  };
  useEffect(() => { if (tab==='trainers') Promise.all([fetchCategories(), fetchTrainers()]).catch(()=>{}); }, [tab]);

  /* create category */
  const [cName, setCName] = useState('');
  const [cSlug, setCSlug] = useState('');
  const [cParentId, setCParentId] = useState<string>('');
  const [cPosition, setCPosition] = useState<number>(0);

  const onAddCategory = async () => {
    if (!cName) return;
    const body = toCategoryCreateBody({
      name: cName.trim(),
      slug: (cSlug || transliterate(cName)).trim(),
      parentId: cParentId || null,
      position: Number.isFinite(cPosition) ? cPosition : 0,
    });
    const data = await jsonFetch<{ category: AnyObj }>('/api/categories', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    setCategories((p) => [...p, normCategory(data.category)]);
    setCName(''); setCSlug(''); setCParentId(''); setCPosition(0);
  };
  const onDeleteCategory = async (id: string) => {
    await jsonFetch(`/api/categories/${id}`, { method: 'DELETE' });
    setCategories((p) => p.filter((c) => c.id !== id));
  };

  /* create trainer */
  const [tTitle, setTTitle] = useState('');
  const [tSlug, setTSlug] = useState('');
  const [tCategory, setTCategory] = useState(''); // slug
  const [tType, setTType] = useState('two_choice');

  useEffect(() => { if (tTitle && !tSlug) setTSlug(transliterate(tTitle)); }, [tTitle, tSlug]);

  const onAddTrainer = async () => {
    if (!tTitle) return;
    const body = toTrainerCreateBody({
      title: tTitle.trim(),
      slug: (tSlug || transliterate(tTitle)).trim(),
      categorySlug: (tCategory || '').trim() || null,
      type: (tType || 'two_choice').trim(),
      meta: {},
    });
    const data = await jsonFetch<{ trainer: AnyObj }>('/api/trainers', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    setTrainers((p) => [...p, normTrainer(data.trainer)]);
    setTTitle(''); setTSlug(''); setTCategory(''); setTType('two_choice');
  };
  const onDeleteTrainer = async (id: string) => {
    await jsonFetch(`/api/trainers/${id}`, { method: 'DELETE' });
    setSelectedTrainerId((prev) => (prev === id ? '' : prev));
    setTrainers((p) => p.filter((t) => t.id !== id));
    setItems([]);
  };

  /* items */
  const [selectedTrainerId, setSelectedTrainerId] = useState<string>('');
  const selectedTrainer = useMemo(
    () => trainers.find((t) => t.id === selectedTrainerId) || trainers.find((t) => t.slug === selectedTrainerId) || null,
    [selectedTrainerId, trainers],
  );

  const [items, setItems] = useState<TrainerItem[]>([]);

  // new item state (two_choice)
  const [newValid, setNewValid] = useState('');
  const [newInvalid, setNewInvalid] = useState('');
  const [newCorrect, setNewCorrect] = useState<'valid'|'invalid'>('valid');
  const [newOrder, setNewOrder] = useState<number>(0);
  // new item state (views)
  const [newLeft, setNewLeft] = useState('');
  const [newRight, setNewRight] = useState('');
  const [newCorrectText, setNewCorrectText] = useState<'left'|'right'>('left');

  const loadItems = async (idOrSlug: string) => {
    const data = await jsonFetch<{ items: TrainerItem[] }>(`/api/trainers/${encodeURIComponent(idOrSlug)}/items`);
    setItems(data.items || []);
  };
  useEffect(() => { if (selectedTrainerId) loadItems(selectedTrainerId).catch(()=>{}); }, [selectedTrainerId]);

  const onCreateItem = async () => {
    if (!selectedTrainer) return;

    if (selectedTrainer.type === 'two_choice') {
      const data = await jsonFetch<{ item: AnyObj }>(`/api/trainers/${encodeURIComponent(selectedTrainer.id)}/items`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderIndex: Number.isFinite(newOrder) ? newOrder : 0,
          valid: newValid || null,
          invalid: newInvalid || null,
          correctIsValid: newCorrect === 'valid',
          extra: {},
        }),
      });
      setItems((p) => [...p, data.item as TrainerItem]);
      setNewValid(''); setNewInvalid(''); setNewCorrect('valid'); setNewOrder(0);
      return;
    }

    // views
    const correct = (newCorrectText === 'left') ? newLeft : newRight;
    const data = await jsonFetch<{ item: AnyObj }>(`/api/trainers/${encodeURIComponent(selectedTrainer.id)}/items`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        orderIndex: Number.isFinite(newOrder) ? newOrder : 0,
        left: newLeft, right: newRight, correct
      }),
    });
    setItems((p) => [...p, data.item as TrainerItem]);
    setNewLeft(''); setNewRight(''); setNewCorrectText('left'); setNewOrder(0);
  };

  const onUpdateItem = async (it: TrainerItem) => {
    if (!selectedTrainer) return;

    if (selectedTrainer.type === 'two_choice') {
      const valid = it.payload?.valid ?? '';
      const invalid = it.payload?.invalid ?? '';
      const correctIsValid = (it.answer === 'valid');
      const body = { orderIndex: it.order_index, valid, invalid, correctIsValid, extra: {} };
      const data = await jsonFetch<{ item: AnyObj }>(`/api/trainer-items/${it.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      setItems((p) => p.map(x => x.id === it.id ? (data.item as TrainerItem) : x));
      return;
    }

    // views
    const left = it.payload?.left ?? '';
    const right = it.payload?.right ?? '';
    const correct = it.answer ?? left;
    const body = { orderIndex: it.order_index, payload: { left, right }, answer: correct };
    const data = await jsonFetch<{ item: AnyObj }>(`/api/trainer-items/${it.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    setItems((p) => p.map(x => x.id === it.id ? (data.item as TrainerItem) : x));
  };

  const onDeleteItem = async (id: string) => {
    await jsonFetch(`/api/trainer-items/${id}`, { method: 'DELETE' });
    setItems((p) => p.filter(x => x.id !== id));
  };

  /* =============================== UI =============================== */

  if (auth.user?.role !== 'admin') {
    return (
      <div className={styles.AdminPage}>
        <div className={styles.Header}>
          <h2>Админка</h2>
          <button className={styles.Button} onClick={onLogout}>Выйти</button>
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
          <Link to="/" className={styles.Button}>На главную</Link>
          <button className={styles.Button} onClick={onLogout}>Выйти</button>
        </div>
      </div>

      <div className={styles.Tabs}>
        <button className={`${styles.Tab} ${tab==='users' ? styles.TabActive : ''}`} onClick={() => setTab('users')}>Аккаунты</button>
        <button className={`${styles.Tab} ${tab==='trainers' ? styles.TabActive : ''}`} onClick={() => setTab('trainers')}>Тренажёры</button>
      </div>

      {tab === 'users' && (
        <>
          <div className={styles.Card}>
            <h3>Добавить пользователя</h3>
            <div className={styles.Row}>
              <input className={styles.Input} placeholder="Имя" value={firstName} onChange={(e)=>setFirstName(e.target.value)} />
              <input className={styles.Input} placeholder="Фамилия" value={lastName} onChange={(e)=>setLastName(e.target.value)} />
            </div>
            <div className={styles.Row}>
              <input className={styles.Input} placeholder="Код (логин)" value={code} onChange={(e)=>setCode(e.target.value)} />
              <input className={styles.Input} placeholder="Пароль" type="password" value={password} onChange={(e)=>setPassword(e.target.value)} />
              <select className={styles.Input} value={role} onChange={(e)=>setRole(e.target.value as Role)}>
                <option value="user">Пользователь</option>
                <option value="admin">Администратор</option>
              </select>
              <button className={styles.Button} onClick={() => onAddUser().catch(err=>alert(err.message))}>Добавить</button>
            </div>
          </div>

          <h3 style={{ marginTop: 16 }}>Пользователи</h3>
          <div className={styles.Users}>
            {users.map((u: any) => (
              <div key={u.id} className={styles.Card}>
                <div><b>{u.lastName} {u.firstName}</b></div>
                {u.username && <div>Логин: {u.username}</div>}
                {u.role && <div>Роль: {u.role}</div>}
                <div style={{ marginTop: 8 }}>
                  <button className={`${styles.Button} ${styles.Danger}`} onClick={() => onDeleteUser(u.id).catch(err=>alert(err.message))}>Удалить</button>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {tab === 'trainers' && (
        <>
          <div className={styles.Card}>
            <h3>Добавить тренажёр</h3>
            <div className={styles.Row}>
              <input className={styles.Input} placeholder="Название" value={tTitle} onChange={(e)=>setTTitle(e.target.value)} />
              <input className={styles.Input} placeholder="Слаг (если пусто — из названия)" value={tSlug} onChange={(e)=>setTSlug(e.target.value)} />
              <select className={styles.Input} value={tCategory} onChange={(e)=>setTCategory(e.target.value)}>
                <option value="">Категория (необязательно)</option>
                {categories.map((c) => (<option key={c.id} value={c.slug}>{c.name}</option>))}
              </select>
              <select className={styles.Input} value={tType} onChange={(e)=>setTType(e.target.value)}>
                <option value="two_choice">two_choice</option>
                <option value="views">views</option>
              </select>
              <button className={styles.Button} onClick={() => onAddTrainer().catch(err=>alert(err.message))}>Добавить</button>
            </div>
          </div>

          <div className={styles.Card}>
            <h3>Добавить категорию</h3>
            <div className={styles.Row}>
              <input className={styles.Input} placeholder="Название" value={cName} onChange={(e)=>setCName(e.target.value)} />
              <input className={styles.Input} placeholder="Слаг (если пусто — из названия)" value={cSlug} onChange={(e)=>setCSlug(e.target.value)} />
              <select className={styles.Input} value={cParentId} onChange={(e)=>setCParentId(e.target.value)}>
                <option value="">Родитель (необязательно)</option>
                {categories.map((c) => (<option key={c.id} value={c.id}>{c.name}</option>))}
              </select>
              <input className={styles.Input} placeholder="Позиция" type="number" value={cPosition} onChange={(e)=>setCPosition(Number(e.target.value))} />
              <button className={styles.Button} onClick={() => onAddCategory().catch(err=>alert(err.message))}>Добавить</button>
            </div>
          </div>

          <div className={styles.Row} style={{ marginTop: 16 }}>
            <div style={{ flex: 1, minWidth: 320 }}>
              <h3>Тренажёры</h3>
              <div className={styles.Users}>
                {trainers.map((t) => (
                  <div
                    key={t.id}
                    className={`${styles.Card} ${selectedTrainer?.id === t.id ? styles.TabActive : ''}`}
                    style={{ cursor: 'pointer' }}
                    onClick={() => setSelectedTrainerId(t.id)}
                  >
                    <div><b>{t.title}</b></div>
                    <div>slug: {t.slug}</div>
                    {t.categorySlug && <div>category: {t.categorySlug}</div>}
                    <div>type: {t.type}</div>
                    <div style={{ marginTop: 8, display: 'flex', gap: 8 }}>
                      <button className={styles.Button} onClick={(e)=>{e.stopPropagation(); setSelectedTrainerId(t.id); loadItems(t.id).catch(()=>{});}}>Задания</button>
                      <button className={`${styles.Button} ${styles.Danger}`} onClick={(e)=>{e.stopPropagation(); onDeleteTrainer(t.id).catch(err=>alert(err.message));}}>Удалить</button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div style={{ flex: 2, minWidth: 420 }}>
              <h3>Задания {selectedTrainer ? `(${selectedTrainer.title})` : ''}</h3>

              {/* create item — типоспецифично */}
              {selectedTrainer?.type === 'two_choice' && (
                <div className={styles.Card}>
                  <h4>Добавить задание (two_choice)</h4>
                  <div className={styles.Row}>
                    <input className={styles.Input} placeholder="Правильный вариант (valid)" value={newValid} onChange={(e)=>setNewValid(e.target.value)} />
                    <input className={styles.Input} placeholder="Неправильный вариант (invalid)" value={newInvalid} onChange={(e)=>setNewInvalid(e.target.value)} />
                  </div>
                  <div className={styles.Row}>
                    <select className={styles.Input} value={newCorrect} onChange={(e)=>setNewCorrect(e.target.value as any)}>
                      <option value="valid">Ответ: valid</option>
                      <option value="invalid">Ответ: invalid</option>
                    </select>
                    <input className={styles.Input} placeholder="Порядок (orderIndex)" type="number" value={newOrder} onChange={(e)=>setNewOrder(Number(e.target.value))} />
                    <button className={styles.Button} disabled={!selectedTrainerId} onClick={() => onCreateItem().catch(err=>alert(err.message))}>Добавить</button>
                  </div>
                </div>
              )}

              {selectedTrainer?.type === 'views' && (
                <div className={styles.Card}>
                  <h4>Добавить задание (views)</h4>
                  <div className={styles.Row}>
                    <input className={styles.Input} placeholder="Левый вариант (left)" value={newLeft} onChange={(e)=>setNewLeft(e.target.value)} />
                    <input className={styles.Input} placeholder="Правый вариант (right)" value={newRight} onChange={(e)=>setNewRight(e.target.value)} />
                  </div>
                  <div className={styles.Row}>
                    <select className={styles.Input} value={newCorrectText} onChange={(e)=>setNewCorrectText(e.target.value as any)}>
                      <option value="left">Правильный: левый</option>
                      <option value="right">Правильный: правый</option>
                    </select>
                    <input className={styles.Input} placeholder="Порядок (orderIndex)" type="number" value={newOrder} onChange={(e)=>setNewOrder(Number(e.target.value))} />
                    <button className={styles.Button} disabled={!selectedTrainerId} onClick={() => onCreateItem().catch(err=>alert(err.message))}>Добавить</button>
                  </div>
                </div>
              )}

              {/* list items */}
              <div className={styles.Users}>
                {items.map((it) => {
                  if (selectedTrainer?.type === 'two_choice') {
                    const v = it.payload?.valid ?? '';
                    const inv = it.payload?.invalid ?? '';
                    const corr: 'valid'|'invalid' = (it.answer === 'invalid') ? 'invalid' : 'valid';
                    return (
                      <div key={it.id} className={styles.Card}>
                        <div className={styles.Row}>
                          <input className={styles.Input} placeholder="valid" value={v} onChange={(e)=>setItems(p => p.map(x => x.id === it.id ? ({ ...x, payload: { ...x.payload, valid: e.target.value } }) : x))} />
                          <input className={styles.Input} placeholder="invalid" value={inv} onChange={(e)=>setItems(p => p.map(x => x.id === it.id ? ({ ...x, payload: { ...x.payload, invalid: e.target.value } }) : x))} />
                        </div>
                        <div className={styles.Row}>
                          <select className={styles.Input} value={corr} onChange={(e)=>setItems(p => p.map(x => x.id === it.id ? ({ ...x, answer: e.target.value }) : x))}>
                            <option value="valid">Ответ: valid</option>
                            <option value="invalid">Ответ: invalid</option>
                          </select>
                          <input className={styles.Input} type="number" placeholder="order" value={it.order_index} onChange={(e)=>setItems(p => p.map(x => x.id === it.id ? ({ ...x, order_index: Number(e.target.value) }) : x))} />
                          <div style={{ display: 'flex', gap: 8 }}>
                            <button className={styles.Button} onClick={() => onUpdateItem(it).catch(err=>alert(err.message))}>Сохранить</button>
                            <button className={`${styles.Button} ${styles.Danger}`} onClick={() => onDeleteItem(it.id).catch(err=>alert(err.message))}>Удалить</button>
                          </div>
                        </div>
                      </div>
                    );
                  }

                  // views row
                  const left = it.payload?.left ?? '';
                  const right = it.payload?.right ?? '';
                  const correct = it.answer ?? left;
                  return (
                    <div key={it.id} className={styles.Card}>
                      <div className={styles.Row}>
                        <input className={styles.Input} placeholder="left" value={left} onChange={(e)=>setItems(p => p.map(x => x.id === it.id ? ({ ...x, payload: { ...x.payload, left: e.target.value } }) : x))} />
                        <input className={styles.Input} placeholder="right" value={right} onChange={(e)=>setItems(p => p.map(x => x.id === it.id ? ({ ...x, payload: { ...x.payload, right: e.target.value } }) : x))} />
                      </div>
                      <div className={styles.Row}>
                        <select className={styles.Input} value={correct === right ? 'right' : 'left'} onChange={(e)=>setItems(p => p.map(x => x.id === it.id ? ({ ...x, answer: e.target.value === 'right' ? (x.payload?.right ?? '') : (x.payload?.left ?? '') }) : x))}>
                          <option value="left">Правильный: левый</option>
                          <option value="right">Правильный: правый</option>
                        </select>
                        <input className={styles.Input} type="number" placeholder="order" value={it.order_index} onChange={(e)=>setItems(p => p.map(x => x.id === it.id ? ({ ...x, order_index: Number(e.target.value) }) : x))} />
                        <div style={{ display: 'flex', gap: 8 }}>
                          <button className={styles.Button} onClick={() => onUpdateItem(it).catch(err=>alert(err.message))}>Сохранить</button>
                          <button className={`${styles.Button} ${styles.Danger}`} onClick={() => onDeleteItem(it.id).catch(err=>alert(err.message))}>Удалить</button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {!selectedTrainerId && <div style={{ opacity: 0.7, marginTop: 8 }}>Выбери тренажёр слева, чтобы увидеть задания.</div>}
            </div>
          </div>

          <h3 style={{ marginTop: 16 }}>Категории</h3>
          <div className={styles.Users}>
            {categories.map((c) => (
              <div key={c.id} className={styles.Card}>
                <div><b>{c.name}</b></div>
                <div>slug: {c.slug}</div>
                {c.parent_id && <div>parent: {c.parent_id}</div>}
                <div>position: {c.position ?? 0}</div>
                <div style={{ marginTop: 8 }}>
                  <button className={`${styles.Button} ${styles.Danger}`} onClick={()=>onDeleteCategory(c.id).catch(err=>alert(err.message))}>Удалить</button>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
};
