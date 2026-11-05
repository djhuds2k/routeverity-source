import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { requireUser } from "./auth";
import { allowRequest } from "./rate-limit";

export const exportRowLimit = 10000;
export const exportByteLimit = 20 * 1024 * 1024;
const version = "routeverity-export-v1";
export class DataExportError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

function completeRows<T>(rows: T[]) {
  if (rows.length > exportRowLimit)
    throw new DataExportError(
      413,
      "Export exceeds 10,000 rows in a collection. No partial export was produced; a larger export requires an operator-assisted process that is not available yet.",
    );
  return rows;
}

export function encodeDataExport(data: unknown) {
  const json = JSON.stringify(data);
  if (Buffer.byteLength(json, "utf8") > exportByteLimit)
    throw new DataExportError(
      413,
      "Export exceeds 20 MiB. No partial export was produced; a larger export requires an operator-assisted process that is not available yet.",
    );
  return json;
}

export async function exportWorkspace(userId: string, slug: string) {
  return prisma.$transaction(
    async (tx) => {
      const membership = await tx.projectUsers.findFirst({
        where: { userId, project: { slug } },
        select: { role: true, projectId: true },
      });
      if (membership?.role !== "owner")
        throw new DataExportError(
          403,
          "Only a current workspace owner can export workspace data.",
        );
      const projectId = membership.projectId;
      const workspace = await tx.project.findUnique({
        where: { id: projectId },
        select: {
          id: true,
          name: true,
          slug: true,
          createdAt: true,
          updatedAt: true,
          disabledAt: true,
          routeverityRetentionDays: true,
        },
      });
      if (!workspace) throw new DataExportError(404, "Workspace unavailable.");
      const where = { projectId };
      const take = exportRowLimit + 1;
      const [
        memberships,
        domains,
        links,
        campaigns,
        destinationPolicies,
        clickAudits,
        goals,
        conversions,
        conversionKeyMetadata,
        merchantSubmissions,
      ] = await Promise.all([
        tx.projectUsers
          .findMany({
            where,
            take,
            orderBy: { id: "asc" },
            select: { id: true, userId: true, role: true, createdAt: true },
          })
          .then(completeRows),
        tx.domain
          .findMany({
            where,
            take,
            orderBy: { id: "asc" },
            select: {
              id: true,
              slug: true,
              type: true,
              verified: true,
              suspendedAt: true,
              archived: true,
              createdAt: true,
              updatedAt: true,
              lastChecked: true,
            },
          })
          .then(completeRows),
        tx.link
          .findMany({
            where,
            take,
            orderBy: { id: "asc" },
            select: {
              id: true,
              domain: true,
              key: true,
              url: true,
              shortLink: true,
              userId: true,
              archived: true,
              disabledAt: true,
              expiresAt: true,
              createdAt: true,
              updatedAt: true,
            },
          })
          .then(completeRows),
        tx.routeVerityCampaign
          .findMany({
            where,
            take,
            orderBy: { id: "asc" },
            select: {
              id: true,
              name: true,
              advertiser: true,
              trafficSource: true,
              externalCampaignId: true,
              currency: true,
              status: true,
              trackingDomainId: true,
              trackingParameters: true,
              notes: true,
              createdAt: true,
              updatedAt: true,
              trackingTokenIssuedAt: true,
            },
          })
          .then(completeRows),
        tx.routeVerityDestinationDomain
          .findMany({
            where: { campaign: { projectId } },
            take,
            orderBy: { id: "asc" },
            select: {
              id: true,
              campaignId: true,
              hostname: true,
              includeSubdomains: true,
            },
          })
          .then(completeRows),
        tx.routeVerityRedirectAudit
          .findMany({
            where,
            take,
            orderBy: [{ timestamp: "asc" }, { clickId: "asc" }],
            select: {
              clickId: true,
              requestId: true,
              campaignId: true,
              timestamp: true,
              trackingDomain: true,
              destinationHostname: true,
              providedNextHopHash: true,
              validatedNextHopHash: true,
              actualRedirectTargetHash: true,
              validationResult: true,
              redirectStatus: true,
              processingTimeMs: true,
              policyVersion: true,
              appVersion: true,
              analyticsCaptured: true,
              referrerHostname: true,
              device: true,
              browser: true,
              operatingSystem: true,
              enrichedAt: true,
              googleAds: true,
            },
          })
          .then(completeRows),
        tx.routeVerityConversionGoal
          .findMany({
            where,
            take,
            orderBy: { id: "asc" },
            select: {
              id: true,
              campaignId: true,
              event: true,
              name: true,
              currency: true,
              enabled: true,
              createdAt: true,
            },
          })
          .then(completeRows),
        tx.routeVerityConversion
          .findMany({
            where,
            take,
            orderBy: [{ receivedAt: "asc" }, { id: "asc" }],
            select: {
              id: true,
              campaignId: true,
              goalId: true,
              clickId: true,
              event: true,
              orderId: true,
              customerReference: true,
              revenue: true,
              currency: true,
              occurredAt: true,
              receivedAt: true,
              metadata: true,
              attributionPolicy: true,
            },
          })
          .then(completeRows),
        tx.routeVerityConversionKey
          .findMany({
            where,
            take,
            orderBy: { id: "asc" },
            select: { id: true, name: true, createdAt: true, revokedAt: true },
          })
          .then(completeRows),
        tx.routeVerityMerchantSubmission
          .findMany({
            where,
            take,
            orderBy: [{ receivedAt: "asc" }, { id: "asc" }],
            select: {
              id: true,
              campaignId: true,
              goalId: true,
              event: true,
              orderId: true,
              revenue: true,
              currency: true,
              occurredAt: true,
              receivedAt: true,
              status: true,
              reason: true,
              conversionId: true,
              reconcileUntil: true,
              nextAttemptAt: true,
              attempts: true,
            },
          })
          .then(completeRows),
      ]);
      return {
        schemaVersion: version,
        scope: "workspace",
        exportedAt: new Date().toISOString(),
        notice:
          "Retained active-product data only. UTC dates; revenue is an exact decimal string. No credential fields, raw user-agent input, authentication records, other members' email addresses, internal retry hashes or operator incident audits. Customer-supplied URLs, notes and metadata may contain personal data or pasted secrets; handle this file privately. This is not a database backup or a complete legal subject-access response.",
        workspace,
        memberships,
        domains,
        links,
        campaigns,
        destinationPolicies,
        clickAudits,
        goals,
        conversions,
        conversionKeyMetadata,
        merchantSubmissions,
      };
    },
    {
      isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead,
      timeout: 10000,
    },
  );
}

export async function exportAccount(userId: string) {
  return prisma.$transaction(
    async (tx) => {
      const user = await tx.user.findUnique({
        where: { id: userId },
        select: {
          id: true,
          name: true,
          email: true,
          emailVerified: true,
          image: true,
          createdAt: true,
          defaultWorkspace: true,
        },
      });
      if (!user) throw new DataExportError(404, "Account unavailable.");
      const where = { userId };
      const take = exportRowLimit + 1;
      const [memberships, sessions, signInProviders, authoredLinkReferences] =
        await Promise.all([
          tx.projectUsers
            .findMany({
              where,
              take,
              orderBy: { id: "asc" },
              select: {
                id: true,
                projectId: true,
                role: true,
                createdAt: true,
                project: {
                  select: { name: true, slug: true, disabledAt: true },
                },
              },
            })
            .then(completeRows),
          tx.session
            .findMany({
              where,
              take,
              orderBy: { id: "asc" },
              select: { id: true, expires: true },
            })
            .then(completeRows),
          tx.account
            .findMany({
              where,
              take,
              orderBy: { id: "asc" },
              select: {
                id: true,
                type: true,
                provider: true,
                providerAccountId: true,
              },
            })
            .then(completeRows),
          tx.link
            .findMany({
              where,
              take,
              orderBy: { id: "asc" },
              select: {
                id: true,
                projectId: true,
                createdAt: true,
                updatedAt: true,
              },
            })
            .then(completeRows),
        ]);
      return {
        schemaVersion: version,
        scope: "account",
        exportedAt: new Date().toISOString(),
        notice:
          "Current account profile, memberships, non-secret session/provider metadata and authored-link references only. No login/session credentials, password hashes, operator incident audits or full shared-workspace content. Workspace operational data requires a separate owner export. External provider logs/backups and customer-submitted references require a separate rights-request review; this is not a complete legal subject-access response.",
        user,
        memberships,
        sessions,
        signInProviders,
        authoredLinkReferences,
      };
    },
    {
      isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead,
      timeout: 10000,
    },
  );
}

export async function dataExportResponse(request: Request, slug?: string) {
  const user = await requireUser();
  const headers = {
    "Cache-Control": "private, no-store",
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "no-referrer",
  };
  try {
    if (new URL(request.url).search)
      throw new DataExportError(
        400,
        "This complete-scope export accepts no query parameters.",
      );
    if (!(await allowRequest("data-export", user.id, 10, 60)))
      throw new DataExportError(429, "Too many exports. Please wait a minute.");
    const data =
      slug === undefined
        ? await exportAccount(user.id)
        : await exportWorkspace(user.id, slug);
    return new Response(encodeDataExport(data), {
      headers: {
        ...headers,
        "Content-Type": "application/json; charset=utf-8",
        "Content-Disposition": `attachment; filename="routeverity-${slug === undefined ? "account" : "workspace"}.json"`,
      },
    });
  } catch (error) {
    if (error instanceof DataExportError)
      return new Response(error.message, { status: error.status, headers });
    console.error(
      JSON.stringify({
        event: "routeverity.data.export.failed",
        error_type: error instanceof Error ? error.name : "unknown",
      }),
    );
    return new Response("Export failed. Retry or check the application logs.", {
      status: 503,
      headers,
    });
  }
}
