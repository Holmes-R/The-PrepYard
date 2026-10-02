# Database boundary

Versioned schema and access policies live in supabase/migrations. See [database guide](../../../docs/database.md).

The schema is implemented; the application is not connected to Supabase yet. Add server/browser clients and generate TypeScript types from the applied schema during integration. Do not hand-maintain types that can drift from SQL. Keep privileged service credentials out of browser code.
