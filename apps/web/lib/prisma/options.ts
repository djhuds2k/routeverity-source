import type { Prisma } from "@prisma/client";
import { X509Certificate } from "node:crypto";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

export function databaseOptions(): Prisma.PrismaClientOptions {
  const certificate = process.env.ROUTEVERITY_DATABASE_CA;
  if (certificate === undefined) return {};
  if (!certificate.trim())
    throw new Error(
      "ROUTEVERITY_DATABASE_CA must contain a PEM CA certificate.",
    );

  const ca = new X509Certificate(certificate);
  if (
    !ca.ca ||
    Date.parse(ca.validFrom) > Date.now() ||
    Date.parse(ca.validTo) <= Date.now()
  )
    throw new Error("ROUTEVERITY_DATABASE_CA must be a currently valid CA.");

  let url: URL;
  try {
    url = new URL(process.env.DATABASE_URL ?? "");
  } catch {
    throw new Error("DATABASE_URL must be a valid MySQL connection URL.");
  }
  if (
    url.protocol !== "mysql:" ||
    !url.hostname ||
    !url.username ||
    !url.password ||
    url.pathname === "/" ||
    !url.pathname
  )
    throw new Error("DATABASE_URL must identify a MySQL user and database.");

  if (
    url.searchParams.has("sslidentity") ||
    url.searchParams.has("sslpassword")
  )
    throw new Error(
      "Client-certificate MySQL authentication is not configured.",
    );

  const directory = mkdtempSync(join(tmpdir(), "routeverity-mysql-"));
  const path = join(directory, "ca.pem");
  writeFileSync(path, certificate, { mode: 0o600 });
  url.searchParams.delete("ssl-mode");
  url.searchParams.delete("sslmode");
  url.searchParams.set("sslcert", path);
  url.searchParams.set("sslaccept", "strict");
  return { datasources: { db: { url: url.toString() } } };
}
