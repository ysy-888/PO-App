-- ============================================================
-- Migration 002: Full entity tables for all remaining features
-- Run this in the Supabase SQL editor after 001_initial_schema.sql.
-- All tables follow the same pattern as purchase_orders:
--   - tenant_id  UUID FK to tenants
--   - entity_id  TEXT — the natural business ID (e.g. "SHP-0001")
--   - data       JSONB — full row object mirroring the Google Sheet row
--   - RLS policies so the service-role API bypasses them,
--     direct client calls are tenant-scoped.
-- ============================================================

-- ── Helper: reuse the set_updated_at trigger function from 001 ──

-- ── Utility macro: apply set_updated_at trigger to a table ────
-- (Inline SQL; repeat per table since PL/pgSQL can't parametrize trigger targets)

-- ============================================================
-- SHIPMENTS
-- ============================================================
create table if not exists public.shipments (
  id          uuid primary key default gen_random_uuid(),
  tenant_id   uuid not null references public.tenants on delete cascade,
  entity_id   text not null,   -- "Shipment ID" value e.g. "SHP-0001"
  data        jsonb not null default '{}',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (tenant_id, entity_id)
);

drop trigger if exists set_shipments_updated_at on public.shipments;
create trigger set_shipments_updated_at
  before update on public.shipments
  for each row execute procedure public.set_updated_at();

alter table public.shipments enable row level security;

create policy "members can read own tenant shipments"
  on public.shipments for select
  using (tenant_id in (select public.user_tenant_ids()));

create policy "members can insert own tenant shipments"
  on public.shipments for insert
  with check (tenant_id in (select public.user_tenant_ids()));

create policy "members can update own tenant shipments"
  on public.shipments for update
  using (tenant_id in (select public.user_tenant_ids()));

create policy "members can delete own tenant shipments"
  on public.shipments for delete
  using (tenant_id in (select public.user_tenant_ids()));

create index if not exists idx_shipments_tenant_id on public.shipments (tenant_id);

-- ============================================================
-- EXF REQUESTS
-- ============================================================
create table if not exists public.exf_requests (
  id          uuid primary key default gen_random_uuid(),
  tenant_id   uuid not null references public.tenants on delete cascade,
  entity_id   text not null,   -- "EXF Request ID" e.g. "EXF-0001"
  data        jsonb not null default '{}',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (tenant_id, entity_id)
);

drop trigger if exists set_exf_requests_updated_at on public.exf_requests;
create trigger set_exf_requests_updated_at
  before update on public.exf_requests
  for each row execute procedure public.set_updated_at();

alter table public.exf_requests enable row level security;

create policy "members can read own tenant exf_requests"
  on public.exf_requests for select
  using (tenant_id in (select public.user_tenant_ids()));

create policy "members can insert own tenant exf_requests"
  on public.exf_requests for insert
  with check (tenant_id in (select public.user_tenant_ids()));

create policy "members can update own tenant exf_requests"
  on public.exf_requests for update
  using (tenant_id in (select public.user_tenant_ids()));

create policy "members can delete own tenant exf_requests"
  on public.exf_requests for delete
  using (tenant_id in (select public.user_tenant_ids()));

create index if not exists idx_exf_requests_tenant_id on public.exf_requests (tenant_id);

-- ============================================================
-- ASN REQUESTS
-- ============================================================
create table if not exists public.asn_requests (
  id          uuid primary key default gen_random_uuid(),
  tenant_id   uuid not null references public.tenants on delete cascade,
  entity_id   text not null,   -- "ASN Request ID" e.g. "ASN-0001"
  data        jsonb not null default '{}',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (tenant_id, entity_id)
);

drop trigger if exists set_asn_requests_updated_at on public.asn_requests;
create trigger set_asn_requests_updated_at
  before update on public.asn_requests
  for each row execute procedure public.set_updated_at();

alter table public.asn_requests enable row level security;

create policy "members can read own tenant asn_requests"
  on public.asn_requests for select
  using (tenant_id in (select public.user_tenant_ids()));

create policy "members can insert own tenant asn_requests"
  on public.asn_requests for insert
  with check (tenant_id in (select public.user_tenant_ids()));

create policy "members can update own tenant asn_requests"
  on public.asn_requests for update
  using (tenant_id in (select public.user_tenant_ids()));

create policy "members can delete own tenant asn_requests"
  on public.asn_requests for delete
  using (tenant_id in (select public.user_tenant_ids()));

create index if not exists idx_asn_requests_tenant_id on public.asn_requests (tenant_id);

-- ============================================================
-- DELIVERY REQUESTS
-- ============================================================
create table if not exists public.delivery_requests (
  id          uuid primary key default gen_random_uuid(),
  tenant_id   uuid not null references public.tenants on delete cascade,
  entity_id   text not null,   -- "Delivery Request ID" e.g. "DR-0001"
  data        jsonb not null default '{}',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (tenant_id, entity_id)
);

drop trigger if exists set_delivery_requests_updated_at on public.delivery_requests;
create trigger set_delivery_requests_updated_at
  before update on public.delivery_requests
  for each row execute procedure public.set_updated_at();

alter table public.delivery_requests enable row level security;

create policy "members can read own tenant delivery_requests"
  on public.delivery_requests for select
  using (tenant_id in (select public.user_tenant_ids()));

create policy "members can insert own tenant delivery_requests"
  on public.delivery_requests for insert
  with check (tenant_id in (select public.user_tenant_ids()));

create policy "members can update own tenant delivery_requests"
  on public.delivery_requests for update
  using (tenant_id in (select public.user_tenant_ids()));

create policy "members can delete own tenant delivery_requests"
  on public.delivery_requests for delete
  using (tenant_id in (select public.user_tenant_ids()));

create index if not exists idx_delivery_requests_tenant_id on public.delivery_requests (tenant_id);

-- ============================================================
-- PICKUP REQUESTS
-- ============================================================
create table if not exists public.pickup_requests (
  id          uuid primary key default gen_random_uuid(),
  tenant_id   uuid not null references public.tenants on delete cascade,
  entity_id   text not null,   -- "Pickup Request ID" e.g. "PR-0001"
  data        jsonb not null default '{}',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (tenant_id, entity_id)
);

drop trigger if exists set_pickup_requests_updated_at on public.pickup_requests;
create trigger set_pickup_requests_updated_at
  before update on public.pickup_requests
  for each row execute procedure public.set_updated_at();

alter table public.pickup_requests enable row level security;

create policy "members can read own tenant pickup_requests"
  on public.pickup_requests for select
  using (tenant_id in (select public.user_tenant_ids()));

create policy "members can insert own tenant pickup_requests"
  on public.pickup_requests for insert
  with check (tenant_id in (select public.user_tenant_ids()));

create policy "members can update own tenant pickup_requests"
  on public.pickup_requests for update
  using (tenant_id in (select public.user_tenant_ids()));

create policy "members can delete own tenant pickup_requests"
  on public.pickup_requests for delete
  using (tenant_id in (select public.user_tenant_ids()));

create index if not exists idx_pickup_requests_tenant_id on public.pickup_requests (tenant_id);

-- ============================================================
-- APPROVALS
-- ============================================================
create table if not exists public.approvals (
  id          uuid primary key default gen_random_uuid(),
  tenant_id   uuid not null references public.tenants on delete cascade,
  entity_id   text not null,   -- "Approval ID" e.g. "APR-0001"
  data        jsonb not null default '{}',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (tenant_id, entity_id)
);

drop trigger if exists set_approvals_updated_at on public.approvals;
create trigger set_approvals_updated_at
  before update on public.approvals
  for each row execute procedure public.set_updated_at();

alter table public.approvals enable row level security;

create policy "members can read own tenant approvals"
  on public.approvals for select
  using (tenant_id in (select public.user_tenant_ids()));

create policy "members can insert own tenant approvals"
  on public.approvals for insert
  with check (tenant_id in (select public.user_tenant_ids()));

create policy "members can update own tenant approvals"
  on public.approvals for update
  using (tenant_id in (select public.user_tenant_ids()));

create policy "members can delete own tenant approvals"
  on public.approvals for delete
  using (tenant_id in (select public.user_tenant_ids()));

create index if not exists idx_approvals_tenant_id on public.approvals (tenant_id);

-- ============================================================
-- CHARGEBACKS
-- ============================================================
create table if not exists public.chargebacks (
  id          uuid primary key default gen_random_uuid(),
  tenant_id   uuid not null references public.tenants on delete cascade,
  entity_id   text not null,   -- "Chargeback ID" e.g. "CB-0001"
  data        jsonb not null default '{}',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (tenant_id, entity_id)
);

drop trigger if exists set_chargebacks_updated_at on public.chargebacks;
create trigger set_chargebacks_updated_at
  before update on public.chargebacks
  for each row execute procedure public.set_updated_at();

alter table public.chargebacks enable row level security;

create policy "members can read own tenant chargebacks"
  on public.chargebacks for select
  using (tenant_id in (select public.user_tenant_ids()));

create policy "members can insert own tenant chargebacks"
  on public.chargebacks for insert
  with check (tenant_id in (select public.user_tenant_ids()));

create policy "members can update own tenant chargebacks"
  on public.chargebacks for update
  using (tenant_id in (select public.user_tenant_ids()));

create policy "members can delete own tenant chargebacks"
  on public.chargebacks for delete
  using (tenant_id in (select public.user_tenant_ids()));

create index if not exists idx_chargebacks_tenant_id on public.chargebacks (tenant_id);

-- ============================================================
-- PACKING LISTS
-- ============================================================
create table if not exists public.packing_lists (
  id          uuid primary key default gen_random_uuid(),
  tenant_id   uuid not null references public.tenants on delete cascade,
  entity_id   text not null,   -- "Packing List ID" e.g. "PL-0001"
  data        jsonb not null default '{}',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (tenant_id, entity_id)
);

drop trigger if exists set_packing_lists_updated_at on public.packing_lists;
create trigger set_packing_lists_updated_at
  before update on public.packing_lists
  for each row execute procedure public.set_updated_at();

alter table public.packing_lists enable row level security;

create policy "members can read own tenant packing_lists"
  on public.packing_lists for select
  using (tenant_id in (select public.user_tenant_ids()));

create policy "members can insert own tenant packing_lists"
  on public.packing_lists for insert
  with check (tenant_id in (select public.user_tenant_ids()));

create policy "members can update own tenant packing_lists"
  on public.packing_lists for update
  using (tenant_id in (select public.user_tenant_ids()));

create policy "members can delete own tenant packing_lists"
  on public.packing_lists for delete
  using (tenant_id in (select public.user_tenant_ids()));

create index if not exists idx_packing_lists_tenant_id on public.packing_lists (tenant_id);

-- ============================================================
-- PACKING CARTONS
-- Multiple cartons per packing list; keyed by (tenant_id, packing_list_entity_id, carton_number).
-- ============================================================
create table if not exists public.packing_cartons (
  id                      uuid primary key default gen_random_uuid(),
  tenant_id               uuid not null references public.tenants on delete cascade,
  packing_list_entity_id  text not null,  -- matches packing_lists.entity_id
  carton_number           integer not null,
  data                    jsonb not null default '{}',
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now(),
  unique (tenant_id, packing_list_entity_id, carton_number)
);

drop trigger if exists set_packing_cartons_updated_at on public.packing_cartons;
create trigger set_packing_cartons_updated_at
  before update on public.packing_cartons
  for each row execute procedure public.set_updated_at();

alter table public.packing_cartons enable row level security;

create policy "members can read own tenant packing_cartons"
  on public.packing_cartons for select
  using (tenant_id in (select public.user_tenant_ids()));

create policy "members can insert own tenant packing_cartons"
  on public.packing_cartons for insert
  with check (tenant_id in (select public.user_tenant_ids()));

create policy "members can update own tenant packing_cartons"
  on public.packing_cartons for update
  using (tenant_id in (select public.user_tenant_ids()));

create policy "members can delete own tenant packing_cartons"
  on public.packing_cartons for delete
  using (tenant_id in (select public.user_tenant_ids()));

create index if not exists idx_packing_cartons_tenant_id on public.packing_cartons (tenant_id);
create index if not exists idx_packing_cartons_list_id
  on public.packing_cartons (tenant_id, packing_list_entity_id);

-- ============================================================
-- PENDING PACKING LISTS (Vendor Submissions)
-- ============================================================
create table if not exists public.pending_packing_lists (
  id          uuid primary key default gen_random_uuid(),
  tenant_id   uuid not null references public.tenants on delete cascade,
  entity_id   text not null,   -- "Submission ID" value
  data        jsonb not null default '{}',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (tenant_id, entity_id)
);

drop trigger if exists set_pending_packing_lists_updated_at on public.pending_packing_lists;
create trigger set_pending_packing_lists_updated_at
  before update on public.pending_packing_lists
  for each row execute procedure public.set_updated_at();

alter table public.pending_packing_lists enable row level security;

create policy "members can read own tenant pending_packing_lists"
  on public.pending_packing_lists for select
  using (tenant_id in (select public.user_tenant_ids()));

create policy "members can insert own tenant pending_packing_lists"
  on public.pending_packing_lists for insert
  with check (tenant_id in (select public.user_tenant_ids()));

create policy "members can update own tenant pending_packing_lists"
  on public.pending_packing_lists for update
  using (tenant_id in (select public.user_tenant_ids()));

create policy "members can delete own tenant pending_packing_lists"
  on public.pending_packing_lists for delete
  using (tenant_id in (select public.user_tenant_ids()));

create index if not exists idx_pending_packing_lists_tenant_id on public.pending_packing_lists (tenant_id);

-- ============================================================
-- CUSTOMERS
-- entity_id = the "Customer" name field (e.g. "12TH TRIBE")
-- ============================================================
create table if not exists public.customers (
  id          uuid primary key default gen_random_uuid(),
  tenant_id   uuid not null references public.tenants on delete cascade,
  entity_id   text not null,   -- "Customer" field value
  data        jsonb not null default '{}',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (tenant_id, entity_id)
);

drop trigger if exists set_customers_updated_at on public.customers;
create trigger set_customers_updated_at
  before update on public.customers
  for each row execute procedure public.set_updated_at();

alter table public.customers enable row level security;

create policy "members can read own tenant customers"
  on public.customers for select
  using (tenant_id in (select public.user_tenant_ids()));

create policy "members can insert own tenant customers"
  on public.customers for insert
  with check (tenant_id in (select public.user_tenant_ids()));

create policy "members can update own tenant customers"
  on public.customers for update
  using (tenant_id in (select public.user_tenant_ids()));

create policy "members can delete own tenant customers"
  on public.customers for delete
  using (tenant_id in (select public.user_tenant_ids()));

create index if not exists idx_customers_tenant_id on public.customers (tenant_id);

-- ============================================================
-- CONTACTS  (vendors/buyers/logistics — the "Contacts" sheet)
-- entity_id = "Name" field
-- ============================================================
create table if not exists public.contacts (
  id          uuid primary key default gen_random_uuid(),
  tenant_id   uuid not null references public.tenants on delete cascade,
  entity_id   text not null,   -- "Name" field value
  data        jsonb not null default '{}',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (tenant_id, entity_id)
);

drop trigger if exists set_contacts_updated_at on public.contacts;
create trigger set_contacts_updated_at
  before update on public.contacts
  for each row execute procedure public.set_updated_at();

alter table public.contacts enable row level security;

create policy "members can read own tenant contacts"
  on public.contacts for select
  using (tenant_id in (select public.user_tenant_ids()));

create policy "members can insert own tenant contacts"
  on public.contacts for insert
  with check (tenant_id in (select public.user_tenant_ids()));

create policy "members can update own tenant contacts"
  on public.contacts for update
  using (tenant_id in (select public.user_tenant_ids()));

create policy "members can delete own tenant contacts"
  on public.contacts for delete
  using (tenant_id in (select public.user_tenant_ids()));

create index if not exists idx_contacts_tenant_id on public.contacts (tenant_id);

-- ============================================================
-- LOCATIONS  (warehouse/buyer addresses)
-- entity_id = "Entity" field
-- ============================================================
create table if not exists public.locations (
  id          uuid primary key default gen_random_uuid(),
  tenant_id   uuid not null references public.tenants on delete cascade,
  entity_id   text not null,   -- "Entity" field value
  data        jsonb not null default '{}',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (tenant_id, entity_id)
);

drop trigger if exists set_locations_updated_at on public.locations;
create trigger set_locations_updated_at
  before update on public.locations
  for each row execute procedure public.set_updated_at();

alter table public.locations enable row level security;

create policy "members can read own tenant locations"
  on public.locations for select
  using (tenant_id in (select public.user_tenant_ids()));

create policy "members can insert own tenant locations"
  on public.locations for insert
  with check (tenant_id in (select public.user_tenant_ids()));

create policy "members can update own tenant locations"
  on public.locations for update
  using (tenant_id in (select public.user_tenant_ids()));

create policy "members can delete own tenant locations"
  on public.locations for delete
  using (tenant_id in (select public.user_tenant_ids()));

create index if not exists idx_locations_tenant_id on public.locations (tenant_id);

-- ============================================================
-- STYLE PHOTOS
-- entity_id = "Style #" + "|" + "Color" composite key
-- ============================================================
create table if not exists public.style_photos (
  id          uuid primary key default gen_random_uuid(),
  tenant_id   uuid not null references public.tenants on delete cascade,
  entity_id   text not null,   -- "<Style #>|<Color>" e.g. "ST-100|Navy"
  data        jsonb not null default '{}',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (tenant_id, entity_id)
);

drop trigger if exists set_style_photos_updated_at on public.style_photos;
create trigger set_style_photos_updated_at
  before update on public.style_photos
  for each row execute procedure public.set_updated_at();

alter table public.style_photos enable row level security;

create policy "members can read own tenant style_photos"
  on public.style_photos for select
  using (tenant_id in (select public.user_tenant_ids()));

create policy "members can insert own tenant style_photos"
  on public.style_photos for insert
  with check (tenant_id in (select public.user_tenant_ids()));

create policy "members can update own tenant style_photos"
  on public.style_photos for update
  using (tenant_id in (select public.user_tenant_ids()));

create policy "members can delete own tenant style_photos"
  on public.style_photos for delete
  using (tenant_id in (select public.user_tenant_ids()));

create index if not exists idx_style_photos_tenant_id on public.style_photos (tenant_id);

-- ============================================================
-- TENANT SETTINGS
-- One row per tenant; stores vendorSubmitMode, defaultColumns,
-- defaultStatusFilter, and any other per-tenant preferences.
-- ============================================================
create table if not exists public.tenant_settings (
  tenant_id   uuid primary key references public.tenants on delete cascade,
  settings    jsonb not null default '{}',
  updated_at  timestamptz not null default now()
);

drop trigger if exists set_tenant_settings_updated_at on public.tenant_settings;
create trigger set_tenant_settings_updated_at
  before update on public.tenant_settings
  for each row execute procedure public.set_updated_at();

alter table public.tenant_settings enable row level security;

create policy "members can read own tenant settings"
  on public.tenant_settings for select
  using (tenant_id in (select public.user_tenant_ids()));

create policy "members can insert own tenant settings"
  on public.tenant_settings for insert
  with check (tenant_id in (select public.user_tenant_ids()));

create policy "members can update own tenant settings"
  on public.tenant_settings for update
  using (tenant_id in (select public.user_tenant_ids()));

-- ============================================================
-- Additional indexes for common query patterns
-- ============================================================
-- Quickly look up all chargebacks for a PO.
create index if not exists idx_chargebacks_po_number
  on public.chargebacks ((data->>'PO #'));

-- Quickly look up all packing lists for a PO.
create index if not exists idx_packing_lists_po_number
  on public.packing_lists ((data->>'PO #'));

-- Quickly look up approvals by PO.
create index if not exists idx_approvals_po_number
  on public.approvals ((data->>'PO #'));
