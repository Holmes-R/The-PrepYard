# Authentication

Auth.js supports Google OAuth and verified email/password accounts. Passwords are separate PrepYard passwords. See [password setup](../../../docs/password-auth.md) and [Google setup](../../../docs/google-sign-in.md). All application pages require a session; only account entry, verification, recovery and Auth.js endpoints are public. Password sessions validate the current credential version so resets revoke them.
