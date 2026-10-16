-- OneDay Books: the double entry ledger.
-- Adds journal entries and their lines, the real bookkeeping underneath. You
-- never see debits and credits in the app. This keeps the books correct and
-- the tax lines right. Run after 0001_init.sql in the Supabase SQL Editor.

-- ------------------------------------------------------------------
-- journal_entries: one event, such as a payment received or a bill paid.
-- ------------------------------------------------------------------
create table if not exists public.journal_entries (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null default auth.uid() references auth.users (id) on delete cascade,
  entity_id  uuid not null references public.entities (id) on delete cascade,
  entry_date date not null,
  memo       text,
  source     text not null default 'manual'
               check (source in ('manual', 'import', 'plaid', 'receipt')),
  created_at timestamptz not null default now()
);

-- ------------------------------------------------------------------
-- journal_lines: the two or more sides of an entry. amount_cents is a whole
-- number of cents in debit positive form. The lines of one entry always add up
-- to exactly zero, which is what balanced means.
-- ------------------------------------------------------------------
create table if not exists public.journal_lines (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  entry_id    uuid not null references public.journal_entries (id) on delete cascade,
  entity_id   uuid not null references public.entities (id) on delete cascade,
  account_id  uuid not null references public.accounts (id) on delete restrict,
  amount_cents bigint not null,
  brand_id    uuid references public.brands (id) on delete set null,
  created_at  timestamptz not null default now()
);

create index if not exists journal_entries_entity_date_idx
  on public.journal_entries (entity_id, entry_date desc);
create index if not exists journal_lines_entry_idx on public.journal_lines (entry_id);
create index if not exists journal_lines_account_idx on public.journal_lines (account_id);

-- ------------------------------------------------------------------
-- Row level security: your rows only.
-- ------------------------------------------------------------------
alter table public.journal_entries enable row level security;
alter table public.journal_lines   enable row level security;

create policy "entries are mine" on public.journal_entries
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "lines are mine" on public.journal_lines
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ------------------------------------------------------------------
-- post_entry: posts a balanced entry atomically. Rejects anything that does
-- not add up to zero, so the books can never go out of balance. Runs as the
-- signed in user, so row level security still applies.
-- p_lines is a json array like:
--   [{"account_id": "...", "amount_cents": 50000, "brand_id": "..."},
--    {"account_id": "...", "amount_cents": -50000}]
-- ------------------------------------------------------------------
create or replace function public.post_entry(
  p_entity uuid,
  p_date date,
  p_memo text,
  p_source text,
  p_lines jsonb
) returns uuid
language plpgsql
security invoker
as $$
declare
  v_entry uuid;
  v_sum   bigint;
  v_line  jsonb;
begin
  if not exists (
    select 1 from public.entities where id = p_entity and user_id = auth.uid()
  ) then
    raise exception 'Those books were not found';
  end if;

  if jsonb_array_length(p_lines) < 2 then
    raise exception 'An entry needs at least two lines';
  end if;

  select coalesce(sum((l ->> 'amount_cents')::bigint), 0)
    into v_sum
    from jsonb_array_elements(p_lines) as l;

  if v_sum <> 0 then
    raise exception 'Entry is not balanced (off by % cents)', v_sum;
  end if;

  insert into public.journal_entries (entity_id, entry_date, memo, source)
  values (p_entity, p_date, nullif(p_memo, ''), coalesce(nullif(p_source, ''), 'manual'))
  returning id into v_entry;

  for v_line in select * from jsonb_array_elements(p_lines)
  loop
    insert into public.journal_lines (entry_id, entity_id, account_id, amount_cents, brand_id)
    values (
      v_entry,
      p_entity,
      (v_line ->> 'account_id')::uuid,
      (v_line ->> 'amount_cents')::bigint,
      nullif(v_line ->> 'brand_id', '')::uuid
    );
  end loop;

  insert into public.audit_log (entity_id, actor, action, table_name, row_id, reason, new_value)
  values (p_entity, 'owner', 'post', 'journal_entries', v_entry::text,
          'Manual transaction posted.', p_lines);

  return v_entry;
end;
$$;

grant execute on function public.post_entry(uuid, date, text, text, jsonb) to authenticated;
