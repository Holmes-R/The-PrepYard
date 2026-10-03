import "server-only";
import { Pool, type PoolClient } from "pg";
import { validStudentId } from "@/lib/auth/policy.mjs";
const shared = globalThis as typeof globalThis & { prepyardPool?: Pool };
function pool() {
  if (!process.env.DATABASE_URL)
    throw new Error("Database connection is not configured.");
  return (shared.prepyardPool ??= new Pool({
    connectionString: process.env.DATABASE_URL,
    max: 5,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 10000,
  }));
}
export async function connection() {
  const client = await pool().connect();
  try {
    const { rows } = await client.query(
      "select session_user as role, rolsuper, rolbypassrls, rolinherit from pg_roles where rolname=session_user",
    );
    const role = rows[0];
    if (
      !role ||
      role.role !== "prepyard_web" ||
      role.rolsuper ||
      role.rolbypassrls ||
      role.rolinherit
    )
      throw new Error("Use the restricted prepyard_web database login.");
    return client;
  } catch (error) {
    client.release();
    throw error;
  }
}
// The database identity is derived internally from the verified server session.
export async function withStudentDatabase<T>(
  operation: (client: PoolClient) => Promise<T>,
): Promise<T> {
  const { requireUser } = await import("@/lib/auth/server");
  const studentId = (await requireUser()).id;
  if (!validStudentId(studentId)) throw new Error("Invalid student identity.");
  const client = await connection();
  let broken = false;
  try {
    await client.query("begin");
    await client.query("set local role authenticated");
    await client.query("select set_config('prepyard.student_id',$1,true)", [
      studentId,
    ]);
    const result = await operation(client);
    await client.query("commit");
    return result;
  } catch (error) {
    try {
      await client.query("rollback");
    } catch {
      broken = true;
    }
    throw error;
  } finally {
    client.release(broken);
  }
}
