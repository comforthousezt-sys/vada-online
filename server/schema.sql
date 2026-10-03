-- Run once in Supabase SQL Editor (or an administrator Postgres connection).
-- Room snapshots contain hidden cards and hashed resume credentials.
-- This schema MUST NOT be added to Supabase exposed API schemas.
begin;
create schema if not exists vada_private;
revoke all on schema vada_private from public;
create table if not exists vada_private.rooms (
  code text primary key check (code ~ '^[A-F0-9]{6}$'),
  snapshot jsonb not null,
  revision bigint not null default 1,
  updated_at timestamptz not null default now()
);
alter table vada_private.rooms enable row level security;
revoke all on vada_private.rooms from public;
-- Supabase: prevent frontend roles from accessing snapshots even if the
-- project owner accidentally exposes the schema in Data API settings.
do $$
begin
  if exists(select 1 from pg_roles where rolname='anon') then
    execute 'revoke all on schema vada_private from anon';
    execute 'revoke all on vada_private.rooms from anon';
  end if;
  if exists(select 1 from pg_roles where rolname='authenticated') then
    execute 'revoke all on schema vada_private from authenticated';
    execute 'revoke all on vada_private.rooms from authenticated';
  end if;
end $$;
commit;
