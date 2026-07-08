-- ============================================================
-- Migration 007: Profile display names
-- Adds an optional human-friendly name shown in place of the
-- email address (e.g. in Sales Order comment threads).
-- Run this in the Supabase SQL editor (or via supabase db push).
-- ============================================================

alter table public.profiles
  add column if not exists display_name text;
