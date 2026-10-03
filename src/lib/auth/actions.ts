"use server";
import { signOut as endSession } from "@/auth";
import { authConfigured } from "./policy.mjs";
export type AuthState = { message: string; success?: boolean };
export async function signOut() {
  if (authConfigured()) await endSession({ redirectTo: "/login" });
}
