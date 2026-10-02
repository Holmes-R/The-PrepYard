# Google sign-in without Supabase Auth

Google OAuth is handled by Auth.js. The website never asks for a Google password, stores passwords, or connects to Supabase Auth. Supabase can still host PostgreSQL, or an existing compatible PostgreSQL deployment can host the data. Google authenticates students on its own domain; our callback creates an internal student UUID and an encrypted session cookie.

## Configure Google

1. Open https://console.cloud.google.com/ and create or select a project.
2. Open Google Auth Platform (or APIs & Services → OAuth consent screen). Configure branding, audience, and application contact details.
3. For an external application in testing, add your Google account to Test users.
4. Create an OAuth client with application type Web application.
5. Set the authorized JavaScript origin to `http://localhost:3000`.
6. Set the authorized redirect URI to `http://localhost:3000/api/auth/callback/google`. This must match exactly. The former Supabase confirmation URL is not used.
7. Copy the client ID and client secret into `.env.local`. Never commit them.

```dotenv
AUTH_URL=http://localhost:3000
AUTH_SECRET=YOUR_RANDOM_SECRET
AUTH_GOOGLE_ID=YOUR_GOOGLE_CLIENT_ID
AUTH_GOOGLE_SECRET=YOUR_GOOGLE_CLIENT_SECRET
DATABASE_URL=postgresql://prepyard_web:YOUR_URL_ENCODED_PASSWORD@YOUR_DATABASE_HOST:5432/postgres
```

Generate a secret locally with `node -e "console.log(require('node:crypto').randomBytes(32).toString('base64url'))"`, and put the result in AUTH_SECRET. Never use your Google account password for any variable. AUTH_SECRET, Google client secret, and DATABASE_URL are server-only. Remove obsolete Supabase Auth variables when convenient; the application ignores them. Configure a certificate-verified TLS connection for a hosted database. Do not disable certificate verification to solve connection failures. When using a Supabase pooler, construct the custom-role username using the connection settings for that project, typically `prepyard_web.PROJECT_REF`; the database session must resolve to role `prepyard_web`.

## Apply the identity migration

Apply all five migrations in order using the existing tracked migration workflow. Migration 5 preserves legacy user UUIDs and reattaches student records to private.students. It replaces policy calls to auth.uid() with the transaction-local application identity. Earlier migration files remain unchanged for already-deployed projects. Supabase-managed auth objects are not dropped or altered; the application no longer uses them.

The migration creates `prepyard_web` as NOLOGIN/NOINHERIT without superuser or RLS-bypass privileges. Using a trusted database administration connection, provision its login password privately:

```sql
ALTER ROLE prepyard_web LOGIN PASSWORD 'YOUR_STRONG_DATABASE_PASSWORD';
```

Use a freshly generated database password, not a Google password. Do not commit this statement with a real password. It is the role used in DATABASE_URL. Use the administrative connection only for migrations/import maintenance; the website rejects postgres, service_role, and other privileged database logins.

For a fresh plain PostgreSQL installation, the historical migrations expect Supabase-style auth objects and roles. A separate production-ready bootstrap/migration workflow is still needed; tests/database/bootstrap.sql is test-only and must not be used for production.

## Identity and private records

Only a verified Google identity can sign in. The Google subject is the stable account key. An email changing does not create a new account; two subjects with the same email do not merge. Legacy Supabase accounts are retained with their existing UUIDs, but are not automatically linked to Google by email. If existing students have saved work, implement an explicit ownership-verification migration before moving those accounts. Do not delete the legacy records.

The callback uses a narrowly scoped database function to register or resolve a student. No Google access or refresh token is stored in the database or exposed through the application session. Sessions use encrypted Auth.js JWT cookies, with a one-day maximum lifetime, and are checked on protected pages and endpoints. Browser sign-out clears the session; already-issued copied tokens are not centrally revoked before expiry. Account revocation/session administration is a later feature.

Private queries use `withStudentDatabase`, which derives the student ID internally from the verified server session. The helper checks the restricted login, starts a transaction, sets the authenticated database role and student identity locally, executes parameterized queries, and commits or rolls back before releasing the connection. Browser-supplied user IDs are never trusted. Authenticated is now a database permission role, not a Supabase session. Anonymous catalogue access and student access to source/snapshot/import metadata remain denied. Clients must not call PostgREST with an Auth.js token; all student database operations go through this server boundary.

## Run and verify

1. Install dependencies with `pnpm install --frozen-lockfile`.
2. Configure the new environment values and apply migration 5.
3. Restart with `pnpm dev` and open `/login`.
4. Click Continue with Google, choose a test account, and finish Google's consent flow.
5. Verify the dashboard is accessible and sign-out returns to login.
6. Test with a second account; private records must remain isolated.
7. Run `pnpm check`. The access tests cover the missing-configuration path and valid encrypted sessions and tampered/expired cookie denial, independent of real Google credentials. Run `pnpm db:test` against a fresh disposable PostgreSQL cluster for ownership and migration tests.

Missing credentials disable the sign-in entry point and deny protected access. There is no separate signup form: the first successful Google login creates the account. `/signup` redirects to `/login`; the former `/auth/confirm` route has been removed.

## Deployment

Set AUTH_URL to the exact deployed application URL and add its `/api/auth/callback/google` redirect URI to Google. Use HTTPS, set production credentials and the restricted DATABASE_URL, and rebuild. Move the Google application out of testing when ready and complete any verification requirements Google displays. The Google client credentials must be configured by the owner; no actual Google account/password is ever requested by The PrepYard.

Auth.js is pinned to the installed v5 beta release; review release changes before upgrading. Actual live Google consent/callback verification requires Google credentials and a configured database and has not been performed automatically.

References: [Auth.js Google provider](https://authjs.dev/getting-started/providers/google), [Google OAuth](https://developers.google.com/identity/protocols/oauth2/web-server), [PostgreSQL transactions](https://node-postgres.com/features/transactions).
