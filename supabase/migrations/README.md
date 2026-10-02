# Database migrations

Apply files in timestamp order using Supabase migrations. No hosted database has been modified.

| File                                      | Purpose                                                                         |
| ----------------------------------------- | ------------------------------------------------------------------------------- |
| 20261002000100_catalogue.sql              | Catalogue identity, provenance, observations, import logs, indexes, constraints |
| 20261002000200_student_data.sql           | Sheets, progress, notes, practice events, correction reports                    |
| 20261002000300_access_and_publication.sql | Explicit grants, row policies, server-only atomic publication                   |

Each schema migration immediately enables RLS and revokes client privileges. The final migration grants only documented operations. Failure between migrations therefore remains closed to clients.

See [database guide](../../docs/database.md) for the access matrix, application workflow, test commands, and deployment instructions. Test-only auth stubs under tests/database must NEVER be applied to Supabase.
