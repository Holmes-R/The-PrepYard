# Email and password authentication

## Setup

1. Apply all migrations in filename order. For an existing Google setup, apply only the new migration `supabase/migrations/20261002000600_password_identity.sql` using your PostgreSQL administrator (for example, Supabase SQL Editor). Keep the app's DATABASE_URL on the restricted prepyard_web login.
2. Keep AUTH_SECRET, DATABASE_URL and AUTH_URL. AUTH_URL is http://localhost:3000 locally; use your exact HTTPS origin in production. Google OAuth is no longer supported.
3. Enable 2-Step Verification on the Gmail account, then create a Google App Password. Set GMAIL_USER to that account and GMAIL_APP_PASSWORD to the app password in the ignored .env.local and in the production environment. Use the app password, not the regular Google account password; spaces in the copied app password are ignored. Never paste secrets into Git or a browser bundle. See https://support.google.com/accounts/answer/185833 and https://support.google.com/accounts/answer/185839 .
4. Restart with pnpm dev. Visit /signup, enter your name, email and a new PrepYard password (12–128 characters), then confirm it.
5. Open the verification email and click Verify email on the page. Sign in at /login. Unverified registrations cannot log in. To resend verification, submit signup again with the desired password; the latest link replaces the older one. Pending registrations create no student account until confirmed.
6. Test /forgot-password, open the reset email and set a new password. Old password sessions are rejected on their next request. Log in again with the new password. Legacy Google sessions are rejected.

## Behaviour and protection

- Node scrypt (N=32768, r=8, p=1), random salts and timing-safe comparisons; no plaintext password storage. Previously created Google accounts and their saved work are preserved, but Google login is disabled. Those accounts need a separately designed ownership-verification migration to acquire a password without losing their identity; registering again creates a separate account.
- Database-backed account and global attempt limits work across application processes. Login: 10 per email per 15 minutes. Email: 5 per email per hour. Token completion: 5 per token per 15 minutes. Global per-operation ceiling: 300 per minute. These conservative limits can temporarily block legitimate users under abuse; tune and add provider/WAF controls as traffic grows.
- 256-bit random verification/reset tokens; only SHA-256 digests stored. One active token per email/purpose; single-use consumption in the database. Verify links expire in 1 hour, reset links in 30 minutes. GET requests never consume links, so email scanners cannot verify/reset accounts. Fragments keep tokens out of server access logs; the client removes the fragment after reading it.
- Private tables use RLS and cannot be read directly by prepyard_web, anon or authenticated. Narrow security-definer functions are executable by the trusted server login only. Student ownership policies are unchanged.
- Password changes increment a credential version checked by the request guard and Auth.js. Authentication errors never return hashes, tokens or database messages. Unknown and existing accounts get the same normal email-request response. Provider delivery failures return a generic temporary failure; operational timing/delivery differences are not an enumeration-proof guarantee.
- Auth.js handles login CSRF; Next.js Server Actions validate same-origin requests. Production requires HTTPS and a trusted AUTH_URL. No cross-provider account linking is implemented.

## Verification

Run pnpm test:auth, pnpm lint, pnpm typecheck, pnpm build, then pnpm test:access. Run pnpm db:test only against a fresh disposable local PostgreSQL cluster, as documented in docs/database.md. Tests must cover token expiry/replay, unverified denial, restricted permissions, version revocation and password verification. Actual mailbox delivery and a real Google callback require your configured external services.

For the real HTTP credentials flow after building and migrating the disposable cluster, set `PREPYARD_AUTH_TEST_DATABASE_URL` to its administrator connection URL (loopback host, database ending in `_test`) and run `node tests/auth/password-flow.mjs`. This starts a test server on port 3114, creates and removes a test account, and verifies CSRF denial, login, reset revocation, and attempt limits without sending email. The test cluster must allow the `prepyard_web` test login to connect.

Apply migration 7 (`20261002000700_remove_google_sign_in.sql`) after migration 6. It removes the Google registration function while preserving existing records. Remove unused AUTH_GOOGLE_ID and AUTH_GOOGLE_SECRET deployment variables. Gmail SMTP sends verification and password-reset email from the configured Gmail account.

## Recovering JWT session errors

Auth.js logs JWTSessionError internally; a try/catch around auth() cannot prevent that message. Expired, tampered, unsupported legacy, or old-secret cookies are now removed from the forwarded request and expired by the proxy, including numbered cookie chunks. CSRF and other cookies are preserved. Database failures still deny access, but do not cause the proxy to delete a cryptographically valid cookie.

Keep AUTH_SECRET stable across restarts and deployment instances. After intentional secret rotation, users must log in again. Restart pnpm dev after environment changes.

A JWTSessionError can also wrap a database exception from password-session validation. Check the nested cause. ECONNREFUSED means the configured database endpoint refused the connection; running a local PostgreSQL service does not help when DATABASE_URL points to Supabase. Verify project availability and the current Session pooler host and port in Supabase Connect. Check network restrictions and banned IPs; Supabase documents that failed password attempts may temporarily block an IP: https://supabase.com/docs/guides/troubleshooting/error-connection-refused-when-trying-to-connect-to-supabase-database-hwG0Dr . Preserve the restricted prepyard_web login; never substitute the administrator account in the application runtime URL. Do not share the URL or password in logs.

For `SELF_SIGNED_CERT_IN_CHAIN`, download the database CA certificate from Supabase **Database Settings → SSL Configuration** and save it outside the repository. Add its URL-encoded absolute path as the `sslrootcert` query parameter in `DATABASE_URL`, keeping `sslmode=verify-full`; the PostgreSQL client will use that CA to verify the server certificate and hostname. Restart `pnpm dev`. Do not use `sslmode=no-verify` or disable certificate verification.
