import { databaseOptions } from "@/lib/prisma/options";
import { mkdtempSync, writeFileSync } from "node:fs";
import { rootCertificates } from "node:tls";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("node:fs", () => ({
  mkdtempSync: vi.fn(() => "test-certificate-directory"),
  writeFileSync: vi.fn(),
}));

describe("database CA configuration", () => {
  beforeEach(() => {
    vi.stubEnv(
      "DATABASE_URL",
      "mysql://app:secret@database.example:3306/routeverity",
    );
    vi.stubEnv("ROUTEVERITY_DATABASE_CA", undefined);
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.clearAllMocks();
  });

  it("preserves existing configuration when no CA is supplied", () => {
    expect(databaseOptions()).toEqual({});
    expect(mkdtempSync).not.toHaveBeenCalled();
  });

  it("writes the CA outside source and enforces strict TLS", () => {
    vi.stubEnv("ROUTEVERITY_DATABASE_CA", rootCertificates[0]);
    vi.stubEnv(
      "DATABASE_URL",
      "mysql://app:secret@database.example:3306/routeverity?connection_limit=2&ssl-mode=REQUIRED&sslaccept=accept_invalid_certs",
    );
    const options = databaseOptions();
    const url = new URL(options.datasources!.db!.url!);
    expect(url.searchParams.get("sslaccept")).toBe("strict");
    expect(url.searchParams.get("sslcert")).toMatch(
      /test-certificate-directory/,
    );
    expect(url.searchParams.has("ssl-mode")).toBe(false);
    expect(url.searchParams.get("connection_limit")).toBe("2");
    expect(url.username).toBe("app");
    expect(url.password).toBe("secret");
    expect(writeFileSync).toHaveBeenCalledWith(
      expect.any(String),
      rootCertificates[0],
      { mode: 0o600 },
    );
  });

  it.each(["", " ", "not a certificate"])(
    "rejects invalid CA input %j",
    (ca) => {
      vi.stubEnv("ROUTEVERITY_DATABASE_CA", ca);
      expect(() => databaseOptions()).toThrow();
      expect(writeFileSync).not.toHaveBeenCalled();
    },
  );

  it.each([
    "",
    "not a URL",
    "postgresql://app:secret@database.example/routeverity",
    "mysql://database.example/routeverity",
    "mysql://app:secret@database.example/",
    "mysql://app:secret@database.example/routeverity?sslidentity=client.p12",
  ])(
    "rejects unsupported connection configuration without writing %j",
    (url) => {
      vi.stubEnv("ROUTEVERITY_DATABASE_CA", rootCertificates[0]);
      vi.stubEnv("DATABASE_URL", url);
      expect(() => databaseOptions()).toThrow();
      expect(writeFileSync).not.toHaveBeenCalled();
    },
  );

  it("surfaces certificate filesystem failures instead of falling back", () => {
    vi.stubEnv("ROUTEVERITY_DATABASE_CA", rootCertificates[0]);
    vi.mocked(writeFileSync).mockImplementationOnce(() => {
      throw new Error("Certificate directory is not writable.");
    });
    expect(() => databaseOptions()).toThrow("not writable");
  });
});
