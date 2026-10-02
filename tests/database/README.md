# Database integration tests

Run pnpm db:test only against an empty, disposable loopback PostgreSQL 17 instance. See [database guide](../../docs/database.md).

bootstrap.sql is TEST ONLY. It creates minimal Supabase auth/role objects and deliberately permissive default table grants so migrations must revoke them.

policies.sql executes real role-switched assertions in a rolled-back transaction. It covers grants, row-level access, ownership, catalogue visibility, constraints, publication, rollback, and deletion behaviour. SQL failures stop the runner and fail CI.

These tests do not replace hosted Supabase authentication/API verification. Do not run bootstrap.sql on an existing Supabase project.
