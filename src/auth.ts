import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import {
  authenticatePassword,
  passwordSessionValid,
} from "@/lib/auth/password-server";
import { safeDestination, validStudentId } from "@/lib/auth/policy.mjs";
export const { handlers, auth, signIn, signOut } = NextAuth(() => ({
  providers: [
    Credentials({
      credentials: { email: { type: "email" }, password: { type: "password" } },
      authorize: async (credentials) =>
        authenticatePassword(credentials.email, credentials.password),
    }),
  ],
  secret: process.env.AUTH_SECRET,
  session: { strategy: "jwt", maxAge: 24 * 60 * 60 },
  pages: { signIn: "/login", error: "/login" },
  callbacks: {
    signIn({ account, user }) {
      return account?.provider === "credentials" && validStudentId(user.id);
    },
    async jwt({ token, account, user }) {
      if (account?.provider === "credentials") {
        token.studentId = user.id;
        token.passwordVersion = user.passwordVersion;
      }
      if (
        typeof token.passwordVersion !== "number" ||
        !validStudentId(token.studentId) ||
        !(await passwordSessionValid(token.studentId, token.passwordVersion))
      )
        return null;
      return token;
    },
    session({ session, token }) {
      if (session.user && validStudentId(token.studentId))
        session.user.id = token.studentId;
      return session;
    },
    redirect({ url, baseUrl }) {
      try {
        const parsed = new URL(url, baseUrl);
        if (parsed.origin === new URL(baseUrl).origin)
          return new URL(
            safeDestination(parsed.pathname + parsed.search),
            baseUrl,
          ).href;
      } catch {
        /* Reject malformed callback URLs. */
      }
      return new URL("/dashboard", baseUrl).href;
    },
  },
}));
