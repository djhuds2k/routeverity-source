import { enrichClickBatch } from "@/lib/routeverity/click-enrichment";
import { sendHealthAlert } from "@/lib/routeverity/health-alerts";
import { getHealthReport } from "@/lib/routeverity/health-monitor";
import { pruneWorkspaceBatch } from "@/lib/routeverity/retention";
import { runWorkerPass } from "@/lib/routeverity/worker-health";
import { expect, test } from "@playwright/test";
import {
  PrismaClient,
  type RouteVerityWorkerHealth,
  type RouteVerityWorkerName,
} from "@prisma/client";
import { spawnSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { join } from "node:path";
import { assertLocalDatabase } from "./helpers";

const prisma = new PrismaClient();
const nonce = `health-${Date.now()}-${randomUUID().slice(0, 8)}`;
const projectId = `ws_${nonce}`;
const recipient = `${nonce}@routeverity.test`;
const names = ["ENRICHMENT", "RETENTION", "INTEGRITY"] as const;
const previous = new Map<RouteVerityWorkerName, RouteVerityWorkerHealth>();
const ownedRuns = new Map<RouteVerityWorkerName, string>();
let validated = false;
let ownerId: string | undefined;

test.describe.configure({ mode: "serial" });

test.beforeAll(async () => {
  assertLocalDatabase();
  const smtp = new URL(process.env.EMAIL_SERVER ?? "");
  expect(["127.0.0.1", "localhost"]).toContain(smtp.hostname);
  expect(smtp.port).toBe("11025");
  const prior = await prisma.routeVerityWorkerHealth.findMany();
  for (const record of prior) {
    if (
      record.state === "RUNNING" &&
      record.progressAt.getTime() > Date.now() - 5 * 60_000
    )
      throw new Error(
        "Refusing to replace a currently running local worker heartbeat.",
      );
    previous.set(record.name, record);
  }
  validated = true;
  for (const name of names) {
    const now = new Date();
    const data = {
      runId: `${nonce}-${name}`,
      state: "SUCCEEDED" as const,
      startedAt: now,
      progressAt: now,
      succeededAt: now,
      failedAt: null,
      failureCode: null,
    };
    await prisma.routeVerityWorkerHealth.upsert({
      where: { name },
      create: { name, ...data },
      update: data,
    });
    ownedRuns.set(name, data.runId);
  }
  const owner = await prisma.user.create({
    data: { email: `owner-${recipient}`, emailVerified: new Date() },
  });
  ownerId = owner.id;
  await prisma.project.create({
    data: {
      id: projectId,
      slug: nonce,
      name: "Health acceptance fixture",
      billingCycleStart: 1,
      routeverityRetentionDays: 30,
      users: { create: { userId: owner.id, role: "owner" } },
    },
  });
  for (const [index, timestamp] of [
    new Date(Date.now() - 11 * 60_000),
    new Date(Date.now() - 30 * 86_400_000 - 11 * 60_000),
  ].entries())
    await prisma.routeVerityRedirectAudit.create({
      data: {
        clickId: `rvc_${randomUUID()}`,
        requestId: randomUUID(),
        projectId,
        campaignId: `cmp_${nonce}`,
        timestamp,
        trackingDomain: "health.example.test",
        destinationHostname: "shop.example.com",
        providedNextHopHash: "a".repeat(64),
        validatedNextHopHash: "a".repeat(64),
        actualRedirectTargetHash: "a".repeat(64),
        validationResult: "ALLOWED",
        redirectStatus: 302,
        processingTimeMs: 1,
        policyVersion: "local-health-test",
        appVersion: "local-test",
        analyticsCaptured: index === 0,
        rawUserAgent: index === 0 ? "Mozilla/5.0 Chrome/120.0" : null,
      },
    });
});

test.afterAll(async () => {
  if (validated) {
    await prisma.routeVerityConversion.deleteMany({ where: { projectId } });
    await prisma.routeVerityOperatorEvent.deleteMany({ where: { projectId } });
    await prisma.routeVerityRedirectAudit.deleteMany({ where: { projectId } });
    await prisma.project.deleteMany({ where: { id: projectId } });
    if (ownerId) await prisma.user.deleteMany({ where: { id: ownerId } });
    for (const name of names) {
      const runId = ownedRuns.get(name);
      if (!runId) continue;
      const prior = previous.get(name);
      if (prior) {
        const { name: _name, ...data } = prior;
        await prisma.routeVerityWorkerHealth.updateMany({
          where: { name, runId },
          data,
        });
      } else {
        await prisma.routeVerityWorkerHealth.deleteMany({
          where: { name, runId },
        });
      }
    }
  }
  await prisma.$disconnect();
});

test("real SQL backlog -> bounded unhealthy exit -> private MailHog incident -> real worker recovery", async ({
  request,
}) => {
  const initial = await getHealthReport();
  expect(initial.database).toBe("available");
  expect(initial.redis).toBe("available");
  expect(initial.issues.map((issue) => issue.code)).toContain(
    "ENRICHMENT_BACKLOG",
  );
  expect(initial.issues.map((issue) => issue.code)).toContain(
    "CLICK_EXPIRY_OVERDUE",
  );
  const monitor = spawnSync(
    process.execPath,
    ["--import", "tsx", join("scripts", "routeverity-health.ts"), "--notify"],
    {
      cwd: process.cwd(),
      encoding: "utf8",
      timeout: 15000,
      env: { ...process.env, ROUTEVERITY_ALERT_EMAIL: recipient },
    },
  );
  expect(monitor.status).toBe(1);
  expect(monitor.stdout).toContain("routeverity.health.alert.accepted");
  expect(monitor.stderr).toContain("ENRICHMENT_BACKLOG");
  expect(monitor.stderr).not.toContain(projectId);
  const readMessages = async () => {
    const inbox: {
      items: {
        To: { Mailbox: string; Domain: string }[];
        Content: { Headers: { Subject: string[] }; Body: string };
      }[];
    } = await (
      await request.get("http://127.0.0.1:18025/api/v2/messages")
    ).json();
    return inbox.items.filter((message) =>
      message.To.some((to) => `${to.Mailbox}@${to.Domain}` === recipient),
    );
  };
  await expect(async () => {
    const messages = await readMessages();
    expect(messages).toHaveLength(1);
    expect(messages[0].Content.Headers.Subject[0]).toBe(
      "RouteVerity operational incident",
    );
    expect(messages[0].Content.Body).not.toContain(projectId);
    expect(messages[0].Content.Body).not.toContain("shop.example.com");
  }).toPass({ timeout: 10000 });
  await runWorkerPass("ENRICHMENT", () => enrichClickBatch());
  ownedRuns.set(
    "ENRICHMENT",
    (
      await prisma.routeVerityWorkerHealth.findUniqueOrThrow({
        where: { name: "ENRICHMENT" },
      })
    ).runId,
  );
  await runWorkerPass("RETENTION", () =>
    pruneWorkspaceBatch(projectId, new Date(), true),
  );
  ownedRuns.set(
    "RETENTION",
    (
      await prisma.routeVerityWorkerHealth.findUniqueOrThrow({
        where: { name: "RETENTION" },
      })
    ).runId,
  );
  const dryRunRevision = await prisma.routeVerityWorkerHealth.findUniqueOrThrow(
    { where: { name: "RETENTION" } },
  );
  const dryRun = spawnSync(
    process.execPath,
    ["--import", "tsx", join("scripts", "routeverity-retention.ts")],
    {
      cwd: process.cwd(),
      encoding: "utf8",
      timeout: 15000,
    },
  );
  expect(dryRun.status).toBe(0);
  expect(
    await prisma.routeVerityWorkerHealth.findUniqueOrThrow({
      where: { name: "RETENTION" },
    }),
  ).toEqual(dryRunRevision);
  const integrity = spawnSync(
    process.execPath,
    ["--import", "tsx", join("scripts", "routeverity-redirect-audit.ts")],
    {
      cwd: process.cwd(),
      encoding: "utf8",
      timeout: 15000,
    },
  );
  expect(integrity.status).toBe(0);
  ownedRuns.set(
    "INTEGRITY",
    (
      await prisma.routeVerityWorkerHealth.findUniqueOrThrow({
        where: { name: "INTEGRITY" },
      })
    ).runId,
  );
  const recovered = await getHealthReport();
  expect(recovered.healthy).toBe(true);
  const check = spawnSync(
    process.execPath,
    ["--import", "tsx", join("scripts", "routeverity-health.ts")],
    {
      cwd: process.cwd(),
      encoding: "utf8",
      timeout: 15000,
    },
  );
  expect(check.status).toBe(0);
  expect(check.stdout).toContain('"healthy":true');
  const originalRecipient = process.env.ROUTEVERITY_ALERT_EMAIL;
  process.env.ROUTEVERITY_ALERT_EMAIL = recipient;
  try {
    await sendHealthAlert(recovered, "recovery");
  } finally {
    if (originalRecipient === undefined)
      delete process.env.ROUTEVERITY_ALERT_EMAIL;
    else process.env.ROUTEVERITY_ALERT_EMAIL = originalRecipient;
  }
  await expect(async () => {
    const messages = await readMessages();
    expect(messages).toHaveLength(2);
    expect(
      messages.some(
        (message) =>
          message.Content.Headers.Subject[0] ===
          "RouteVerity operational recovery",
      ),
    ).toBe(true);
  }).toPass({ timeout: 10000 });
});

test("real expiry queries use current policy, receipt time, orphan maximum and precise grace cutoffs", async () => {
  const now = new Date();
  const click = await prisma.routeVerityRedirectAudit.findFirstOrThrow({
    where: { projectId },
  });
  const conversion = await prisma.routeVerityConversion.create({
    data: {
      id: `cv_${nonce}`,
      projectId,
      campaignId: click.campaignId,
      goalId: `goal_${nonce}`,
      clickId: click.clickId,
      event: "purchase",
      orderId: nonce,
      orderHash: "b".repeat(64),
      revenue: "1.000",
      currency: "USD",
      occurredAt: new Date(now.getTime() - 100 * 86_400_000),
      receivedAt: now,
      metadata: {},
      payloadHash: "c".repeat(64),
      attributionPolicy: "local-health-test",
    },
  });
  for (const days of [30, 60, 90]) {
    await prisma.project.update({
      where: { id: projectId },
      data: { routeverityRetentionDays: days },
    });
    const cutoff = new Date(now.getTime() - days * 86_400_000 - 10 * 60_000);
    await prisma.routeVerityRedirectAudit.update({
      where: { clickId: click.clickId },
      data: { timestamp: cutoff },
    });
    expect((await getHealthReport(now)).snapshot?.clicksOverdue).toBe(false);
    await prisma.routeVerityRedirectAudit.update({
      where: { clickId: click.clickId },
      data: { timestamp: new Date(cutoff.getTime() - 1) },
    });
    expect((await getHealthReport(now)).snapshot?.clicksOverdue).toBe(true);
    await prisma.routeVerityRedirectAudit.update({
      where: { clickId: click.clickId },
      data: { timestamp: now },
    });
    await prisma.routeVerityConversion.update({
      where: { id: conversion.id },
      data: { receivedAt: cutoff },
    });
    expect((await getHealthReport(now)).snapshot?.conversionsOverdue).toBe(
      false,
    );
    await prisma.routeVerityConversion.update({
      where: { id: conversion.id },
      data: { receivedAt: new Date(cutoff.getTime() - 1) },
    });
    expect((await getHealthReport(now)).snapshot?.conversionsOverdue).toBe(
      true,
    );
    await prisma.routeVerityConversion.update({
      where: { id: conversion.id },
      data: { receivedAt: now },
    });
    expect((await getHealthReport(now)).snapshot?.conversionsOverdue).toBe(
      false,
    );
  }
  await prisma.routeVerityRedirectAudit.update({
    where: { clickId: click.clickId },
    data: {
      projectId: `${projectId}-orphan`,
      timestamp: new Date(now.getTime() - 60 * 86_400_000),
    },
  });
  try {
    expect((await getHealthReport(now)).snapshot?.clicksOverdue).toBe(false);
    await prisma.routeVerityRedirectAudit.update({
      where: { clickId: click.clickId },
      data: {
        timestamp: new Date(now.getTime() - 90 * 86_400_000 - 10 * 60_000 - 1),
      },
    });
    expect((await getHealthReport(now)).snapshot?.clicksOverdue).toBe(true);
  } finally {
    await prisma.routeVerityRedirectAudit.update({
      where: { clickId: click.clickId },
      data: { projectId, timestamp: now },
    });
  }
  const rawCutoff = new Date(now.getTime() - 24 * 60 * 60_000 - 10 * 60_000);
  await prisma.routeVerityRedirectAudit.update({
    where: { clickId: click.clickId },
    data: {
      rawUserAgent: "Local health fixture",
      timestamp: new Date(rawCutoff.getTime() + 1),
    },
  });
  expect((await getHealthReport(now)).snapshot?.rawInputOverdue).toBe(false);
  await prisma.routeVerityRedirectAudit.update({
    where: { clickId: click.clickId },
    data: { timestamp: rawCutoff },
  });
  expect((await getHealthReport(now)).snapshot?.rawInputOverdue).toBe(true);
  await prisma.routeVerityRedirectAudit.update({
    where: { clickId: click.clickId },
    data: { rawUserAgent: null, timestamp: now },
  });
  const operatorCutoff = new Date(
    now.getTime() - 365 * 86_400_000 - 10 * 60_000,
  );
  if (!ownerId) throw new Error("Missing local health fixture owner.");
  const operator = await prisma.routeVerityOperatorEvent.create({
    data: {
      id: `op_${nonce}`,
      projectId,
      actorId: ownerId,
      operation: "WORKSPACE_SUSPENDED",
      reason: "Local health acceptance fixture",
      wasDisabled: false,
      isDisabled: true,
      createdAt: operatorCutoff,
    },
  });
  expect((await getHealthReport(now)).snapshot?.operatorAuditOverdue).toBe(
    false,
  );
  await prisma.routeVerityOperatorEvent.update({
    where: { id: operator.id },
    data: { createdAt: new Date(operatorCutoff.getTime() - 1) },
  });
  expect((await getHealthReport(now)).snapshot?.operatorAuditOverdue).toBe(
    true,
  );
  await prisma.routeVerityOperatorEvent.delete({ where: { id: operator.id } });
  await prisma.project.update({
    where: { id: projectId },
    data: { routeverityRetentionDays: 45 },
  });
  expect(
    (await getHealthReport(now)).issues.map((issue) => issue.code),
  ).toContain("INVALID_RETENTION_POLICY");
  await prisma.project.update({
    where: { id: projectId },
    data: { routeverityRetentionDays: 30 },
  });
});

test("an actual integrity mismatch records failed completion and nonzero status until repaired", async () => {
  const click = await prisma.routeVerityRedirectAudit.findFirstOrThrow({
    where: { projectId },
  });
  const scan = () =>
    spawnSync(
      process.execPath,
      ["--import", "tsx", join("scripts", "routeverity-redirect-audit.ts")],
      {
        cwd: process.cwd(),
        encoding: "utf8",
        timeout: 15000,
      },
    );
  await prisma.routeVerityRedirectAudit.update({
    where: { clickId: click.clickId },
    data: { actualRedirectTargetHash: "f".repeat(64) },
  });
  try {
    expect(scan().status).toBe(1);
    const failed = await prisma.routeVerityWorkerHealth.findUniqueOrThrow({
      where: { name: "INTEGRITY" },
    });
    ownedRuns.set("INTEGRITY", failed.runId);
    expect(failed.state).toBe("FAILED");
    expect(failed.failureCode).toBe("INTEGRITY_MISMATCH");
    expect(
      (await getHealthReport()).issues.map((issue) => issue.code),
    ).toContain("INTEGRITY_MISMATCH");
  } finally {
    await prisma.routeVerityRedirectAudit.update({
      where: { clickId: click.clickId },
      data: { actualRedirectTargetHash: click.actualRedirectTargetHash },
    });
  }
  expect(scan().status).toBe(0);
  const succeeded = await prisma.routeVerityWorkerHealth.findUniqueOrThrow({
    where: { name: "INTEGRITY" },
  });
  ownedRuns.set("INTEGRITY", succeeded.runId);
  expect(succeeded.state).toBe("SUCCEEDED");
  expect(succeeded.failureCode).toBeNull();
});
