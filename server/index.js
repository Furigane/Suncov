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

const USE_SB = !!(
  (process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL) &&
  (process.env.SUPABASE_SERVICE_ROLE ||
    process.env.SUPABASE_SERVICE_KEY ||
    process.env.SUPABASE_SERVICE_ROLE_KEY)
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
      if (!data)
        return res.status(401).json({ error: 'Неверный логин или пароль' });
      const ok = await bcrypt.compare(
        String(password || ''),
        data.password_hash || '',
      );
      if (!ok)
        return res.status(401).json({ error: 'Неверный логин или пароль' });
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
      if (!user)
        return res.status(401).json({ error: 'Неверный логин или пароль' });
      setSession(res, user.id);
      return res.json({ user });
    }
    const users = read('users');
    const user = users.find(
      (u) => u.username === String(username || '').trim(),
    );
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
      const { data: exists } = await sb
        .from('users')
        .select('id')
        .eq('username', username)
        .limit(1);
      if (exists && exists.length)
        return res.status(400).json({ error: 'username уже существует' });
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
      if (error)
        return res
          .status(400)
          .json({ error: error.message || 'user create error' });
      return res.json({ user: data });
    }
    if (USE_PG) {
      const exists = await query(
        `SELECT 1 FROM public.users WHERE username=$1`,
        [username],
      );
      if (exists.length)
        return res.status(400).json({ error: 'username уже существует' });
      const rows = await query(
        `INSERT INTO public.users (first_name,last_name,username,password_hash,role)
         VALUES ($1,$2,$3, crypt($4, gen_salt('bf')), $5)
         RETURNING id, first_name, last_name, username, role, created_at`,
        [
          String(firstName || ''),
          String(lastName || ''),
          String(username || ''),
          String(password || ''),
          role === 'admin' ? 'admin' : 'user',
        ],
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
        .select('id,name,slug,parent_id,position,created_at')
        .order('position', { ascending: true });
      if (error)
        return res.status(500).json({ error: 'categories list error' });
      return res.json({ categories: data || [] });
    }
    const cats = read('categories');
    res.json({ categories: cats });
  } catch (e) {
    res.status(500).json({ error: 'categories list error' });
  }
});
app.post('/api/categories', async (req, res) => {
  const { name, slug, parentId, position } = req.body || {};
  try {
    if (USE_SB) {
      const sb = getSupabase();
      const { data, error } = await sb
        .from('categories')
        .insert({
          name,
          slug,
          parent_id: parentId || null,
          position: position || 0,
        })
        .select('id,name,slug,parent_id,position,created_at')
        .single();
      if (error)
        return res.status(400).json({ error: 'category create error' });
      return res.json({ category: data });
    }
    const cats = read('categories');
    const cat = {
      id: uid(),
      name,
      slug,
      parentId: parentId || null,
      position: position || 0,
    };
    cats.push(cat);
    write('categories', cats);
    res.json({ category: cat });
  } catch (e) {
    res.status(500).json({ error: 'category create error' });
  }
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
        .select('id,name,slug,parent_id,position,created_at')
        .single();
      if (error)
        return res.status(400).json({ error: 'category update error' });
      return res.json({ category: data });
    }
    const cats = read('categories');
    const idx = cats.findIndex((c) => c.id === id);
    if (idx === -1) return res.status(404).json({ error: 'not found' });
    cats[idx] = { ...cats[idx], ...req.body };
    write('categories', cats);
    res.json({ category: cats[idx] });
  } catch (e) {
    res.status(500).json({ error: 'category update error' });
  }
});
app.delete('/api/categories/:id', async (req, res) => {
  const { id } = req.params;
  try {
    if (USE_SB) {
      const sb = getSupabase();
      const { error } = await sb.from('categories').delete().eq('id', id);
      if (error)
        return res.status(400).json({ error: 'category delete error' });
      return res.json({ ok: true });
    }
    const cats = read('categories').filter((c) => c.id !== id);
    write('categories', cats);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: 'category delete error' });
  }
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
        if (error)
          return res.status(500).json({ error: 'trainer fetch error' });
        return res.json({ trainer: data || null });
      }
      let querySb = sb
        .from('trainers')
        .select('id,title,slug,category_slug,type,meta,created_at')
        .order('created_at', { ascending: true });
      if (categorySlug)
        querySb = querySb.eq('category_slug', String(categorySlug));
      const { data, error } = await querySb;
      if (error) return res.status(500).json({ error: 'trainers list error' });
      return res.json({ trainers: data || [] });
    }
    const trainers = read('trainers');
    if (slug)
      return res.json({
        trainer: trainers.find((t) => t.slug === slug) || null,
      });
    if (categorySlug)
      return res.json({
        trainers: trainers.filter((t) => t.categorySlug === categorySlug),
      });
    res.json({ trainers });
  } catch (e) {
    res.status(500).json({ error: 'trainers list error' });
  }
});
app.post('/api/trainers', async (req, res) => {
  const { title, slug, categorySlug, type, meta } = req.body || {};
  try {
    if (USE_SB) {
      const sb = getSupabase();
      const { data, error } = await sb
        .from('trainers')
        .insert({
          title,
          slug,
          category_slug: categorySlug || null,
          type,
          meta: meta || {},
        })
        .select('id,title,slug,category_slug,type,meta,created_at')
        .single();
      if (error) return res.status(400).json({ error: 'trainer create error' });
      return res.json({ trainer: data });
    }
    const trainers = read('trainers');
    const trainer = {
      id: uid(),
      title,
      slug,
      categorySlug: categorySlug || null,
      type,
      meta: meta || {},
      createdAt: now(),
    };
    trainers.push(trainer);
    write('trainers', trainers);
    res.json({ trainer });
  } catch (e) {
    res.status(500).json({ error: 'trainer create error' });
  }
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
        type: req.body?.type,
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
  } catch (e) {
    res.status(500).json({ error: 'trainer update error' });
  }
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
  } catch (e) {
    res.status(500).json({ error: 'trainer delete error' });
  }
});

// Trainer items
app.get('/api/trainers/:trainerId/items', async (req, res) => {
  try {
    if (USE_SB) {
      const sb = getSupabase();
      const { data, error } = await sb
        .from('trainer_items')
        .select(
          'id,trainer_id,order_index,payload,answer,correct_answers,wrong_answers,created_at',
        )
        .eq('trainer_id', req.params.trainerId)
        .order('order_index', { ascending: true });
      if (error) return res.status(500).json({ error: 'items list error' });
      return res.json({ items: data || [] });
    }
    const items = read('trainer_items')
      .filter((i) => i.trainerId === req.params.trainerId)
      .map((i) => ({ correctAnswers: [], wrongAnswers: [], ...i }));
    res.json({ items });
  } catch (e) {
    res.status(500).json({ error: 'items list error' });
  }
});
app.post('/api/trainers/:trainerId/items', async (req, res) => {
  const { trainerId } = req.params;
  const { orderIndex, words, correctAnswers, wrongAnswers, answer } =
    req.body || {};
  try {
    if (USE_SB) {
      const sb = getSupabase();
      const { data, error } = await sb
        .from('trainer_items')
        .insert({
          trainer_id: trainerId,
          order_index: orderIndex || 0,
          payload: { words: words || [] },
          answer: answer || null,
          correct_answers: correctAnswers || [],
          wrong_answers: wrongAnswers || [],
        })
        .select(
          'id,trainer_id,order_index,payload,answer,correct_answers,wrong_answers,created_at',
        )
        .single();
      if (error) return res.status(400).json({ error: 'item create error' });
      return res.json({ item: data });
    }
    const items = read('trainer_items');
    const item = {
      id: uid(),
      trainerId,
      orderIndex: orderIndex || 0,
      payload: { words: words || [] },
      answer: answer || null,
      correctAnswers: correctAnswers || [],
      wrongAnswers: wrongAnswers || [],
    };
    items.push(item);
    write('trainer_items', items);
    res.json({ item });
  } catch (e) {
    res.status(500).json({ error: 'item create error' });
  }
});
app.put('/api/trainer-items/:id', async (req, res) => {
  try {
    if (USE_SB) {
      const sb = getSupabase();
      const patch = {
        order_index: req.body?.orderIndex,
        payload: req.body?.words
          ? { words: req.body.words }
          : (req.body?.payload ?? {}),
        answer: req.body?.answer ?? null,
        correct_answers: req.body?.correctAnswers,
        wrong_answers: req.body?.wrongAnswers,
      };
      const { data, error } = await sb
        .from('trainer_items')
        .update(patch)
        .eq('id', req.params.id)
        .select(
          'id,trainer_id,order_index,payload,answer,correct_answers,wrong_answers,created_at',
        )
        .single();
      if (error) return res.status(400).json({ error: 'item update error' });
      return res.json({ item: data });
    }
    const items = read('trainer_items');
    const idx = items.findIndex((i) => i.id === req.params.id);
    if (idx === -1) return res.status(404).json({ error: 'not found' });
    items[idx] = {
      ...items[idx],
      ...req.body,
      payload: req.body?.words ? { words: req.body.words } : items[idx].payload,
    };
    write('trainer_items', items);
    res.json({ item: items[idx] });
  } catch (e) {
    res.status(500).json({ error: 'item update error' });
  }
});
app.delete('/api/trainer-items/:id', async (req, res) => {
  try {
    if (USE_SB) {
      const sb = getSupabase();
      const { error } = await sb
        .from('trainer_items')
        .delete()
        .eq('id', req.params.id);
      if (error) return res.status(400).json({ error: 'item delete error' });
      return res.json({ ok: true });
    }
    const items = read('trainer_items').filter((i) => i.id !== req.params.id);
    write('trainer_items', items);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: 'item delete error' });
  }
});

// Simple tests endpoint (alias for materials with type "test")
app.get('/api/tests', async (_req, res) => {
  try {
    if (USE_SB) {
      const sb = getSupabase();
      const { data, error } = await sb
        .from('materials')
        .select('id,title,content,slug,category_slug,created_at')
        .eq('type', 'test');
      if (error) return res.status(500).json({ error: 'tests list error' });
      const tests = (data || []).map((m) => ({
        id: m.id,
        title: m.title,
        ...(m.content || {}),
      }));
      return res.json(tests);
    }
    const materials = read('materials').filter((m) => m.type === 'test');
    const tests = materials.map((m) => ({
      id: m.id,
      title: m.title,
      ...(m.content || {}),
    }));
    res.json(tests);
  } catch (e) {
    res.status(500).json({ error: 'tests list error' });
  }
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
        if (error)
          return res.status(500).json({ error: 'material fetch error' });
        return res.json({ material: data || null });
      }
      let q = sb
        .from('materials')
        .select('id,type,title,slug,category_slug,content,created_at');
      if (type) q = q.eq('type', String(type));
      const { data, error } = await q;
      if (error) return res.status(500).json({ error: 'materials list error' });
      return res.json({ materials: data || [] });
    }
    const materials = read('materials');
    if (slug)
      return res.json({
        material: materials.find((m) => m.slug === slug) || null,
      });
    if (type)
      return res.json({ materials: materials.filter((m) => m.type === type) });
    res.json({ materials });
  } catch (e) {
    res.status(500).json({ error: 'materials list error' });
  }
});
app.post('/api/materials', async (req, res) => {
  const { type, title, slug, categorySlug, content } = req.body || {};
  try {
    if (USE_SB) {
      const sb = getSupabase();
      const { data, error } = await sb
        .from('materials')
        .insert({
          type,
          title,
          slug,
          category_slug: categorySlug || null,
          content: content || {},
        })
        .select('id,type,title,slug,category_slug,content,created_at')
        .single();
      if (error)
        return res.status(400).json({ error: 'material create error' });
      return res.json({ material: data });
    }
    const materials = read('materials');
    const material = {
      id: uid(),
      type,
      title,
      slug,
      categorySlug: categorySlug || null,
      content: content || {},
      createdAt: now(),
    };
    materials.push(material);
    write('materials', materials);
    res.json({ material });
  } catch (e) {
    res.status(500).json({ error: 'material create error' });
  }
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
      if (error)
        return res.status(400).json({ error: 'material update error' });
      return res.json({ material: data });
    }
    const materials = read('materials');
    const idx = materials.findIndex((m) => m.id === id);
    if (idx === -1) return res.status(404).json({ error: 'not found' });
    materials[idx] = { ...materials[idx], ...req.body };
    write('materials', materials);
    res.json({ material: materials[idx] });
  } catch (e) {
    res.status(500).json({ error: 'material update error' });
  }
});
app.delete('/api/materials/:id', async (req, res) => {
  const { id } = req.params;
  try {
    if (USE_SB) {
      const sb = getSupabase();
      const { error } = await sb.from('materials').delete().eq('id', id);
      if (error)
        return res.status(400).json({ error: 'material delete error' });
      return res.json({ ok: true });
    }
    const materials = read('materials').filter((m) => m.id !== id);
    write('materials', materials);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: 'material delete error' });
  }
});

// In production, serve frontend
if (process.env.NODE_ENV === 'production') {
  const buildPath = path.join(__dirname, '..', 'build');
  app.use(express.static(buildPath));
  app.get('*', (req, res) => {
    res.sendFile(path.join(buildPath, 'index.html'));
  });
}

app.listen(PORT, () =>
  console.log(
    `[server] listening on :${PORT} (mode=${USE_PG ? 'pg' : USE_SB ? 'sb' : 'fs'})`,
  ),
);
// Simple healthcheck
app.get('/health', (_req, res) =>
  res.json({ ok: true, mode: USE_PG ? 'pg' : USE_SB ? 'sb' : 'fs' }),
);
// Env presence (debug)
app.get('/health/env', (_req, res) =>
  res.json({
    sbUrlPresent: !!(
      process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL
    ),
    sbKeyPresent: !!(
      process.env.SUPABASE_SERVICE_ROLE ||
      process.env.SUPABASE_SERVICE_KEY ||
      process.env.SUPABASE_SERVICE_ROLE_KEY
    ),
    dbUrlPresent: !!process.env.DATABASE_URL,
    mode: USE_PG ? 'pg' : USE_SB ? 'sb' : 'fs',
  }),
);
