import { prisma } from "@/lib/prisma";
import type { RouteVerityWorkerName } from "@prisma/client";
import { randomUUID } from "node:crypto";

export class WorkerSuperseded extends Error {}
export class IntegrityMismatch extends Error {}

export async function runWorkerPass<T>(
  name: RouteVerityWorkerName,
  operation: (progress: () => Promise<void>) => Promise<T>,
) {
  const runId = randomUUID();
  const startedAt = new Date();
  await prisma.routeVerityWorkerHealth.upsert({
    where: { name },
    create: { name, runId, state: "RUNNING", startedAt, progressAt: startedAt },
    update: {
      runId,
      state: "RUNNING",
      startedAt,
      progressAt: startedAt,
      failureCode: null,
    },
  });
  async function update(data: {
    progressAt: Date;
    state?: "SUCCEEDED" | "FAILED";
    succeededAt?: Date;
    failedAt?: Date;
    failureCode?: string | null;
  }) {
    const result = await prisma.routeVerityWorkerHealth.updateMany({
      where: { name, runId },
      data,
    });
    if (!result.count)
      throw new WorkerSuperseded(
        "A newer worker instance owns this heartbeat.",
      );
  }
  try {
    const result = await operation(() => update({ progressAt: new Date() }));
    const now = new Date();
    await update({
      state: "SUCCEEDED",
      progressAt: now,
      succeededAt: now,
      failureCode: null,
    });
    return result;
  } catch (error) {
    if (!(error instanceof WorkerSuperseded)) {
      const now = new Date();
      try {
        await update({
          state: "FAILED",
          progressAt: now,
          failedAt: now,
          failureCode:
            error instanceof IntegrityMismatch
              ? "INTEGRITY_MISMATCH"
              : "WORKER_FAILED",
        });
      } catch (heartbeatError) {
        console.error(
          JSON.stringify({
            event: "routeverity.worker.heartbeat.failed",
            worker: name,
            code:
              heartbeatError instanceof WorkerSuperseded
                ? "WORKER_SUPERSEDED"
                : "HEARTBEAT_WRITE_FAILED",
          }),
        );
      }
    }
    throw error;
  }
}

export async function redirectIntegrityMismatches() {
  const fields = prisma.routeVerityRedirectAudit.fields;
  return prisma.routeVerityRedirectAudit.count({
    where: {
      OR: [
        {
          NOT: {
            validatedNextHopHash: { equals: fields.actualRedirectTargetHash },
          },
        },
        { validationResult: { not: "ALLOWED" } },
        { redirectStatus: { not: 302 } },
      ],
    },
  });
}
