import type { DefaultSession } from "next-auth";

export type ManagerRole = "ADMIN" | "MANAGER";
export type SessionRole = "ADMIN" | "MANAGER" | "MEMBER";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      role: SessionRole;
    } & DefaultSession["user"];
  }

  interface User {
    role: SessionRole;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id?: string;
    role?: SessionRole;
  }
}
