-- OneDay Books: first database setup.
-- Creates the core tables for Milestone 1 and turns on row level security so
-- every row is tied to you and only you can read it.
--
-- Run this once in your Supabase project:
--   Supabase dashboard  ->  SQL Editor  ->  New query  ->  paste  ->  Run

-- gen_random_uuid lives in pgcrypto, which Supabase has available.
create extension if not exists pgcrypto;

-- ------------------------------------------------------------------
-- entities: your sets of books. Sound Society LLC and Personal.
-- ------------------------------------------------------------------
create table if not exists public.entities (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name          text not null,
  slug          text not null,
  tax_treatment text not null default 'schedule_c'
                  check (tax_treatment in ('schedule_c', 's_corp', 'personal', 'partnership')),
  is_personal   boolean not null default false,
  created_at    timestamptz not null default now(),
  unique (user_id, slug)
);

-- ------------------------------------------------------------------
-- brands: labels inside an entity (OneDay Sounds, Ctrl.Booth, Loud Garden).
-- ------------------------------------------------------------------
create table if not exists public.brands (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null default auth.uid() references auth.users (id) on delete cascade,
  entity_id  uuid not null references public.entities (id) on delete cascade,
  name       text not null,
  slug       text not null,
  created_at timestamptz not null default now(),
  unique (entity_id, slug)
);

-- ------------------------------------------------------------------
-- accounts: the chart of accounts, each mapped to its Schedule C line.
-- ------------------------------------------------------------------
create table if not exists public.accounts (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null default auth.uid() references auth.users (id) on delete cascade,
  entity_id       uuid not null references public.entities (id) on delete cascade,
  code            text not null,
  name            text not null,
  type            text not null check (type in ('asset', 'liability', 'equity', 'income', 'expense')),
  subtype         text,
  schedule_c_line text,
  note            text,
  is_active       boolean not null default true,
  created_at      timestamptz not null default now(),
  unique (entity_id, code)
);

create index if not exists accounts_entity_idx on public.accounts (entity_id);
create index if not exists brands_entity_idx on public.brands (entity_id);

-- ------------------------------------------------------------------
-- audit_log: append only history. Who or what, when, why, old, new.
-- Nothing is ever silently deleted.
-- ------------------------------------------------------------------
create table if not exists public.audit_log (
  id         bigint generated always as identity primary key,
  user_id    uuid not null default auth.uid() references auth.users (id) on delete cascade,
  entity_id  uuid references public.entities (id) on delete set null,
  actor      text not null,
  action     text not null,
  table_name text not null,
  row_id     text,
  reason     text,
  old_value  jsonb,
  new_value  jsonb,
  created_at timestamptz not null default now()
);

create index if not exists audit_log_created_idx on public.audit_log (created_at desc);

-- ------------------------------------------------------------------
-- Row level security. Deny by default, then allow only your own rows.
-- ------------------------------------------------------------------
alter table public.entities  enable row level security;
alter table public.brands    enable row level security;
alter table public.accounts  enable row level security;
alter table public.audit_log enable row level security;

-- entities
create policy "entities are mine" on public.entities
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- brands
create policy "brands are mine" on public.brands
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- accounts
create policy "accounts are mine" on public.accounts
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- audit_log: you can read and append your own rows. No update or delete,
-- because an audit trail is append only.
create policy "audit read mine" on public.audit_log
  for select using (user_id = auth.uid());
create policy "audit append mine" on public.audit_log
  for insert with check (user_id = auth.uid());
