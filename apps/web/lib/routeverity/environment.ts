export function requiredEnv(name: string) {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

export function appOrigin() {
  const url = new URL(requiredEnv("NEXTAUTH_URL"));
  if (
    !["http:", "https:"].includes(url.protocol) ||
    url.username ||
    url.password
  )
    throw new Error(
      "NEXTAUTH_URL must be an HTTP(S) origin without credentials.",
    );
  return url.origin;
}
