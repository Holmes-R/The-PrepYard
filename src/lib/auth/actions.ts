"use server";
import { redirect } from "next/navigation";
import { signOut as endSession } from "@/auth";
import { authConfigured } from "./policy.mjs";
export type AuthState = { message: string; success?: boolean };
export async function signOut() {
  if (authConfigured()) await endSession({ redirect: false });
  redirect("/login");
}
