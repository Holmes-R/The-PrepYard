import "server-only";
import { AsyncLocalStorage } from "node:async_hooks";
import { cache } from "react";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { authConfigured, validStudentId } from "./policy.mjs";

async function readUser() {
  if (!authConfigured()) return null;
  try {
    const session = await auth();
    return validStudentId(session?.user?.id) ? session!.user : null;
  } catch {
    return null;
  }
}

// React cache covers server renders; AsyncLocalStorage covers route handlers.
// Each request owns its promise. Never cache identities across requests.
const renderUser = cache(readUser);
const authRequest = new AsyncLocalStorage<{
  user?: ReturnType<typeof readUser>;
}>();
export function withAuthRequest<T>(operation: () => Promise<T>) {
  return authRequest.run({}, operation);
}
export function currentUser() {
  const request = authRequest.getStore();
  return request ? (request.user ??= readUser()) : renderUser();
}
export async function requireUser() {
  const user = await currentUser();
  if (!user) redirect("/login");
  return user;
}
