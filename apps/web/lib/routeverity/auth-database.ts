import { databaseOptions } from "@/lib/prisma/options";
import { PrismaClient } from "@prisma/client";

declare global {
  var routeverityAuthDatabase: PrismaClient | undefined;
}

// NextAuth's adapter requires the standard client type, not Prisma's omit extension.
export const authDatabase =
  global.routeverityAuthDatabase ?? new PrismaClient(databaseOptions());
if (process.env.NODE_ENV !== "production")
  global.routeverityAuthDatabase = authDatabase;
