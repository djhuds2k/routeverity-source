import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import {
  maximumRetentionDays,
  retentionCutoffs,
  validateRetentionBatchSize,
} from "./retention-policy";

export async function retentionWorkspacePage(
  now: Date,
  after = "",
  limit = 100,
) {
  validateRetentionBatchSize(limit);
  const cutoff = retentionCutoffs(now, maximumRetentionDays).records;
  return prisma.$queryRaw<{ id: string }[]>(Prisma.sql`
    SELECT id FROM (
      SELECT id FROM Project
      UNION
      SELECT projectId AS id FROM RouteVerityRedirectAudit WHERE timestamp < ${cutoff}
      UNION
      SELECT projectId AS id FROM RouteVerityConversion WHERE receivedAt < ${cutoff}
      UNION
      SELECT projectId AS id FROM RouteVerityMerchantSubmission WHERE receivedAt < ${cutoff}
    ) AS workspaces
    WHERE id > ${after} ORDER BY id ASC LIMIT ${limit}
  `);
}

export async function pruneWorkspaceBatch(
  projectId: string,
  now: Date,
  apply = false,
  limit = 100,
) {
  validateRetentionBatchSize(limit);
  retentionCutoffs(now, maximumRetentionDays);
  if (!projectId) throw new Error("Retention requires a workspace ID.");
  return prisma.$transaction(
    async (tx) => {
      // Order expiry with ingestion and owner settings, without touching revisions.
      if (apply)
        await tx.$queryRaw(Prisma.sql`
          SELECT id FROM Project WHERE id = ${projectId} FOR UPDATE
        `);
      const workspace = await tx.project.findUnique({
        where: { id: projectId },
        select: { routeverityRetentionDays: true },
      });
      const days = workspace
        ? workspace.routeverityRetentionDays
        : maximumRetentionDays;
      const cutoff = retentionCutoffs(now, days).records;
      const merchantSubmissions =
        await tx.routeVerityMerchantSubmission.findMany({
          where: { projectId, receivedAt: { lt: cutoff } },
          orderBy: [{ receivedAt: "asc" }, { id: "asc" }],
          take: limit,
          select: { id: true },
        });
      const merchantIds = merchantSubmissions.map(({ id }) => id);
      let merchantReceipts = 0;
      let deletedMerchantSubmissions = 0;
      let remainingMerchantReceipts = false;
      if (merchantIds.length) {
        const where = { projectId, submissionId: { in: merchantIds } };
        const receipts = await tx.routeVerityMerchantReceipt.findMany({
          where,
          orderBy: { id: "asc" },
          take: limit,
          select: { id: true },
        });
        merchantReceipts = receipts.length;
        if (apply) {
          if (receipts.length)
            merchantReceipts = (
              await tx.routeVerityMerchantReceipt.deleteMany({
                where: { ...where, id: { in: receipts.map(({ id }) => id) } },
              })
            ).count;
          remainingMerchantReceipts =
            !!(await tx.routeVerityMerchantReceipt.findFirst({
              where,
              select: { id: true },
            }));
          if (!remainingMerchantReceipts)
            deletedMerchantSubmissions = (
              await tx.routeVerityMerchantSubmission.deleteMany({
                where: {
                  projectId,
                  id: { in: merchantIds },
                  receivedAt: { lt: cutoff },
                },
              })
            ).count;
        }
      }
      const conversions = await tx.routeVerityConversion.findMany({
        where: { projectId, receivedAt: { lt: cutoff } },
        orderBy: [{ receivedAt: "asc" }, { id: "asc" }],
        take: limit,
        select: { id: true },
      });
      const conversionIds = conversions.map(({ id }) => id);
      const receiptsWhere = {
        projectId,
        conversionId: { in: conversionIds },
      };
      let receipts = 0;
      let deletedConversions = 0;
      let remainingReceipts = false;
      if (conversionIds.length) {
        const pendingReceipts = await tx.routeVerityConversionReceipt.findMany({
          where: receiptsWhere,
          orderBy: { id: "asc" },
          take: limit,
          select: { id: true },
        });
        if (apply) {
          if (pendingReceipts.length)
            receipts = (
              await tx.routeVerityConversionReceipt.deleteMany({
                where: {
                  ...receiptsWhere,
                  id: { in: pendingReceipts.map(({ id }) => id) },
                },
              })
            ).count;
          remainingReceipts =
            !!(await tx.routeVerityConversionReceipt.findFirst({
              where: receiptsWhere,
              select: { id: true },
            }));
          // A parent cannot disappear while one of its retry receipts remains.
          if (!remainingReceipts)
            deletedConversions = (
              await tx.routeVerityConversion.deleteMany({
                where: {
                  projectId,
                  id: { in: conversionIds },
                  receivedAt: { lt: cutoff },
                },
              })
            ).count;
        } else {
          receipts = pendingReceipts.length;
        }
      }
      const clicks = await tx.routeVerityRedirectAudit.findMany({
        where: { projectId, timestamp: { lt: cutoff } },
        orderBy: [{ timestamp: "asc" }, { clickId: "asc" }],
        take: limit,
        select: { clickId: true },
      });
      let deletedClicks = 0;
      if (apply && clicks.length)
        deletedClicks = (
          await tx.routeVerityRedirectAudit.deleteMany({
            where: {
              projectId,
              clickId: { in: clicks.map(({ clickId }) => clickId) },
              timestamp: { lt: cutoff },
            },
          })
        ).count;
      return {
        applied: apply,
        orphanedWorkspace: !workspace,
        retentionDays: days,
        scannedClicks: clicks.length,
        scannedConversions: conversions.length,
        scannedMerchantSubmissions: merchantSubmissions.length,
        clicks: apply ? deletedClicks : clicks.length,
        conversions: apply ? deletedConversions : conversions.length,
        receipts,
        remainingReceipts,
        merchantSubmissions: apply
          ? deletedMerchantSubmissions
          : merchantSubmissions.length,
        merchantReceipts,
        remainingMerchantReceipts,
      };
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted },
  );
}

export async function pruneGlobalBatch(
  now: Date,
  apply = false,
  limit = 100,
  projectId?: string,
) {
  validateRetentionBatchSize(limit);
  if (projectId !== undefined && !projectId)
    throw new Error("A scoped retention batch requires a workspace ID.");
  const cutoffs = retentionCutoffs(now, maximumRetentionDays);
  const rawWhere = {
    ...(projectId ? { projectId } : {}),
    timestamp: { lte: cutoffs.rawUserAgent },
    rawUserAgent: { not: null },
  };
  const agents = await prisma.routeVerityRedirectAudit.findMany({
    where: rawWhere,
    orderBy: [{ timestamp: "asc" }, { clickId: "asc" }],
    take: limit,
    select: { clickId: true },
  });
  const operatorWhere = {
    ...(projectId ? { projectId } : {}),
    createdAt: { lt: cutoffs.operator },
  };
  const operators = await prisma.routeVerityOperatorEvent.findMany({
    where: operatorWhere,
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    take: limit,
    select: { id: true },
  });
  let rawUserAgents = agents.length;
  let operatorEvents = operators.length;
  if (apply && agents.length)
    rawUserAgents = (
      await prisma.routeVerityRedirectAudit.updateMany({
        where: {
          ...rawWhere,
          clickId: { in: agents.map(({ clickId }) => clickId) },
        },
        data: { rawUserAgent: null },
      })
    ).count;
  if (apply && operators.length)
    operatorEvents = (
      await prisma.routeVerityOperatorEvent.deleteMany({
        where: {
          ...operatorWhere,
          id: { in: operators.map(({ id }) => id) },
        },
      })
    ).count;
  return {
    applied: apply,
    scannedUserAgents: agents.length,
    scannedOperatorEvents: operators.length,
    rawUserAgents,
    operatorEvents,
  };
}
