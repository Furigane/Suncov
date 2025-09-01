-- Supabase/PostgreSQL schema for app content

-- Users table (if not exists) -- kept for reference; users already exist in your instance
create table if not exists public.users (
  id uuid primary key default gen_random_uuid(),
  first_name text not null,
  last_name  text not null,
  username   text not null unique,
  password_hash text not null,
  role text not null default 'user',
  created_at timestamptz not null default now()
);

-- Categories for trainers/materials (support nesting via parent_id)
create table if not exists public.categories (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  parent_id uuid null references public.categories(id) on delete set null,
  position integer not null default 0,
  created_at timestamptz not null default now()
);

-- Trainers
create table if not exists public.trainers (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  slug text not null unique,
  category_slug text null references public.categories(slug) on delete set null,
  type text not null,
  meta jsonb not null default '{}',
  created_at timestamptz not null default now()
);

-- Trainer items
create table if not exists public.trainer_items (
  id uuid primary key default gen_random_uuid(),
  trainer_id uuid not null references public.trainers(id) on delete cascade,
  order_index integer not null default 0,
  payload jsonb not null default '{}',
  answer text null,
  created_at timestamptz not null default now()
);

-- Materials (tests/dictants/parts-of-speech)
create table if not exists public.materials (
  id uuid primary key default gen_random_uuid(),
  type text not null,
  title text not null,
  slug text not null unique,
  category_slug text null references public.categories(slug) on delete set null,
  content jsonb not null default '{}',
  created_at timestamptz not null default now()
);

