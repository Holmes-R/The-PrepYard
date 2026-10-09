import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { authConfigured, validStudentId } from "./policy.mjs";
export const currentUser = cache(async function currentUser() {
  if (!authConfigured()) return null;
  try {
    const session = await auth();
    return validStudentId(session?.user?.id) ? session!.user : null;
  } catch {
    return null;
  }
});
export async function requireUser() {
  const user = await currentUser();
  if (!user) redirect("/login");
  return user;
}
