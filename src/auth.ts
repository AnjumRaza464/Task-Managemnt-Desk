import NextAuth, { CredentialsSignin } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { authConfig } from "@/auth.config";
import { prisma } from "@/lib/prisma";
import { startWorkSession } from "@/lib/attendance";

class InvalidCredentials extends CredentialsSignin {
  code = "invalid_credentials";
}

class InactiveAccount extends CredentialsSignin {
  code = "inactive";
}

// The identifier is matched against User.email but need not be a valid email
// address, so a plain username such as "admin" can sign in too.
const credentialsSchema = z.object({
  email: z.string().trim().toLowerCase().min(1),
  password: z.string().min(1),
});

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(raw) {
        const parsed = credentialsSchema.safeParse(raw);
        if (!parsed.success) throw new InvalidCredentials();

        const { email, password } = parsed.data;
        const user = await prisma.user.findUnique({ where: { email } });

        // Any active account with a password may sign in; members get a read-only view.
        if (!user || !user.passwordHash) {
          throw new InvalidCredentials();
        }
        if (!user.isActive) throw new InactiveAccount();

        const ok = await bcrypt.compare(password, user.passwordHash);
        if (!ok) throw new InvalidCredentials();

        // Check-in: every successful sign-in opens a tracked work session.
        const loginId = await startWorkSession(user.id);

        return {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          loginId,
        };
      },
    }),
  ],
});
