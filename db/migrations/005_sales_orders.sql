-- ============================================================
-- SALES ORDERS (Sales Order Details from N41 export)
-- entity_id = orderNo (Sales Order Number)
-- data JSONB contains order-level header fields + a "Lines"
-- array with one entry per style/color line row.
-- ============================================================
create table if not exists public.sales_orders (
  id          uuid primary key default gen_random_uuid(),
  tenant_id   uuid not null references public.tenants on delete cascade,
  entity_id   text not null,
  data        jsonb not null default '{}',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (tenant_id, entity_id)
);

drop trigger if exists set_sales_orders_updated_at on public.sales_orders;
create trigger set_sales_orders_updated_at
  before update on public.sales_orders
  for each row execute procedure public.set_updated_at();

alter table public.sales_orders enable row level security;

create policy "members can read own tenant sales_orders"
  on public.sales_orders for select
  using (tenant_id in (select public.user_tenant_ids()));

create policy "members can insert own tenant sales_orders"
  on public.sales_orders for insert
  with check (tenant_id in (select public.user_tenant_ids()));

create policy "members can update own tenant sales_orders"
  on public.sales_orders for update
  using (tenant_id in (select public.user_tenant_ids()));

create policy "members can delete own tenant sales_orders"
  on public.sales_orders for delete
  using (tenant_id in (select public.user_tenant_ids()));

create index if not exists idx_sales_orders_tenant_id on public.sales_orders (tenant_id);
