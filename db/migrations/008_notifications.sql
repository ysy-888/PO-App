-- ============================================================
-- Migration 008: User notifications
-- One row per notification (e.g. "@mentioned in an SO comment").
-- The Express API (service role) creates and manages rows; RLS
-- lets a signed-in user read only their own as a safety net.
-- Run this in the Supabase SQL editor (or via supabase db push).
-- ============================================================

create table if not exists public.notifications (
  id         uuid primary key default gen_random_uuid(),
  tenant_id  uuid not null references public.tenants on delete cascade,
  user_id    uuid not null references public.profiles on delete cascade,
  data       jsonb not null default '{}',
  read       boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists notifications_user_idx
  on public.notifications (tenant_id, user_id, created_at desc);

alter table public.notifications enable row level security;

drop policy if exists "users read own notifications" on public.notifications;
create policy "users read own notifications"
  on public.notifications for select
  using (user_id = auth.uid());
