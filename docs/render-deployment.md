# Deploy PrepYard on Render Free

Render hosts the Next.js web service. Keep the existing Supabase PostgreSQL database and its published catalogue. Verification and password-reset emails use Google's Gmail API over HTTPS, because Render Free blocks SMTP ports 25, 465 and 587.

The repository's `render.yaml` configures Node 22, the pinned pnpm version from `package.json`, the Singapore region, the Free compute plan and automatic deployment after GitHub checks pass. No Render database is created, and deployments never run migrations or import jobs automatically.

## 1. Authorize the Gmail sender

Complete the [Gmail API sender setup](gmail-api-email.md): enable Gmail API in Google Cloud, configure the owner-only send permission, create an OAuth client and obtain a refresh token for the PrepYard mailbox. No domain purchase is needed. Your students continue to use PrepYard email/password login.

Keep the sender mailbox, client ID, client secret and refresh token ready for Render. A Gmail App Password cannot be used as these OAuth credentials. Do not leave a long-running sender dependent on a seven-day Testing token; the sender guide explains publishing status, verification requirements and token renewal.

## 2. Prepare the existing database connection

In Supabase, open **Connect → Session pooler**. Use the restricted application's database login, not the administrator or service role:

```text
postgresql://prepyard_web.PROJECT_REF:URL_ENCODED_ROLE_PASSWORD@POOLER_HOST:5432/postgres?sslmode=verify-full
```

Use the host, port and database from your own project. URL-encode the role password. Keep TLS verification enabled. Do not run migrations again merely to deploy this existing database.

If your working connection string has a Windows `sslrootcert` path, that file will not exist on Render. Upload the Supabase CA certificate as a **Secret File** named `supabase-ca.pem` in the service settings, and change only that parameter to `sslrootcert=%2Fetc%2Fsecrets%2Fsupabase-ca.pem`. Use the certificate downloaded from your own Supabase project's SSL settings. No CA file is needed if the selected pooler certificate is already trusted by Node's certificate store.

If database network restrictions are enabled, allow the service's outbound addresses shown by Render. The runtime connection remains `prepyard_web`; do not solve a connection failure by switching to `postgres` or weakening TLS checks.

## 3. Publish the updated code

Commit the deployment files and intended application changes, and push them to the repository's `main` branch. A local build alone does not update GitHub or Render. Check that `.env.local` and real credentials are not staged.

## 4. Create the Render Blueprint

1. Sign in to [Render](https://dashboard.render.com/).
2. Choose **New → Blueprint**. Connect GitHub and select **Holmes-R/The-PrepYard**, branch `main`, with `render.yaml` at the repository root. If Render asks for GitHub repository access, grant access only to the repository you intend to deploy.
3. Review the **the-prepyard** web service: **Free**, **Node**, **Singapore**. The existing database is in Southeast Asia; if your database is in another region, select the closest service region before creating it.
4. Provide the five prompted environment values directly in Render:

| Key                   | Value                                                   |
| --------------------- | ------------------------------------------------------- |
| `DATABASE_URL`        | Your restricted Supabase Session pooler URL from step 2 |
| `GMAIL_USER`          | The Gmail mailbox you authorized                        |
| `GMAIL_CLIENT_ID`     | Your Google OAuth client ID                             |
| `GMAIL_CLIENT_SECRET` | Your Google OAuth client secret                         |
| `GMAIL_REFRESH_TOKEN` | The sender-authorized refresh token                     |

The Blueprint generates a production `AUTH_SECRET` and sets `AUTH_TRUST_HOST=true`, `AUTH_EMAIL_PROVIDER=gmail-api`, `NODE_VERSION=22`, `NODE_ENV=production` and `NEXT_TELEMETRY_DISABLED=1`. Leave the generated secret stable across redeploys to keep sessions valid. No Gmail App Password or Resend credentials are needed on this service.

5. Choose **Deploy Blueprint**. Follow **Events** and **Logs** until the service is live. Use the actual `onrender.com` URL Render assigns, rather than assuming a service name is an available URL.

The start command uses that assigned URL as `AUTH_URL` automatically. On Render, `RENDER_EXTERNAL_URL` is provided by the platform. If you add a custom domain later, set `AUTH_URL` to your exact public HTTPS origin and restart the service.

### Creating a Web Service manually instead

Select **New → Web Service**, choose the same repository and `main`, and leave Root Directory empty. Use the Free plan, Node runtime and Singapore region:

```sh
# Build Command (enter in Render, not PowerShell)
corepack pnpm install --frozen-lockfile --prod=false && corepack pnpm build

# Start Command (enter in Render, not PowerShell)
AUTH_URL="${AUTH_URL:-$RENDER_EXTERNAL_URL}" corepack pnpm exec next start --hostname 0.0.0.0 --port "$PORT"
```

Use `/login` for the Health Check Path. This checks HTTP readiness without exposing account data. `/api/health` deliberately still requires authentication, so it must not be used for Render's anonymous health probes. Add all environment values listed above; generate your own `AUTH_SECRET` locally with `node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"` and paste it directly in Render. Do not set `PORT`; Render supplies it. Enable automatic deploys after CI checks pass.

## 5. Verify the live service

1. Open the assigned HTTPS URL. The landing page and login form should load.
2. Sign up using an inbox you control. The verification email must link to this deployment, not `localhost`.
3. Verify the account, log in and open companies/patterns. They should show the existing published database catalogue.
4. Save a note, mark a question solved, then sign out and in. Your state should remain saved.
5. Request a password reset, verify its link uses the public HTTPS origin and log in with the changed password.
6. Check that an anonymous `/api/companies` request gets 401 and protected pages redirect to login.

These checks create real account/email activity. Run them yourself with a test inbox; automated unit tests use fake mail responses and do not send messages.

## Operating limits and updates

Free web services sleep after 15 minutes without traffic. The next visit can take roughly a minute to wake the server. This is a hosting cold start, not a frontend rendering issue. For consistently fast public access, change to an always-on paid service later.

The filesystem is temporary. Accounts, notes, catalogue and progress remain in Supabase; do not store application data on Render's local disk. Gmail sending and API limits apply. If authorization expires/revokes or limits are reached, signup/reset email requests can fail; check the sender setup, Google project and Render logs.

Future updates deploy from `main` after GitHub checks pass. If a deploy does not start, check both CI and the service's auto-deploy setting. Review migration changes separately before applying them to the production database. Keep secrets in Render's environment settings, never GitHub source or `NEXT_PUBLIC_*` variables.

References: [Render Next.js deployment](https://render.com/docs/deploy-nextjs-app), [Render Free limitations](https://render.com/docs/free), [Render environment variables](https://render.com/docs/configure-environment-variables), [Gmail sending API](https://developers.google.com/workspace/gmail/api/reference/rest/v1/users.messages/send).

## Optional Resend provider

Resend support remains available if you later obtain a sending domain: choose `AUTH_EMAIL_PROVIDER=resend`, set `RESEND_API_KEY` and `AUTH_EMAIL_FROM`, and verify the domain in Resend. The `onboarding@resend.dev` test sender only delivers to your own Resend account address. This optional provider is not selected by the Render Blueprint.
