import type { NextAuthConfig } from "next-auth";

/**
 * Edge-safe Auth.js config (no database access). Used by proxy.ts and merged
 * into the full config in auth.ts.
 */
export const authConfig = {
  pages: {
    signIn: "/login",
  },
  session: {
    strategy: "jwt",
    maxAge: 60 * 60 * 12, // 12 hours
  },
  trustHost: true,
  providers: [],
  callbacks: {
    jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = user.role;
      }
      return token;
    },
    session({ session, token }) {
      if (token) {
        session.user.id = token.id as string;
        session.user.role = token.role as "ADMIN" | "MANAGER" | "MEMBER";
      }
      return session;
    },
  },
} satisfies NextAuthConfig;
