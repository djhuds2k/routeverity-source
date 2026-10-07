import { prisma } from "@/lib/prisma";
import { PrismaAdapter } from "@next-auth/prisma-adapter";
import { getServerSession, type NextAuthOptions } from "next-auth";
import EmailProvider from "next-auth/providers/email";
import { redirect } from "next/navigation";
import { z } from "zod";
import { authDatabase } from "./auth-database";
import { requiredEnv } from "./environment";
import { allowRequest } from "./rate-limit";

export function authOptions(): NextAuthOptions {
  return {
    adapter: PrismaAdapter(authDatabase),
    secret: requiredEnv("NEXTAUTH_SECRET"),
    session: { strategy: "database", maxAge: 7 * 24 * 60 * 60 },
    providers: [
      EmailProvider({
        server: requiredEnv("EMAIL_SERVER"),
        from: requiredEnv("EMAIL_FROM"),
        maxAge: 15 * 60,
      }),
    ],
    pages: {
      signIn: "/login",
      verifyRequest: "/login/check-email",
      error: "/login",
    },
    callbacks: {
      async signIn({ user, email }) {
        if (email?.verificationRequest) {
          if (
            !z.string().email().max(254).safeParse(user.email).success ||
            !user.email
          )
            return false;
          return allowRequest("email", user.email.toLowerCase(), 5);
        }
        return true;
      },
      async session({ session, user }) {
        session.user.id = user.id;
        return session;
      },
    },
  };
}

export async function requireUser() {
  const session = await getServerSession(authOptions());
  if (!session?.user?.id) redirect("/login");
  return session.user;
}

export async function requireWorkspace(slug: string) {
  const user = await requireUser();
  const membership = await prisma.projectUsers.findFirst({
    where: { userId: user.id, project: { slug, disabledAt: null } },
    include: { project: true },
  });
  if (!membership) redirect("/app");
  return { user, workspace: membership.project, role: membership.role };
}
