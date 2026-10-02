# Google authentication

Google OAuth through Auth.js replaces Supabase Auth. No password or OTP forms remain. The callback accepts verified Google identities only and resolves an application UUID by Google subject. Sessions use encrypted Auth.js JWT cookies with a one-day lifetime. Protected pages, APIs, and student database operations verify server-side identity. See docs/google-sign-in.md for setup and migration details.
