import { Redis } from "@upstash/redis";
import { createHash } from "node:crypto";
import { requiredEnv } from "./environment";

export async function allowRequest(
  namespace: string,
  identity: string,
  limit: number,
  seconds = 900,
) {
  const redis = new Redis({
    url: requiredEnv("UPSTASH_REDIS_REST_URL"),
    token: requiredEnv("UPSTASH_REDIS_REST_TOKEN"),
  });
  const key = `routeverity:${namespace}:${createHash("sha256").update(identity).digest("hex")}`;
  const count = await redis.eval<[number], number>(
    "local n = redis.call('INCR', KEYS[1]); if n == 1 then redis.call('EXPIRE', KEYS[1], ARGV[1]) end; return n",
    [key],
    [seconds],
  );
  return count <= limit;
}
