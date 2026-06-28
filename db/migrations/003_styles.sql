-- ============================================================
-- STYLES (Style Master from N41 export)
-- entity_id = "<Style #>|<Color>" e.g. "CD1004|PINK"
-- ============================================================
create table if not exists public.styles (
  id          uuid primary key default gen_random_uuid(),
  tenant_id   uuid not null references public.tenants on delete cascade,
  entity_id   text not null,
  data        jsonb not null default '{}',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (tenant_id, entity_id)
);

drop trigger if exists set_styles_updated_at on public.styles;
create trigger set_styles_updated_at
  before update on public.styles
  for each row execute procedure public.set_updated_at();

alter table public.styles enable row level security;

create policy "members can read own tenant styles"
  on public.styles for select
  using (tenant_id in (select public.user_tenant_ids()));

create policy "members can insert own tenant styles"
  on public.styles for insert
  with check (tenant_id in (select public.user_tenant_ids()));

create policy "members can update own tenant styles"
  on public.styles for update
  using (tenant_id in (select public.user_tenant_ids()));

create policy "members can delete own tenant styles"
  on public.styles for delete
  using (tenant_id in (select public.user_tenant_ids()));

create index if not exists idx_styles_tenant_id on public.styles (tenant_id);
