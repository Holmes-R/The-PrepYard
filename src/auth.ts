import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import {
  googleConfigured,
  safeDestination,
  verifiedGoogleIdentity,
  validStudentId,
} from "@/lib/auth/policy.mjs";
import { registerGoogleStudent } from "@/lib/database/server";
export const { handlers, auth, signIn, signOut } = NextAuth(() => ({
  providers: googleConfigured()
    ? [
        Google({
          clientId: process.env.AUTH_GOOGLE_ID,
          clientSecret: process.env.AUTH_GOOGLE_SECRET,
          authorization: {
            params: { scope: "openid email profile", prompt: "select_account" },
          },
        }),
      ]
    : [],
  secret: process.env.AUTH_SECRET,
  session: { strategy: "jwt", maxAge: 24 * 60 * 60 },
  pages: { signIn: "/login", error: "/login" },
  callbacks: {
    signIn({ account, profile }) {
      return googleConfigured() && verifiedGoogleIdentity(profile, account);
    },
    async jwt({ token, account, profile }) {
      if (account) {
        if (!verifiedGoogleIdentity(profile, account))
          throw new Error("Verified Google identity required.");
        token.studentId = await registerGoogleStudent(
          String(profile!.sub),
          String(profile!.email),
          String(profile!.name || ""),
        );
      }
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
