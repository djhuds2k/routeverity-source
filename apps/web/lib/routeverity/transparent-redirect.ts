import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { randomUUID } from "node:crypto";
import {
  campaignReadiness,
  isCampaignDestinationAllowed,
} from "./campaign-policy";
import { captureClickMetadata } from "./click-metadata";
import { allowRequest } from "./rate-limit";
import {
  assertRedirectIntegrity,
  fingerprint,
  parseTrackingRequest,
  redirectAppVersion,
  redirectPolicyVersion,
  tokenMatches,
  trackingCampaignLimit,
  TrackingError,
  trackingHost,
  trackingWindowSeconds,
  validateTransparentDestination,
} from "./transparent-policy";

async function withinDeadline<T>(operation: Promise<T>, milliseconds: number) {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      operation,
      new Promise<never>((_, reject) => {
        timer = setTimeout(
          () => reject(new TrackingError(503, "DEPENDENCY_TIMEOUT")),
          milliseconds,
        );
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
}

export async function transparentRedirect(request: Request) {
  const started = performance.now();
  const requestId = randomUUID();
  const headers = new Headers({
    "Cache-Control": "private, no-store, max-age=0",
    "Referrer-Policy": "no-referrer",
    "X-Content-Type-Options": "nosniff",
    "X-RouteVerity-Request-Id": requestId,
  });
  let stage = "request";
  try {
    if (request.method !== "GET")
      throw new TrackingError(405, "METHOD_NOT_ALLOWED");
    const host = trackingHost(request.headers.get("host"));
    const input = parseTrackingRequest(request.url);
    const validated = validateTransparentDestination(input.destination);
    stage = "campaign_lookup";
    const campaign = await withinDeadline(
      prisma.routeVerityCampaign.findUnique({
        where: { id: input.campaignId },
        include: {
          destinationDomains: true,
          trackingDomain: true,
          project: { select: { disabledAt: true } },
        },
      }),
      1500,
    );
    if (
      !campaign ||
      campaign.project.disabledAt ||
      !tokenMatches(input.token, campaign.trackingTokenHash) ||
      campaign.trackingDomain?.slug !== host ||
      campaign.trackingDomain.projectId !== campaign.projectId ||
      campaignReadiness(campaign)
    )
      throw new TrackingError(404, "CAMPAIGN_UNAVAILABLE");
    if (
      !isCampaignDestinationAllowed(
        validated.destination,
        campaign.destinationDomains,
      )
    )
      throw new TrackingError(403, "DESTINATION_NOT_APPROVED");
    stage = "rate_limit";
    if (
      !(await withinDeadline(
        allowRequest(
          "transparent-clicks",
          campaign.id,
          trackingCampaignLimit,
          trackingWindowSeconds,
        ),
        750,
      ))
    )
      throw new TrackingError(429, "CAMPAIGN_RATE_LIMITED");
    const clickId = `rvc_${randomUUID()}`;
    headers.set("Location", validated.destination);
    headers.set("X-RouteVerity-Click-Id", clickId);
    const response = new Response(null, { status: 302, headers });
    const actualTarget = response.headers.get("Location");
    assertRedirectIntegrity(validated.destination, actualTarget);
    stage = "durable_audit";
    const audit = {
      ...captureClickMetadata(request.headers),
      googleAds: input.googleAds,
      clickId,
      requestId,
      timestamp: new Date(),
      projectId: campaign.projectId,
      campaignId: campaign.id,
      trackingDomain: host,
      destinationHostname: validated.hostname,
      providedNextHopHash: fingerprint(input.destination),
      validatedNextHopHash: fingerprint(validated.destination),
      actualRedirectTargetHash: fingerprint(actualTarget),
      validationResult: "ALLOWED",
      redirectStatus: 302,
      processingTimeMs: performance.now() - started,
      policyVersion: `${redirectPolicyVersion}:${campaign.updatedAt.toISOString()}:${campaign.trackingTokenIssuedAt?.toISOString() ?? "none"}`,
      appVersion: redirectAppVersion,
    };
    await withinDeadline(
      prisma.$transaction(
        async (tx) => {
          // Deletion must not race a late durable insert into scalar-ID evidence.
          const workspaces = await tx.$queryRaw<{ id: string }[]>(Prisma.sql`
            SELECT id FROM Project
            WHERE id = ${campaign.projectId} AND disabledAt IS NULL FOR UPDATE
          `);
          if (!workspaces.length)
            throw new TrackingError(404, "CAMPAIGN_UNAVAILABLE");
          await tx.routeVerityRedirectAudit.create({ data: audit });
        },
        { maxWait: 1000, timeout: 1500 },
      ),
      1500,
    );
    response.headers.set(
      "Server-Timing",
      `redirect;dur=${(performance.now() - started).toFixed(2)}`,
    );
    console.info(
      JSON.stringify({
        event: "routeverity.redirect",
        request_id: requestId,
        click_id: clickId,
        status: 302,
        processing_time_ms: performance.now() - started,
        policy_version: redirectPolicyVersion,
        app_version: redirectAppVersion,
      }),
    );
    return response;
  } catch (error) {
    const status = error instanceof TrackingError ? error.status : 503;
    const code =
      error instanceof TrackingError ? error.code : "DEPENDENCY_UNAVAILABLE";
    const record = JSON.stringify({
      event:
        code === "REDIRECT_INTEGRITY_MISMATCH"
          ? "routeverity.redirect.critical"
          : "routeverity.redirect.rejected",
      request_id: requestId,
      status,
      code,
      stage,
      processing_time_ms: performance.now() - started,
    });
    if (status === 503) console.error(record);
    else console.warn(record);
    headers.delete("Location");
    headers.delete("X-RouteVerity-Click-Id");
    if (status === 405) headers.set("Allow", "GET");
    if (status === 429)
      headers.set("Retry-After", String(trackingWindowSeconds));
    return new Response(`RouteVerity tracking request rejected (${code}).`, {
      status,
      headers,
    });
  }
}
