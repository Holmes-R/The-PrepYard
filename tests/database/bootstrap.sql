-- ONLY for a disposable vanilla PostgreSQL database, never hosted Supabase.
-- Fail immediately if an auth schema already exists.
create schema auth;
create role anon nologin;
create role authenticated nologin;
create role service_role nologin bypassrls;
create table auth.users(id uuid primary key);
create function auth.uid() returns uuid language sql stable as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
$$;
grant usage on schema auth to anon, authenticated, service_role;
grant execute on function auth.uid() to anon, authenticated, service_role;
-- Exercise Supabase-style permissive defaults: migrations MUST override them.
alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
