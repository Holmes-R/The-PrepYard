# Gmail API for PrepYard verification emails

This setup sends verification and password-reset emails from the PrepYard Gmail mailbox through HTTPS. It works on Render Free without a custom domain. Only the mailbox owner authorizes Google access; student login stays email/password. An existing Gmail App Password is not an OAuth client secret or refresh token.

## 1. Enable Gmail API

1. Sign in to [Google Cloud Console](https://console.cloud.google.com/) with the account that will administer the email sender.
2. Create/select a project named **PrepYard Mail**.
3. Open **APIs & Services → Library**, search **Gmail API**, and enable it.

## 2. Configure owner-only OAuth

1. Open **Google Auth Platform** (or **APIs & Services → OAuth consent screen**).
2. Set the app name to **PrepYard Mail**, support email and developer contact email to an inbox you control. Choose **External** for a normal Gmail account.
3. In **Data Access**, add only this send-only scope:

```text
https://www.googleapis.com/auth/gmail.send
```

Do not request inbox read, modify or full-mailbox permissions. While the project is in Testing, add the PrepYard sender mailbox as a test user under **Audience**.

4. Before long-term deployment, review **Audience → Publishing status**. External projects left in Testing issue Gmail refresh tokens that normally expire after seven days. Move the owner-only mail client to production when ready and satisfy any Google verification requirements shown in the console. Google documents a personal-use exception for a limited group of known authorizing accounts; whether it applies depends on your actual OAuth usage. Do not turn this owner setup into a public Google authorization feature for students.

## 3. Create the OAuth client

1. Open **Clients → Create client**, or **APIs & Services → Credentials → Create credentials → OAuth client ID**.
2. Choose **Web application** and name it **PrepYard Mail Sender**.
3. Add this exact authorized redirect URI:

```text
https://developers.google.com/oauthplayground
```

4. Save the **Client ID** and **Client secret** privately. They become `GMAIL_CLIENT_ID` and `GMAIL_CLIENT_SECRET`.

## 4. Authorize the sender and obtain a refresh token

1. Open Google's [OAuth Playground](https://developers.google.com/oauthplayground/).
2. In its settings, enable **Use your own OAuth credentials** and enter the client ID and secret from step 3. Keep the Google server-side flow, access type **Offline**, and force prompt **Consent Screen**.
3. Enter the send-only scope from step 2 and authorize it **as the PrepYard sender mailbox**, not another Google account.
4. Read and complete Google's consent flow yourse`xlf. This grants the sender access; no student should complete this step. If Google blocks authorization, resolve its console requirements rather than changing scopes or weakening account protections.
5. In Playground Step 2, exchange the authorization code and copy the **Refresh token** privately. Store that as `GMAIL_REFRESH_TOKEN` in Render.

Use your own client credentials: tokens made with Playground's shared client are revoked after 24 hours. Store the refresh token, not the short-lived access token. If you authorize while the project is in Testing, obtain a fresh refresh token after its publishing status is changed. Tokens can also be revoked after account/security changes, so they are not guaranteed to last forever.

## 5. Add the Render settings

| Variable              | Value                                        |
| --------------------- | -------------------------------------------- |
| `AUTH_EMAIL_PROVIDER` | `gmail-api`                                  |
| `GMAIL_USER`          | The exact Gmail mailbox authorized in step 4 |
| `GMAIL_CLIENT_ID`     | Your OAuth client ID                         |
| `GMAIL_CLIENT_SECRET` | Your OAuth client secret                     |
| `GMAIL_REFRESH_TOKEN` | The owner-authorized refresh token           |

The deployment's `AUTH_URL` is set to its assigned HTTPS URL by the Render start command. No Gmail App Password, Resend key or sender domain is needed for this provider. Keep credentials server-only; do not paste them into chat, Git, or `NEXT_PUBLIC_*` settings.

## 6. Test delivery

After deployment, register a test account with an inbox you control. Confirm that the verification mail comes from the authorized PrepYard mailbox and points to the deployed HTTPS site. Verify the account, then test password reset. Check the sender's Sent folder and Render logs when diagnosing failures. Gmail's sending/API limits still apply; this is a small-project sender, not unlimited bulk email.

If authorization fails, confirm the client/refresh token belong to the same project, the sender authorized `gmail.send`, Gmail API is enabled and the token is current. Reauthorize the sender if access was revoked. A configured-but-expired token is not automatically replaced with SMTP or another provider.

Sources: [Gmail sending API](https://developers.google.com/workspace/gmail/api/reference/rest/v1/users.messages/send), [Google OAuth Playground](https://developers.google.com/oauthplayground/), [OAuth token expiry rules](https://developers.google.com/identity/protocols/oauth2/), [Google verification requirements and exceptions](https://developers.google.com/identity/protocols/oauth2/production-readiness/sensitive-scope-verification).
