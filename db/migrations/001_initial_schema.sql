-- ============================================================
-- Migration 001: Initial SaaS schema
-- Run this in the Supabase SQL editor (or via supabase db push).
-- ============================================================

-- ── Tenants ──────────────────────────────────────────────────
create table if not exists public.tenants (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  created_at timestamptz not null default now()
);

-- ── Profiles (one row per Supabase auth user) ────────────────
-- Mirrors auth.users but lives in public so the API can join it.
create table if not exists public.profiles (
  id         uuid primary key references auth.users on delete cascade,
  email      text,
  created_at timestamptz not null default now()
);

-- Auto-create a profile row whenever a new auth user is created.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer as $$
begin
  insert into public.profiles (id, email)
  values (new.id, new.email)
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ── Tenant memberships ───────────────────────────────────────
create table if not exists public.tenant_memberships (
  tenant_id  uuid not null references public.tenants on delete cascade,
  user_id    uuid not null references public.profiles on delete cascade,
  role       text not null default 'member',   -- 'admin' | 'member' | 'viewer'
  created_at timestamptz not null default now(),
  primary key (tenant_id, user_id)
);

-- ── Purchase orders ──────────────────────────────────────────
-- Using a jsonb `data` column for now so we can reach functional
-- parity quickly without upfront schema normalisation.
-- The `data` object mirrors the sheet-row field names used throughout
-- the frontend (e.g. "PO #", "Status", "Vendor", "Buyer", etc.).
create table if not exists public.purchase_orders (
  id          uuid primary key default gen_random_uuid(),
  tenant_id   uuid not null references public.tenants on delete cascade,
  po_number   text not null,
  data        jsonb not null default '{}',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (tenant_id, po_number)
);

-- Auto-update updated_at on every write.
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_purchase_orders_updated_at on public.purchase_orders;
create trigger set_purchase_orders_updated_at
  before update on public.purchase_orders
  for each row execute procedure public.set_updated_at();

-- ── Row-Level Security ───────────────────────────────────────
-- The Express API uses the service-role key (bypasses RLS) but
-- always filters by tenant_id server-side. RLS is a safety net
-- for any direct Supabase client calls.

alter table public.tenants enable row level security;
alter table public.profiles enable row level security;
alter table public.tenant_memberships enable row level security;
alter table public.purchase_orders enable row level security;

-- Helper: returns the tenant IDs the current JWT user belongs to.
create or replace function public.user_tenant_ids()
returns setof uuid language sql security definer stable as $$
  select tenant_id from public.tenant_memberships
  where user_id = auth.uid();
$$;

-- tenants: members can read their own tenant row.
create policy "tenant members can read their tenant"
  on public.tenants for select
  using (id in (select public.user_tenant_ids()));

-- profiles: users can read/update their own profile.
create policy "users can read own profile"
  on public.profiles for select
  using (id = auth.uid());

create policy "users can update own profile"
  on public.profiles for update
  using (id = auth.uid());

-- tenant_memberships: members can read memberships for their tenants.
create policy "members can read memberships for their tenants"
  on public.tenant_memberships for select
  using (tenant_id in (select public.user_tenant_ids()));

-- purchase_orders: tenant members can read/write their own tenant's orders.
create policy "members can read own tenant purchase orders"
  on public.purchase_orders for select
  using (tenant_id in (select public.user_tenant_ids()));

create policy "members can insert own tenant purchase orders"
  on public.purchase_orders for insert
  with check (tenant_id in (select public.user_tenant_ids()));

create policy "members can update own tenant purchase orders"
  on public.purchase_orders for update
  using (tenant_id in (select public.user_tenant_ids()));

-- ── Useful indexes ───────────────────────────────────────────
create index if not exists idx_purchase_orders_tenant_id
  on public.purchase_orders (tenant_id);

create index if not exists idx_tenant_memberships_user_id
  on public.tenant_memberships (user_id);
