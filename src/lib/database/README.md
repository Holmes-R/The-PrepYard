# Server database boundary

Direct PostgreSQL access uses the restricted prepyard_web login. Never connect application queries as postgres or service_role. withStudentDatabase derives identity internally from the verified server session, sets the authenticated role and identity within one transaction, and returns the connection after commit/rollback. Callers must use parameterized queries and never take ownership IDs from the browser. Database grants and policies still hide import provenance. See docs/google-sign-in.md.
