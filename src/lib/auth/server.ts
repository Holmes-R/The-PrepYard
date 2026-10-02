import "server-only";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { googleConfigured, validStudentId } from "./policy.mjs";
export async function currentUser() {
  if (!googleConfigured()) return null;
  try {
    const session = await auth();
    return validStudentId(session?.user?.id) ? session!.user : null;
  } catch {
    return null;
  }
}
export async function requireUser() {
  const user = await currentUser();
  if (!user) redirect("/login");
  return user;
}
