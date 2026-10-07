import { z } from "zod";

export const workspaceSchema = z.object({
  name: z.string().trim().min(2).max(60),
  slug: z
    .string()
    .trim()
    .toLowerCase()
    .min(3)
    .max(40)
    .regex(
      /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
      "Use lowercase letters, numbers and single hyphens.",
    ),
});

export const domainSchema = z.object({
  slug: z
    .string()
    .trim()
    .toLowerCase()
    .max(253)
    .regex(
      /^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/,
      "Enter a hostname without a protocol or path.",
    )
    .refine(
      (value) => !value.endsWith(".localhost") && !value.endsWith(".local"),
      "Local hostnames are reserved.",
    ),
  type: z.enum(["TRANSPARENT_TRACKING", "STANDARD_LINK"]),
});

export const destinationSchema = z
  .string()
  .trim()
  .max(8000)
  .url()
  .refine((value) => {
    const url = new URL(value);
    return (
      ["https:", "http:"].includes(url.protocol) &&
      !url.username &&
      !url.password
    );
  }, "Use an HTTP or HTTPS destination without embedded credentials.");

export const linkSchema = z.object({
  domainId: z.string().min(1),
  key: z
    .string()
    .trim()
    .min(1)
    .max(80)
    .regex(/^[a-zA-Z0-9_-]+$/, "Use letters, numbers, underscores or hyphens."),
  url: destinationSchema,
});

export function canWrite(role: string) {
  return role === "owner" || role === "member";
}

export function isLocalOrigin(origin: string) {
  return ["localhost", "127.0.0.1", "[::1]"].includes(new URL(origin).hostname);
}
