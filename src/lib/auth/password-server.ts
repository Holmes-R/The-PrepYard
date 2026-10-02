import "server-only";
import { connection } from "@/lib/database/server";
import { normalizeEmail, verifyPassword, tokenDigest } from "./password.mjs";
export async function authQuery<T extends import("pg").QueryResultRow>(
  sql: string,
  values: unknown[],
) {
  const client = await connection();
  try {
    return (await client.query<T>(sql, values)).rows;
  } finally {
    client.release();
  }
}
export async function allowedAttempt(
  kind: string,
  key: string,
  maximum: number,
  seconds: number,
) {
  const global = await authQuery<{ ok: boolean }>(
    "select private.auth_attempt($1,$2,$3) as ok",
    [kind + ":global", 300, 60],
  );
  if (!global[0].ok) return false;
  const rows = await authQuery<{ ok: boolean }>(
    "select private.auth_attempt($1,$2,$3) as ok",
    [kind + ":" + tokenDigest(key), maximum, seconds],
  );
  return rows[0].ok;
}
export async function authenticatePassword(
  rawEmail: unknown,
  password: unknown,
) {
  const email = normalizeEmail(rawEmail);
  if (!email) return null;
  if (!(await allowedAttempt("login", email, 10, 900))) return null;
  const rows = await authQuery<{
    id: string;
    email: string;
    name: string;
    password_hash: string;
    version: number;
  }>("select * from private.password_identity($1)", [email]);
  const identity = rows[0];
  if (!(await verifyPassword(password, identity?.password_hash)) || !identity)
    return null;
  return {
    id: identity.id,
    email: identity.email,
    name: identity.name,
    passwordVersion: identity.version,
  };
}
export async function passwordSessionValid(id: string, version: number) {
  const rows = await authQuery<{ ok: boolean }>(
    "select private.password_session($1,$2) as ok",
    [id, version],
  );
  return rows[0].ok;
}
