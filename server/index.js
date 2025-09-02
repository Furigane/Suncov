const express = require('express');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const cookieParser = require('cookie-parser');
const crypto = require('crypto');
const { read, write } = require('./db');
const { query, getPool } = require('./pg');
const { getSupabase } = require('./supabase');
const bcrypt = require('bcryptjs');

const app = express();
const PORT = process.env.PORT || 4000;

app.use(express.json());
app.use(cookieParser(process.env.COOKIE_SECRET || 'dev-secret'));

// Very simple session via signed cookie storing userId
function setSession(res, userId) {
  res.cookie('sid', userId, { httpOnly: true, sameSite: 'lax', signed: true });
}
function clearSession(res) {
  res.clearCookie('sid');
}
function authMiddleware(req, _res, next) {
  const sid = req.signedCookies && req.signedCookies.sid;
  req.user = null;
  if (sid) {
    const users = read('users');
    const u = users.find((x) => x.id === sid);
    if (u) req.user = u;
  }
  next();
}
app.use(authMiddleware);

const TRAINER_TYPES = new Set(['two_choice', 'views']); // расширишь при необходимости
const sanitizeTrainerType = (t) => (TRAINER_TYPES.has(String(t))) ? String(t) : 'two_choice';

// Helpers
const uid = () => crypto.randomUUID();
const now = () => new Date().toISOString();

// Bootstrap admin if no users exist (file-mode only)
function ensureAdminFS() {
  const users = read('users');
  if (users.length === 0) {
    const admin = {
      id: uid(),
      firstName: 'Admin',
      lastName: 'User',
      username: 'admin',
      password: 'admin',
      role: 'admin',
      createdAt: now(),
    };
    write('users', [admin]);
    console.log('[server] Admin bootstrapped (fs): admin/admin');
  }
}
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

async function resolveTrainerId(idOrSlug) {
  // уже UUID — возвращаем как есть
  if (UUID_RE.test(String(idOrSlug))) return String(idOrSlug);

  // иначе считаем, что это slug и ищем id
  const sb = getSupabase();
  const { data, error } = await sb
    .from('trainers')
    .select('id')
    .eq('slug', String(idOrSlug))
    .maybeSingle();

  if (error) throw new Error(`resolveTrainerId error: ${error.message}`);
  if (!data) throw new Error(`trainer not found by slug: ${idOrSlug}`);
  return data.id;
}
const USE_SB = !!(
  (process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL) &&
  (process.env.SUPABASE_SERVICE_ROLE || process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY)
);
const USE_PG = !!process.env.DATABASE_URL && !USE_SB; // приоритет supabase-js
if (!USE_PG && !USE_SB) ensureAdminFS();

// Auth routes
app.post('/api/auth/login', async (req, res) => {
  const { username, password } = req.body || {};
  try {
    if (USE_SB) {
      const sb = getSupabase();
      const { data, error } = await sb
        .from('users')
        .select('id, first_name, last_name, username, role, password_hash')
        .eq('username', String(username || '').trim())
        .limit(1)
        .maybeSingle();
      if (error) return res.status(500).json({ error: 'auth error' });
      if (!data) return res.status(401).json({ error: 'Неверный логин или пароль' });
      const ok = await bcrypt.compare(String(password || ''), data.password_hash || '');
      if (!ok) return res.status(401).json({ error: 'Неверный логин или пароль' });
      const { password_hash, ...safe } = data;
      setSession(res, safe.id);
      return res.json({ user: safe });
    }
    if (USE_PG) {
      const rows = await query(
        `SELECT id, first_name, last_name, username, role
         FROM public.users
         WHERE username = $1 AND password_hash = crypt($2, password_hash)
         LIMIT 1`,
        [String(username || '').trim(), String(password || '')],
      );
      const user = rows[0];
      if (!user) return res.status(401).json({ error: 'Неверный логин или пароль' });
      setSession(res, user.id);
      return res.json({ user });
    }
    const users = read('users');
    const user = users.find((u) => u.username === String(username || '').trim());
    if (!user || user.password !== String(password || '')) {
      return res.status(401).json({ error: 'Неверный логин или пароль' });
    }
    setSession(res, user.id);
    const { password: _pw, ...safe } = user;
    res.json({ user: safe });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'auth error' });
  }
});

app.post('/api/auth/logout', (req, res) => {
  clearSession(res);
  res.json({ ok: true });
});

app.get('/api/auth/me', (req, res) => {
  if (!req.user) return res.json({ user: null });
  const { password: _pw, ...safe } = req.user;
  res.json({ user: safe });
});

// Users (admin only for write)
app.get('/api/users', async (req, res) => {
  try {
    if (USE_SB) {
      const sb = getSupabase();
      const { data, error } = await sb
        .from('users')
        .select('id, first_name, last_name, username, role, created_at')
        .order('created_at', { ascending: true });
      if (error) return res.status(500).json({ error: 'users list error' });
      return res.json({ users: data || [] });
    }
    if (USE_PG) {
      const users = await query(
        `SELECT id, first_name, last_name, username, role, created_at
         FROM public.users
         ORDER BY created_at ASC`,
      );
      return res.json({ users });
    }
    const users = read('users').map(({ password, ...rest }) => rest);
    res.json({ users });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'users list error' });
  }
});

app.post('/api/users', async (req, res) => {
  const { firstName, lastName, username, password, role } = req.body || {};
  try {
    if (USE_SB) {
      const sb = getSupabase();
      const { data: exists } = await sb.from('users').select('id').eq('username', username).limit(1);
      if (exists && exists.length) return res.status(400).json({ error: 'username уже существует' });
      const hash = await bcrypt.hash(String(password || ''), 10);
      const { data, error } = await sb
        .from('users')
        .insert({
          first_name: String(firstName || ''),
          last_name: String(lastName || ''),
          username: String(username || ''),
          password_hash: hash,
          role: role === 'admin' ? 'admin' : 'user',
        })
        .select('id, first_name, last_name, username, role, created_at')
        .single();
      if (error) return res.status(400).json({ error: error.message || 'user create error' });
      return res.json({ user: data });
    }
    if (USE_PG) {
      const exists = await query(`SELECT 1 FROM public.users WHERE username=$1`, [username]);
      if (exists.length) return res.status(400).json({ error: 'username уже существует' });
      const rows = await query(
        `INSERT INTO public.users (first_name,last_name,username,password_hash,role)
         VALUES ($1,$2,$3, crypt($4, gen_salt('bf')), $5)
         RETURNING id, first_name, last_name, username, role, created_at`,
        [String(firstName||''), String(lastName||''), String(username||''), String(password||''), role==='admin'?'admin':'user'],
      );
      return res.json({ user: rows[0] });
    }
    const users = read('users');
    if (users.some((u) => u.username === username)) {
      return res.status(400).json({ error: 'username уже существует' });
    }
    const user = {
      id: uid(),
      firstName: String(firstName || ''),
      lastName: String(lastName || ''),
      username: String(username || ''),
      password: String(password || ''),
      role: role === 'admin' ? 'admin' : 'user',
      createdAt: now(),
    };
    users.push(user);
    write('users', users);
    const { password: _pw, ...safe } = user;
    res.json({ user: safe });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'user create error' });
  }
});

app.put('/api/users/:id', (req, res) => {
  const { id } = req.params;
  const users = read('users');
  const idx = users.findIndex((u) => u.id === id);
  if (idx === -1) return res.status(404).json({ error: 'not found' });
  const prev = users[idx];
  const next = { ...prev, ...req.body };
  users[idx] = next;
  write('users', users);
  const { password: _pw, ...safe } = next;
  res.json({ user: safe });
});

app.delete('/api/users/:id', async (req, res) => {
  const { id } = req.params;
  try {
    if (USE_SB) {
      const sb = getSupabase();
      const { error } = await sb.from('users').delete().eq('id', id);
      if (error) return res.status(400).json({ error: 'user delete error' });
      return res.json({ ok: true });
    }
    if (USE_PG) {
      await query(`DELETE FROM public.users WHERE id=$1`, [id]);
      return res.json({ ok: true });
    }
    const users = read('users');
    const filtered = users.filter((u) => u.id !== id);
    write('users', filtered);
    res.json({ ok: true });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'user delete error' });
  }
});

// Categories
app.get('/api/categories', async (_req, res) => {
  try {
    if (USE_SB) {
      const sb = getSupabase();
      const { data, error } = await sb
        .from('categories')
        .select('id,name,slug,parent_id,position')
        .order('position', { ascending: true });
      if (error) return res.status(500).json({ error: 'categories list error' });
      return res.json({ categories: data || [] });
    }
    const cats = read('categories');
    res.json({ categories: cats });
  } catch (e) { res.status(500).json({ error: 'categories list error' }); }
});
app.post('/api/categories', async (req, res) => {
  const { name, slug, parentId, position } = req.body || {};
  try {
    if (USE_SB) {
      const sb = getSupabase();
      const { data, error } = await sb
        .from('categories')
        .insert({ name, slug, parent_id: parentId || null, position: position || 0 })
        .select('id,name,slug,parent_id,position')
        .single();
      if (error) {
        console.error('[SB] category insert error:', error);
        return res.status(400).json({
          error: 'category create error',
          details: error.message,
          code: error.code,
          hint: error.hint
        });
      }
      return res.json({ category: data });
    }
    const cats = read('categories');
    const cat = { id: uid(), name, slug, parentId: parentId || null, position: position || 0 };
    cats.push(cat);
    write('categories', cats);
    res.json({ category: cat });
  } catch (e) { res.status(500).json({ error: 'category create error' }); }
});
app.put('/api/categories/:id', async (req, res) => {
  const { id } = req.params;
  try {
    if (USE_SB) {
      const sb = getSupabase();
      const patch = {
        name: req.body?.name,
        slug: req.body?.slug,
        parent_id: req.body?.parentId ?? null,
        position: req.body?.position,
      };
      const { data, error } = await sb
        .from('categories')
        .update(patch)
        .eq('id', id)
        .select('id,name,slug,parent_id,position')
        .single();
      if (error) return res.status(400).json({ error: 'category update error' });
      return res.json({ category: data });
    }
    const cats = read('categories');
    const idx = cats.findIndex((c) => c.id === id);
    if (idx === -1) return res.status(404).json({ error: 'not found' });
    cats[idx] = { ...cats[idx], ...req.body };
    write('categories', cats);
    res.json({ category: cats[idx] });
  } catch (e) { res.status(500).json({ error: 'category update error' }); }
});
app.delete('/api/categories/:id', async (req, res) => {
  const { id } = req.params;
  try {
    if (USE_SB) {
      const sb = getSupabase();
      const { error } = await sb.from('categories').delete().eq('id', id);
      if (error) return res.status(400).json({ error: 'category delete error' });
      return res.json({ ok: true });
    }
    const cats = read('categories').filter((c) => c.id !== id);
    write('categories', cats);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: 'category delete error' }); }
});

// Trainers
app.get('/api/trainers', async (req, res) => {
  const { categorySlug, slug } = req.query || {};
  try {
    if (USE_SB) {
      const sb = getSupabase();
      if (slug) {
        const { data, error } = await sb
          .from('trainers')
          .select('id,title,slug,category_slug,type,meta,created_at')
          .eq('slug', String(slug))
          .maybeSingle();
        if (error) return res.status(500).json({ error: 'trainer fetch error' });
        return res.json({ trainer: data || null });
      }
      let querySb = sb
        .from('trainers')
        .select('id,title,slug,category_slug,type,meta,created_at')
        .order('created_at', { ascending: true });
      if (categorySlug) querySb = querySb.eq('category_slug', String(categorySlug));
      const { data, error } = await querySb;
      if (error) return res.status(500).json({ error: 'trainers list error' });
      return res.json({ trainers: data || [] });
    }
    const trainers = read('trainers');
    if (slug) return res.json({ trainer: trainers.find((t) => t.slug === slug) || null });
    if (categorySlug) return res.json({ trainers: trainers.filter((t) => t.categorySlug === categorySlug) });
    res.json({ trainers });
  } catch (e) { res.status(500).json({ error: 'trainers list error' }); }
});
app.post('/api/trainers', async (req, res) => {
  let { title, slug, categorySlug, type, meta } = req.body || {};
  try {
    // --- Жёсткая валидация типа + автопочинка частых опечаток
    const allowedTypes = ['two_choice', 'views'];
    if (type === 'two_chois') type = 'two_choice';
    if (!allowedTypes.includes(type)) {
      return res.status(400).json({
        error: 'trainer create error',
        details: `type must be one of: ${allowedTypes.join(', ')}, got "${type}"`
      });
    }

    if (USE_SB) {
      const sb = getSupabase();
      const { data, error } = await sb
        .from('trainers')
        .insert({ title, slug, category_slug: categorySlug || null, type, meta: meta || {} })
        .select('id,title,slug,category_slug,type,meta,created_at')
        .single();
      if (error) {
        console.error('[SB] trainer insert error:', error);
        return res.status(400).json({
          error: 'trainer create error',
          details: error.message,
          code: error.code,
          hint: error.hint
        });
      }
      return res.json({ trainer: data });
    }

    const trainers = read('trainers');
    const trainer = { id: uid(), title, slug, categorySlug: categorySlug || null, type, meta: meta || {}, createdAt: now() };
    trainers.push(trainer);
    write('trainers', trainers);
    res.json({ trainer });
  } catch (e) { res.status(500).json({ error: 'trainer create error' }); }
});
app.put('/api/trainers/:id', async (req, res) => {
  const { id } = req.params;
  try {
    if (USE_SB) {
      const sb = getSupabase();
      const patch = {
        title: req.body?.title,
        slug: req.body?.slug,
        category_slug: req.body?.categorySlug ?? null,
        ...(req.body?.type !== undefined ? { type: sanitizeTrainerType(req.body.type) } : {}),
        meta: req.body?.meta ?? {},
      };
      const { data, error } = await sb
        .from('trainers')
        .update(patch)
        .eq('id', id)
        .select('id,title,slug,category_slug,type,meta,created_at')
        .single();
      if (error) return res.status(400).json({ error: 'trainer update error' });
      return res.json({ trainer: data });
    }
    const trainers = read('trainers');
    const idx = trainers.findIndex((t) => t.id === id);
    if (idx === -1) return res.status(404).json({ error: 'not found' });
    trainers[idx] = { ...trainers[idx], ...req.body };
    write('trainers', trainers);
    res.json({ trainer: trainers[idx] });
  } catch (e) { res.status(500).json({ error: 'trainer update error' }); }
});
app.delete('/api/trainers/:id', async (req, res) => {
  const { id } = req.params;
  try {
    if (USE_SB) {
      const sb = getSupabase();
      const { error } = await sb.from('trainers').delete().eq('id', id);
      if (error) return res.status(400).json({ error: 'trainer delete error' });
      return res.json({ ok: true });
    }
    const trainers = read('trainers').filter((t) => t.id !== id);
    write('trainers', trainers);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: 'trainer delete error' }); }
});
app.post('/api/trainers/import-choices', async (req, res) => {
  const { category, sections } = req.body || {};
  if (!sections || typeof sections !== 'object') {
    return res.status(400).json({ error: 'sections is required' });
  }
  const catName = category?.name || 'General';
  const catSlug = (category?.slug || 'general').toLowerCase();

  try {
    if (USE_SB) {
      const sb = getSupabase();

      // 1) ensure category
      let categoryId = null;
      {
        const { data: existing } = await sb.from('categories').select('id,slug').eq('slug', catSlug).maybeSingle();
        if (existing) {
          categoryId = existing.id;
          // (опционально) обновим тип/флаг
          await sb.from('categories').update({
            type: category?.type ?? existing.type,
            in_header: category?.inHeader ?? existing.in_header
          }).eq('id', categoryId);
        } else {
          const { data: created, error: catErr } = await sb
            .from('categories')
            .insert({
              name: catName,
              slug: catSlug,
              type: category?.type || null,
              in_header: !!category?.inHeader
            })
            .select('id')
            .single();
          if (catErr) return res.status(400).json({ error: 'category create error' });
          categoryId = created.id;
        }
      }

      const trainersCreated = [];
      for (const [sectionTitle, cfg] of Object.entries(sections)) {
        const trainerSlug = sectionTitle
          .toLowerCase()
          .replace(/\s+/g, '-')
          .replace(/[^a-zа-я0-9\-]/gi, '');

        // 2) create trainer
        const { data: trainer, error: trErr } = await sb
          .from('trainers')
          .upsert({
            title: sectionTitle,
            slug: trainerSlug,
            category_slug: catSlug,
            type: sanitizeTrainerType(cfg?.type || 'two_choice'),
            meta: { inHeader: !!cfg?.inHeader }
          }, { onConflict: 'slug' })
          .select('id, title, slug, category_slug')
          .single();
        if (trErr) return res.status(400).json({ error: `trainer upsert error: ${sectionTitle}` });

        // 3) insert items
        const rows = (cfg.items || []).map((it, idx) => ({
          trainer_id: trainer.id,
          order_index: it?.id ?? idx,
          variant_valid: it?.valid ?? null,
          variant_invalid: it?.invalid ?? null,
          correct_is_valid: true,
          extra: {}
        }));
        if (rows.length) {
          const { error: itemsErr } = await sb.from('trainer_items').insert(rows);
          if (itemsErr) return res.status(400).json({ error: `items insert error: ${sectionTitle}` });
        }

        trainersCreated.push({ id: trainer.id, title: trainer.title, slug: trainer.slug });
      }

      return res.json({ ok: true, category: { name: catName, slug: catSlug }, trainers: trainersCreated });
    }

    // FS fallback:
    const cats = read('categories');
    const trainers = read('trainers');
    const items = read('trainer_items');

    let cat = cats.find(c => c.slug === catSlug);
    if (!cat) {
      cat = { id: uid(), name: catName, slug: catSlug, type: category?.type || null, inHeader: !!category?.inHeader, position: 0 };
      cats.push(cat);
      write('categories', cats);
    }

    const trainersCreated = [];
    for (const [sectionTitle, cfg] of Object.entries(sections)) {
      const trainerSlug = sectionTitle.toLowerCase().replace(/\s+/g, '-').replace(/[^a-zа-я0-9\-]/gi, '');
      let tr = trainers.find(t => t.slug === trainerSlug);
      if (!tr) {
        tr = {
          id: uid(),
          title: sectionTitle,
          slug: trainerSlug,
          categorySlug: cat.slug,
          type: sanitizeTrainerType(cfg?.type || 'two_choice'),
          meta: { inHeader: !!cfg?.inHeader },
          createdAt: now()
        };
        trainers.push(tr);
      }
      const rows = (cfg.items || []).map((it, idx) => ({
        id: uid(),
        trainerId: tr.id,
        orderIndex: it?.id ?? idx,
        variant_valid: it?.valid ?? null,
        variant_invalid: it?.invalid ?? null,
        correct_is_valid: true,
        extra: {}
      }));
      items.push(...rows);
      trainersCreated.push({ id: tr.id, title: tr.title, slug: tr.slug });
    }
    write('trainers', trainers);
    write('trainer_items', items);
    return res.json({ ok: true, category: { name: catName, slug: catSlug }, trainers: trainersCreated });

  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: 'import error' });
  }
});
// Trainer items
app.get('/api/trainers/:trainerId/items', async (req, res) => {
  try {
    if (USE_SB) {
      const sb = getSupabase();
      const trainerId = await resolveTrainerId(req.params.trainerId); // <-- новинка

      // 1) пробуем через VIEW
      const { data, error } = await sb
        .from('trainer_items_view')
        .select('id,trainer_id,order_index,payload,answer,created_at')
        .eq('trainer_id', trainerId)
        .order('order_index', { ascending: true });

      if (!error) return res.json({ items: data || [] });

      console.error('[SB] trainer_items_view error:', error);

      // 2) фоллбэк на таблицу
      const base = await sb
        .from('trainer_items')
        .select('id,trainer_id,order_index,variant_valid,variant_invalid,correct_is_valid,answer,payload,created_at')
        .eq('trainer_id', trainerId)
        .order('order_index', { ascending: true });

      if (base.error) {
        console.error('[SB] trainer_items fallback error:', base.error);
        return res.status(500).json({ error: 'items list error', details: base.error.message });
      }

      const items = (base.data || []).map(row => ({
        id: row.id,
        trainer_id: row.trainer_id,
        order_index: row.order_index,
        payload: (row.variant_valid || row.variant_invalid)
          ? { valid: row.variant_valid, invalid: row.variant_invalid }
          : (row.payload || {}),
        answer:
          (row.correct_is_valid === true)  ? 'valid'   :
          (row.correct_is_valid === false) ? 'invalid' :
          (row.answer != null ? String(row.answer) : null),
        created_at: row.created_at
      }));
      return res.json({ items });
    }

    // FS fallback
    const itemsFS = read('trainer_items')
      .filter((i) => i.trainerId === req.params.trainerId)
      .map((i) => ({
        ...i,
        payload: i.payload ?? { valid: i.variant_valid, invalid: i.variant_invalid },
        answer: i.correct_is_valid ? 'valid' : 'invalid'
      }));
    res.json({ items: itemsFS });
  } catch (e) {
    console.error('[API] items list error:', e);
    res.status(500).json({ error: 'items list error', details: e.message });
  }
});

app.post('/api/trainers/:trainerId/items', async (req, res) => {
  try {
    if (USE_SB) {
      const sb = getSupabase();
      const trainerId = await resolveTrainerId(req.params.trainerId);

      // Узнаём тип тренажёра
      const { data: tr } = await sb.from('trainers').select('id,type').eq('id', trainerId).maybeSingle();
      if (!tr) return res.status(404).json({ error: 'trainer not found' });

      const { orderIndex = 0 } = req.body || {};

      if (tr.type === 'two_choice') {
        const { valid, invalid, correctIsValid = true, extra = {} } = req.body || {};
        const { data, error } = await sb
          .from('trainer_items')
          .insert({
            trainer_id: trainerId,
            order_index: orderIndex,
            variant_valid: valid ?? null,
            variant_invalid: invalid ?? null,
            correct_is_valid: !!correctIsValid,
            extra
          })
          .select('id,trainer_id,order_index,variant_valid,variant_invalid,correct_is_valid,extra,created_at')
          .single();
        if (error) return res.status(400).json({ error: 'item create error', details: error.message });

        return res.json({
          item: {
            ...data,
            payload: { valid: data.variant_valid, invalid: data.variant_invalid },
            answer: data.correct_is_valid ? 'valid' : 'invalid'
          }
        });
      }

      // type === 'views' => принимаем {left,right, correct}
      const { left, right, correct } = req.body || {};
      if (!left || !right || !correct) {
        return res.status(400).json({ error: 'item create error', details: 'left, right and correct are required for "views"' });
      }
      const { data, error } = await sb
        .from('trainer_items')
        .insert({
          trainer_id: trainerId,
          order_index: orderIndex,
          payload: { left, right },
          answer: String(correct)
        })
        .select('id,trainer_id,order_index,payload,answer,created_at')
        .single();
      if (error) return res.status(400).json({ error: 'item create error', details: error.message });

      return res.json({ item: data });
    }

    // FS режим
    const trainerId = req.params.trainerId;
    const { orderIndex = 0 } = req.body || {};
    const items = read('trainer_items');

    if (req.body && ('left' in req.body || 'right' in req.body)) {
      const { left, right, correct } = req.body;
      const item = { id: uid(), trainerId, orderIndex, payload: { left, right }, answer: String(correct) };
      items.push(item);
      write('trainer_items', items);
      return res.json({ item });
    }

    const { valid, invalid, correctIsValid = true, extra = {} } = req.body || {};
    const item = {
      id: uid(), trainerId, orderIndex,
      variant_valid: valid ?? null, variant_invalid: invalid ?? null,
      correct_is_valid: !!correctIsValid, extra
    };
    items.push(item);
    write('trainer_items', items);
    res.json({ item: { ...item, payload: { valid: item.variant_valid, invalid: item.variant_invalid }, answer: item.correct_is_valid ? 'valid' : 'invalid' } });
  } catch (e) {
    console.error('[API] item create error:', e);
    res.status(500).json({ error: 'item create error', details: e.message });
  }
});
app.put('/api/trainer-items/:id', async (req, res) => {
  try {
    if (USE_SB) {
      const sb = getSupabase();

      // Если пришли payload/answer — это режим "views"
      if (req.body && (req.body.payload || typeof req.body.answer !== 'undefined')) {
        const patch = {
          order_index: req.body?.orderIndex,
          payload: req.body?.payload,
          answer: req.body?.answer
        };
        const { data, error } = await sb
          .from('trainer_items')
          .update(patch)
          .eq('id', req.params.id)
          .select('id,trainer_id,order_index,payload,answer,created_at')
          .single();
        if (error) return res.status(400).json({ error: 'item update error', details: error.message });
        return res.json({ item: data });
      }

      // two_choice
      const patch = {
        order_index: req.body?.orderIndex,
        variant_valid: req.body?.valid,
        variant_invalid: req.body?.invalid,
        correct_is_valid: req.body?.correctIsValid,
        extra: req.body?.extra
      };
      const { data, error } = await sb
        .from('trainer_items')
        .update(patch)
        .eq('id', req.params.id)
        .select('id,trainer_id,order_index,variant_valid,variant_invalid,correct_is_valid,extra,created_at')
        .single();
      if (error) return res.status(400).json({ error: 'item update error' });
      const item = {
        ...data,
        payload: { valid: data.variant_valid, invalid: data.variant_invalid },
        answer: data.correct_is_valid ? 'valid' : 'invalid'
      };
      return res.json({ item });
    }

    // FS
    const items = read('trainer_items');
    const idx = items.findIndex((i) => i.id === req.params.id);
    if (idx === -1) return res.status(404).json({ error: 'not found' });

    if (req.body && (req.body.payload || typeof req.body.answer !== 'undefined')) {
      items[idx] = { ...items[idx], orderIndex: req.body?.orderIndex ?? items[idx].orderIndex, payload: req.body?.payload ?? items[idx].payload, answer: req.body?.answer ?? items[idx].answer };
      write('trainer_items', items);
      return res.json({ item: items[idx] });
    }

    const prev = items[idx];
    const next = {
      ...prev,
      orderIndex: req.body?.orderIndex ?? prev.orderIndex,
      variant_valid: req.body?.valid ?? prev.variant_valid,
      variant_invalid: req.body?.invalid ?? prev.variant_invalid,
      correct_is_valid: req.body?.correctIsValid ?? prev.correct_is_valid,
      extra: req.body?.extra ?? prev.extra
    };
    items[idx] = next;
    write('trainer_items', items);
    const compat = { ...next, payload: { valid: next.variant_valid, invalid: next.variant_invalid }, answer: next.correct_is_valid ? 'valid' : 'invalid' };
    res.json({ item: compat });
  } catch (e) { console.error(e); res.status(500).json({ error: 'item update error' }); }
});
app.delete('/api/trainer-items/:id', async (req, res) => {
  try {
    if (USE_SB) {
      const sb = getSupabase();
      const { error } = await sb.from('trainer_items').delete().eq('id', req.params.id);
      if (error) return res.status(400).json({ error: 'item delete error' });
      return res.json({ ok: true });
    }
    const items = read('trainer_items').filter((i) => i.id !== req.params.id);
    write('trainer_items', items);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: 'item delete error' }); }
});

// Materials (dictants/tests/pos)
app.get('/api/materials', async (req, res) => {
  const { type, slug } = req.query || {};
  try {
    if (USE_SB) {
      const sb = getSupabase();
      if (slug) {
        const { data, error } = await sb
          .from('materials')
          .select('id,type,title,slug,category_slug,content,created_at')
          .eq('slug', String(slug))
          .maybeSingle();
        if (error) return res.status(500).json({ error: 'material fetch error' });
        return res.json({ material: data || null });
      }
      let q = sb.from('materials').select('id,type,title,slug,category_slug,content,created_at');
      if (type) q = q.eq('type', String(type));
      const { data, error } = await q;
      if (error) return res.status(500).json({ error: 'materials list error' });
      return res.json({ materials: data || [] });
    }
    const materials = read('materials');
    if (slug) return res.json({ material: materials.find((m) => m.slug === slug) || null });
    if (type) return res.json({ materials: materials.filter((m) => m.type === type) });
    res.json({ materials });
  } catch (e) { res.status(500).json({ error: 'materials list error' }); }
});
app.post('/api/materials', async (req, res) => {
  const { type, title, slug, categorySlug, content } = req.body || {};
  try {
    if (USE_SB) {
      const sb = getSupabase();
      const { data, error } = await sb
        .from('materials')
        .insert({ type, title, slug, category_slug: categorySlug || null, content: content || {} })
        .select('id,type,title,slug,category_slug,content,created_at')
        .single();
      if (error) return res.status(400).json({ error: 'material create error' });
      return res.json({ material: data });
    }
    const materials = read('materials');
    const material = { id: uid(), type, title, slug, categorySlug: categorySlug || null, content: content || {}, createdAt: now() };
    materials.push(material);
    write('materials', materials);
    res.json({ material });
  } catch (e) { res.status(500).json({ error: 'material create error' }); }
});
app.put('/api/materials/:id', async (req, res) => {
  const { id } = req.params;
  try {
    if (USE_SB) {
      const sb = getSupabase();
      const patch = {
        type: req.body?.type,
        title: req.body?.title,
        slug: req.body?.slug,
        category_slug: req.body?.categorySlug ?? null,
        content: req.body?.content ?? {},
      };
      const { data, error } = await sb
        .from('materials')
        .update(patch)
        .eq('id', id)
        .select('id,type,title,slug,category_slug,content,created_at')
        .single();
      if (error) return res.status(400).json({ error: 'material update error' });
      return res.json({ material: data });
    }
    const materials = read('materials');
    const idx = materials.findIndex((m) => m.id === id);
    if (idx === -1) return res.status(404).json({ error: 'not found' });
    materials[idx] = { ...materials[idx], ...req.body };
    write('materials', materials);
    res.json({ material: materials[idx] });
  } catch (e) { res.status(500).json({ error: 'material update error' }); }
});
app.delete('/api/materials/:id', async (req, res) => {
  const { id } = req.params;
  try {
    if (USE_SB) {
      const sb = getSupabase();
      const { error } = await sb.from('materials').delete().eq('id', id);
      if (error) return res.status(400).json({ error: 'material delete error' });
      return res.json({ ok: true });
    }
    const materials = read('materials').filter((m) => m.id !== id);
    write('materials', materials);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: 'material delete error' }); }
});

// In production, serve frontend
if (process.env.NODE_ENV === 'production') {
  const buildPath = path.join(__dirname, '..', 'build');
  app.use(express.static(buildPath));
  app.get('*', (req, res) => {
    res.sendFile(path.join(buildPath, 'index.html'));
  });
}

app.listen(PORT, () => console.log(`[server] listening on :${PORT} (mode=${USE_PG ? 'pg' : (USE_SB ? 'sb' : 'fs')})`));
// Simple healthcheck
app.get('/health', (_req, res) => res.json({ ok: true, mode: USE_PG ? 'pg' : (USE_SB ? 'sb' : 'fs') }));
// Env presence (debug)
app.get('/health/env', (_req, res) => res.json({
  sbUrlPresent: !!(process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL),
  sbKeyPresent: !!(process.env.SUPABASE_SERVICE_ROLE || process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY),
  dbUrlPresent: !!process.env.DATABASE_URL,
  mode: USE_PG ? 'pg' : (USE_SB ? 'sb' : 'fs')
}));
