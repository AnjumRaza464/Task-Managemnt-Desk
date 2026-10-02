import NextAuth, { CredentialsSignin } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { authConfig } from "@/auth.config";
import { prisma } from "@/lib/prisma";

class InvalidCredentials extends CredentialsSignin {
  code = "invalid_credentials";
}

class InactiveAccount extends CredentialsSignin {
  code = "inactive";
}

const credentialsSchema = z.object({
  email: z.email().trim().toLowerCase(),
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

        return {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
        };
      },
    }),
  ],
});
