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

const normTrainerItem = (item: AnyObj): TrainerItem => {
  const id = item.id != null ? String(item.id) : `tmp-${Math.random().toString(36).slice(2)}`;
  const trainerIdRaw = item.trainer_id ?? item.trainerId ?? '';
  const trainer_id = trainerIdRaw != null ? String(trainerIdRaw) : '';
  const order_index = typeof item.order_index === 'number'
    ? item.order_index
    : typeof item.orderIndex === 'number'
      ? item.orderIndex
      : 0;

  const payload: AnyObj = { ...(item.payload ?? {}) };
  if (!item.payload) {
    if (item.valid !== undefined || item.invalid !== undefined) {
      payload.valid = item.valid ?? '';
      payload.invalid = item.invalid ?? '';
    }
    if (item.left !== undefined || item.right !== undefined) {
      payload.left = item.left ?? '';
      payload.right = item.right ?? '';
    }
  }

  let answer: string | null = null;
  if (typeof item.answer === 'string') {
    answer = item.answer;
  } else if (typeof item.correctIsValid === 'boolean') {
    answer = item.correctIsValid ? 'valid' : 'invalid';
  } else if (typeof item.correct === 'string') {
    answer = item.correct;
  }

  return {
    id,
    trainer_id,
    order_index,
    payload,
    answer,
    created_at: item.created_at ?? item.createdAt,
  };
};

const sortTrainerItems = (items: TrainerItem[]) =>
  [...items].sort((a, b) => {
    const left = a.order_index ?? 0;
    const right = b.order_index ?? 0;
    if (left !== right) return left - right;
    return a.id.localeCompare(b.id);
  });

const buildTrainerBody = (t: {
  title: string;
  slug: string;
  categorySlug: string | null;
  type: string;
  meta?: any; // <-- было AnyObj, теперь any (может быть и массив)
}) => ({
  title: t.title,
  slug: t.slug,
  categorySlug: t.categorySlug,
  type: t.type,
  meta: t.meta ?? {},
});

const buildCategoryBody = (c: {
  name: string;
  slug: string | null;
  parentId: string | null;
  position: number | null;
}) => ({
  name: c.name,
  slug: c.slug,
  parentId: c.parentId,
  position: c.position,
});

const sortCategories = (cats: Category[]) =>
  [...cats].sort((a, b) => {
    const posA = a.position ?? 0;
    const posB = b.position ?? 0;
    if (posA !== posB) return posA - posB;
    return a.name.localeCompare(b.name);
  });

const sortTrainers = (list: Trainer[]) =>
  [...list].sort((a, b) => a.title.localeCompare(b.title));
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

  const [metaEditor, setMetaEditor] = useState<string>('{}');


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
    setCategories(sortCategories((data.categories || []).map(normCategory)));
  };
  const fetchTrainers = async () => {
    const data = await jsonFetch<{ trainers: AnyObj[] }>('/api/trainers');
    setTrainers(sortTrainers((data.trainers || []).map(normTrainer)));
  };
  useEffect(() => { if (tab==='trainers') Promise.all([fetchCategories(), fetchTrainers()]).catch(()=>{}); }, [tab]);

  /* create category */
  const [cName, setCName] = useState('');
  const [cSlug, setCSlug] = useState('');
  const [cParentId, setCParentId] = useState<string>('');
  const [cPosition, setCPosition] = useState<number>(0);
  const [editingCategoryId, setEditingCategoryId] = useState<string | null>(null);

  const resetCategoryForm = () => {
    setCName('');
    setCSlug('');
    setCParentId('');
    setCPosition(0);
    setEditingCategoryId(null);
  };

  const submitCategory = async () => {
    const name = cName.trim();
    if (!name) return;
    const resolvedSlug = (cSlug || transliterate(cName)).trim();
    const payload = buildCategoryBody({
      name,
      slug: resolvedSlug || null,
      parentId: cParentId ? String(cParentId) : null,
      position: Number.isFinite(cPosition) ? cPosition : null,
    });
    const targetId = editingCategoryId;
    const url = targetId ? `/api/categories/${encodeURIComponent(targetId)}` : '/api/categories';
    const method = targetId ? 'PUT' : 'POST';
    const data = await jsonFetch<{ category: AnyObj }>(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const category = normCategory(data.category);
    setCategories((prev) => {
      const next = targetId
        ? prev.map((c) => (c.id === category.id ? category : c))
        : [...prev, category];
      return sortCategories(next);
    });
    resetCategoryForm();
  };

  const onDeleteCategory = async (id: string) => {
    await jsonFetch(`/api/categories/${id}`, { method: 'DELETE' });
    setCategories((p) => sortCategories(p.filter((c) => c.id !== id)));
    if (editingCategoryId === id) {
      resetCategoryForm();
    }
  };

  const onStartCategoryEdit = (category: Category) => {
    setEditingCategoryId(category.id);
    setCName(category.name);
    setCSlug(category.slug ?? '');
    setCParentId(category.parent_id != null ? String(category.parent_id) : '');
    setCPosition(typeof category.position === 'number' ? category.position : 0);
  };
  /* create trainer */
  const [tTitle, setTTitle] = useState('');
  const [tSlug, setTSlug] = useState('');
  const [tCategory, setTCategory] = useState(''); // slug
  const [tType, setTType] = useState('two_choice');
  const [tMeta, setTMeta] = useState<string>('{}');
  const [editingTrainerId, setEditingTrainerId] = useState<string | null>(null);

  useEffect(() => { if (tTitle && !tSlug) setTSlug(transliterate(tTitle)); }, [tTitle, tSlug]);

  const resetTrainerForm = () => {
    setTTitle('');
    setTSlug('');
    setTCategory('');
    setTType('two_choice');
    setTMeta('{}');
    setEditingTrainerId(null);
  };

  

  const submitTrainer = async () => {
    const title = tTitle.trim();
    if (!title) return;
    const slugValue = (tSlug || transliterate(tTitle)).trim();
    const categorySlug = (tCategory || '').trim() || null;
    const typeValue = (tType || 'two_choice').trim();
    const normalizedType = typeValue === 'two_chois' ? 'two_choice' : typeValue;

    const metaInput = tMeta.trim();
    let meta: any = {};
    if (metaInput) {
      try {
        const parsed = JSON.parse(metaInput);
        if (parsed === null || typeof parsed !== 'object') {
          alert('Meta must be a JSON object or array');
          return;
        }
        meta = parsed; // <-- сохраняем результат парсинга (массив/объект)
      } catch {
        alert('Meta must be valid JSON');
        return;
      }
    }
    const payload = buildTrainerBody({
      title,
      slug: slugValue,
      categorySlug,
      type: normalizedType,
      meta,
    });

    const targetId = editingTrainerId;
    const url = targetId ? `/api/trainers/${encodeURIComponent(targetId)}` : '/api/trainers';
    const method = targetId ? 'PUT' : 'POST';
    const previousTrainer = targetId ? trainers.find((t) => t.id === targetId || t.slug === targetId) : null;

    const data = await jsonFetch<{ trainer: AnyObj }>(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const trainer = normTrainer(data.trainer);

    setTrainers((prev) => {
      const next = targetId
        ? prev.map((t) => (t.id === trainer.id ? trainer : t))
        : [...prev, trainer];
      return sortTrainers(next);
    });

    if (targetId) {
      setSelectedTrainerId((prev) => (prev === targetId ? trainer.id : prev));
      if (selectedTrainerId === targetId) {
        if (previousTrainer?.type !== trainer.type) {
          setItems([]);
        }
        loadItems(trainer.id).catch(() => {});
      }
    }

    resetTrainerForm();
  };

  const onDeleteTrainer = async (id: string) => {
    await jsonFetch(`/api/trainers/${id}`, { method: 'DELETE' });
    setSelectedTrainerId((prev) => (prev === id ? '' : prev));
    setTrainers((p) => sortTrainers(p.filter((t) => t.id !== id)));
    setItems([]);
    if (editingTrainerId === id) {
      resetTrainerForm();
    }
  };

  const onStartTrainerEdit = (trainer: Trainer) => {
    setEditingTrainerId(trainer.id);
    setTTitle(trainer.title ?? '');
    setTSlug(trainer.slug ?? '');
    setTCategory(trainer.categorySlug ?? '');
    setTType(trainer.type ?? 'two_choice');
    setTMeta(JSON.stringify(trainer.meta ?? {}, null, 2));
    setSelectedTrainerId(trainer.id);
    loadItems(trainer.id).catch(() => {});
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
    const data = await jsonFetch<{ items: AnyObj[] }>(`/api/trainers/${encodeURIComponent(idOrSlug)}/items`);
    const next = (data.items || []).map(normTrainerItem);
    setItems(sortTrainerItems(next));
  };
  useEffect(() => { if (selectedTrainerId) loadItems(selectedTrainerId).catch(()=>{}); }, [selectedTrainerId]);

  const onCreateItem = async () => {
    if (!selectedTrainer) return;

    const orderIndex = Number.isFinite(newOrder) ? newOrder : 0;

    if (selectedTrainer.type === 'two_choice') {
      const valid = newValid.trim();
      const invalid = newInvalid.trim();
      const data = await jsonFetch<{ item: AnyObj }>(`/api/trainers/${encodeURIComponent(selectedTrainer.id)}/items`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderIndex,
          payload: { valid, invalid },
          correctIsValid: newCorrect === 'valid',
        }),
      });
      const item = normTrainerItem(data.item);
      setItems((p) => sortTrainerItems([...p, item]));
      setNewValid('');
      setNewInvalid('');
      setNewCorrect('valid');
      setNewOrder(0);
      return;
    }

    // views
    const left = newLeft.trim();
    const right = newRight.trim();
    const correctValue = newCorrectText === 'left' ? left : right;
    const data = await jsonFetch<{ item: AnyObj }>(`/api/trainers/${encodeURIComponent(selectedTrainer.id)}/items`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        orderIndex,
        payload: { left, right },
        answer: correctValue,
      }),
    });
    const item = normTrainerItem(data.item);
    setItems((p) => sortTrainerItems([...p, item]));
    setNewLeft('');
    setNewRight('');
    setNewCorrectText('left');
    setNewOrder(0);
  };
  const onUpdateItem = async (it: TrainerItem) => {
    if (!selectedTrainer) return;

    const orderIndex = typeof it.order_index === 'number' ? it.order_index : 0;

    if (selectedTrainer.type === 'two_choice') {
      const rawValid = it.payload?.valid ?? '';
      const rawInvalid = it.payload?.invalid ?? '';
      const valid = typeof rawValid === 'string' ? rawValid.trim() : String(rawValid ?? '').trim();
      const invalid = typeof rawInvalid === 'string' ? rawInvalid.trim() : String(rawInvalid ?? '').trim();
      const body = { orderIndex, payload: { valid, invalid }, correctIsValid: it.answer === 'valid' };
      const data = await jsonFetch<{ item: AnyObj }>(`/api/trainer-items/${it.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const item = normTrainerItem(data.item);
      setItems((p) => sortTrainerItems(p.map((x) => (x.id === item.id ? item : x))));
      return;
    }

    // views
    const rawLeft = it.payload?.left ?? '';
    const rawRight = it.payload?.right ?? '';
    const left = typeof rawLeft === 'string' ? rawLeft.trim() : String(rawLeft ?? '').trim();
    const right = typeof rawRight === 'string' ? rawRight.trim() : String(rawRight ?? '').trim();
    const answer = typeof it.answer === 'string' ? it.answer : left;
    const body = { orderIndex, payload: { left, right }, answer };
    const data = await jsonFetch<{ item: AnyObj }>(`/api/trainer-items/${it.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const item = normTrainerItem(data.item);
    setItems((p) => sortTrainerItems(p.map((x) => (x.id === item.id ? item : x))));
  };
  const onDeleteItem = async (id: string) => {
    await jsonFetch(`/api/trainer-items/${id}`, { method: 'DELETE' });
    setItems((p) => p.filter(x => x.id !== id));
  };
  
  useEffect(() => {
  // каждый раз, когда выбираем тренажёр — показываем его текущий meta
  if (selectedTrainer) {
    setMetaEditor(JSON.stringify(selectedTrainer.meta ?? {}, null, 2));
  } else {
    setMetaEditor('{}');
  }
}, [selectedTrainer]);


  const onFormatMeta = () => {
  try {
    const v = JSON.parse(metaEditor);
    setMetaEditor(JSON.stringify(v, null, 2));
  } catch {
    alert('Невалидный JSON');
  }
};

const onResetMetaEditor = () => {
  if (!selectedTrainer) return;
  setMetaEditor(JSON.stringify(selectedTrainer.meta ?? {}, null, 2));
};

const onSaveMeta = async () => {
  if (!selectedTrainer) return;
  try {
    const parsed = JSON.parse(metaEditor);
    if (parsed === null || typeof parsed !== 'object') {
      alert('Meta должно быть JSON-объектом или массивом');
      return;
    }
    const data = await jsonFetch<{ trainer: AnyObj }>(
      `/api/trainers/${encodeURIComponent(selectedTrainer.id)}`,
      {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ meta: parsed }),
      }
    );
    const trainer = normTrainer(data.trainer);
    // обновим список тренажёров (и выбранный)
    setTrainers(prev => sortTrainers(prev.map(t => t.id === trainer.id ? trainer : t)));
  } catch (e: any) {
    alert(e?.message || 'Ошибка сохранения meta');
  }
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
        <button className={`${styles.Tab} ${tab==='users' ? styles.TabActive : ''}`} onClick={() => setTab('users')}>Пользователи</button>
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
            <h3>Параметры тренажёра</h3>
            <div className={styles.Row}>
              <input className={styles.Input} placeholder="Название" value={tTitle} onChange={(e)=>setTTitle(e.target.value)} />
              <input className={styles.Input} placeholder="Slug (если пусто - сгенерируется)" value={tSlug} onChange={(e)=>setTSlug(e.target.value)} />
              <select className={styles.Input} value={tCategory} onChange={(e)=>setTCategory(e.target.value)}>
                <option value="">Без категории (необязательно)</option>
                {categories.map((c) => (<option key={c.id} value={c.slug}>{c.name}</option>))}
              </select>
              <select className={styles.Input} value={tType} onChange={(e)=>setTType(e.target.value)}>
                <option value="two_choice">two_choice</option>
                <option value="views">views</option>
              </select>
            </div>
            <div className={styles.Row} style={{ alignItems: 'stretch' }}>
              <textarea
                className={styles.Input}
                placeholder="meta (JSON)"
                rows={3}
                style={{ flex: 1 }}
                value={tMeta}
                onChange={(e)=>setTMeta(e.target.value)}
              />
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <button className={styles.Button} onClick={() => submitTrainer().catch(err=>alert(err.message))}>
                  {editingTrainerId ? 'Save trainer' : 'Add trainer'}
                </button>
                {editingTrainerId && (
                  <button
                    className={`${styles.Button} ${styles.Secondary}`}
                    type="button"
                    onClick={(e) => { e.preventDefault(); resetTrainerForm(); }}
                  >
                    Cancel
                  </button>
                )}
              </div>
            </div>
          </div>

          <div className={styles.Card}>
            <h3>Добавить категорию</h3>
            <div className={styles.Row}>
              <input className={styles.Input} placeholder="Название" value={cName} onChange={(e)=>setCName(e.target.value)} />
              <input className={styles.Input} placeholder="Slug (если пусто - сгенерируется)" value={cSlug} onChange={(e)=>setCSlug(e.target.value)} />
              <select className={styles.Input} value={cParentId} onChange={(e)=>setCParentId(e.target.value)}>
                <option value="">Без категории (необязательно)</option>
                {categories.map((c) => (<option key={c.id} value={c.id}>{c.name}</option>))}
              </select>
              <input className={styles.Input} placeholder="Позиция" type="number" value={cPosition} onChange={(e)=>setCPosition(Number(e.target.value))} />
              <div style={{ display: 'flex', gap: 8 }}>
                <button className={styles.Button} onClick={() => submitCategory().catch(err=>alert(err.message))}>
                  {editingCategoryId ? 'Save category' : 'Add category'}
                </button>
                {editingCategoryId && (
                  <button
                    className={`${styles.Button} ${styles.Secondary}`}
                    type="button"
                    onClick={(e) => { e.preventDefault(); resetCategoryForm(); }}
                  >
                    Cancel
                  </button>
                )}
              </div>
            </div>
          </div>
          {selectedTrainer && (
            <div className={styles.Card}>
              <h4>Meta тренажёра</h4>
              <textarea
                className={styles.Input}
                rows={6}
                style={{ width: '100%' }}
                value={metaEditor}
                onChange={(e) => setMetaEditor(e.target.value)}
                placeholder="JSON (объект или массив)"
              />
              <div className={styles.Row} style={{ gap: 8 }}>
                <button className={styles.Button} onClick={onFormatMeta}>Форматировать</button>
                <button className={`${styles.Button} ${styles.Secondary}`} onClick={onResetMetaEditor}>Сбросить к текущей</button>
                <button className={styles.Button} onClick={onSaveMeta}>Сохранить meta</button>
              </div>
            </div>
          )}
          <div className={styles.Row} style={{ marginTop: 16 }}>
            <div style={{ flex: 1, minWidth: 320 }}>
              <h3>Список тренажёров</h3>
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
                    <div style={{ marginTop: 8, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      <button className={styles.Button} onClick={(e)=>{e.stopPropagation(); setSelectedTrainerId(t.id); loadItems(t.id).catch(()=>{});}}>Open</button>
                      <button className={styles.Button} onClick={(e)=>{e.stopPropagation(); onStartTrainerEdit(t);}}>Edit</button>
                      <button className={`${styles.Button} ${styles.Danger}`} onClick={(e)=>{e.stopPropagation(); onDeleteTrainer(t.id).catch(err=>alert(err.message));}}>Delete</button>
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
                      <option value="valid">Правильный ответ - верно</option>
                      <option value="invalid">Правильный ответ - неверно</option>
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
                      <option value="left">Правильный ответ - левый</option>
                      <option value="right">Правильный ответ - правый</option>
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
                            <option value="valid">Правильный ответ - верно</option>
                            <option value="invalid">Правильный ответ - неверно</option>
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
                          <option value="left">Правильный ответ - левый</option>
                          <option value="right">Правильный ответ - правый</option>
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

              {!selectedTrainerId && <div style={{ opacity: 0.7, marginTop: 8 }}>Выберите тренажёр слева, чтобы редактировать задания.</div>}
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
                <div style={{ marginTop: 8, display: 'flex', gap: 8 }}>
                  <button className={styles.Button} onClick={()=>onStartCategoryEdit(c)}>Edit</button>
                  <button className={`${styles.Button} ${styles.Danger}`} onClick={()=>onDeleteCategory(c.id).catch(err=>alert(err.message))}>Delete</button>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
};
