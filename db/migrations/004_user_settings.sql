-- ============================================================
-- USER SETTINGS
-- One row per tenant/user; stores personal UI preferences that
-- should follow a signed-in user across browsers and devices.
-- ============================================================
create table if not exists public.user_settings (
  tenant_id  uuid not null references public.tenants on delete cascade,
  user_id    uuid not null references public.profiles on delete cascade,
  settings   jsonb not null default '{}',
  updated_at timestamptz not null default now(),
  primary key (tenant_id, user_id)
);

drop trigger if exists set_user_settings_updated_at on public.user_settings;
create trigger set_user_settings_updated_at
  before update on public.user_settings
  for each row execute procedure public.set_updated_at();

alter table public.user_settings enable row level security;

create policy "users can read own settings"
  on public.user_settings for select
  using (
    user_id = auth.uid()
    and tenant_id in (select public.user_tenant_ids())
  );

create policy "users can insert own settings"
  on public.user_settings for insert
  with check (
    user_id = auth.uid()
    and tenant_id in (select public.user_tenant_ids())
  );

create policy "users can update own settings"
  on public.user_settings for update
  using (
    user_id = auth.uid()
    and tenant_id in (select public.user_tenant_ids())
  );

create index if not exists idx_user_settings_user_id
  on public.user_settings (user_id);
