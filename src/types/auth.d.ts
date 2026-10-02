import "next-auth";
import type { DefaultSession } from "next-auth";
declare module "next-auth" {
  interface User {
    passwordVersion?: number;
  }
  interface Session {
    user: DefaultSession["user"] & { id: string };
  }
}
declare module "next-auth/jwt" {
  interface JWT {
    studentId?: string;
    passwordVersion?: number;
  }
}
