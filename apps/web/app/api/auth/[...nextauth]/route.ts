import { authOptions } from "@/lib/routeverity/auth";
import NextAuth from "next-auth";
import type { NextRequest } from "next/server";

const handler = async (
  request: NextRequest,
  context: { params: Promise<{ nextauth: string[] }> },
) => NextAuth(authOptions())(request, { params: await context.params });

export { handler as GET, handler as POST };
