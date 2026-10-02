# Authentication

Supabase SSR cookie sessions protect every application route through `src/proxy.ts`. Protected layouts and sensitive endpoints also verify the current user on the server. Sign-in, registration, and email confirmation are the only application exceptions. Missing environment configuration fails closed. See the root README for project and email-template setup.
