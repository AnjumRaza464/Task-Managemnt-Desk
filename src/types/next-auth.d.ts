import type { DefaultSession } from "next-auth";

export type ManagerRole = "ADMIN" | "CEO" | "MANAGER";
export type SessionRole = "ADMIN" | "CEO" | "MANAGER" | "MEMBER";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      role: SessionRole;
      /** Identifies the sign-in for attendance tracking (absent on tokens issued before tracking existed). */
      loginId?: string;
    } & DefaultSession["user"];
  }

  interface User {
    role: SessionRole;
    loginId?: string;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id?: string;
    role?: SessionRole;
    loginId?: string;
  }
}
