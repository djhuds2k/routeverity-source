"use server";

import { prisma } from "@/lib/prisma";
import {
  campaignReadiness,
  isCampaignDestinationAllowed,
} from "./campaign-policy";
import {
  buildGoogleAdsTemplate,
  expandGoogleAdsTemplate,
} from "./google-ads-policy";
import {
  ActionError,
  perform,
  writableWorkspace,
  type FormState,
} from "./mutations";
import {
  parseTrackingRequest,
  tokenMatches,
  TrackingError,
  validateTransparentDestination,
} from "./transparent-policy";

export async function generateGoogleAdsSetup(
  slug: string,
  campaignId: string,
  _state: FormState,
  form: FormData,
) {
  return perform(async (userId) => {
    const workspace = await writableWorkspace(userId, slug);
    const campaign = await prisma.routeVerityCampaign.findFirst({
      where: { id: campaignId, projectId: workspace.id },
      include: { destinationDomains: true, trackingDomain: true },
    });
    if (!campaign)
      throw new ActionError("Campaign not found in this workspace.");
    const readiness = campaignReadiness(campaign);
    if (readiness) throw new ActionError(readiness);
    if (
      !campaign.trackingDomain ||
      campaign.trackingDomain.projectId !== workspace.id
    )
      throw new ActionError("Assign an owned tracking domain.");
    const token = String(form.get("token") ?? "");
    if (
      !/^rvt_[A-Za-z0-9_-]{43}$/.test(token) ||
      !tokenMatches(token, campaign.trackingTokenHash)
    )
      throw new ActionError(
        "Enter the current campaign tracking credential. Rotate it if lost.",
      );
    const insertion = form.get("insertion");
    if (insertion !== "lpurl" && insertion !== "escapedlpurl")
      throw new ActionError(
        "Choose a supported single-escape URL insertion parameter.",
      );
    let validated;
    try {
      validated = validateTransparentDestination(
        String(form.get("destination") ?? ""),
      );
    } catch (error) {
      if (!(error instanceof TrackingError)) throw error;
      throw new ActionError(
        "Enter a valid public HTTPS final URL with no credentials or unsafe characters.",
      );
    }
    if (
      !isCampaignDestinationAllowed(
        validated.destination,
        campaign.destinationDomains,
      )
    )
      throw new ActionError(
        "The sample final URL hostname is not approved by this campaign.",
      );
    const template = buildGoogleAdsTemplate({
      domain: campaign.trackingDomain.slug,
      campaignId: campaign.id,
      token,
      insertion,
    });
    const preview = expandGoogleAdsTemplate(template, validated.destination);
    try {
      parseTrackingRequest(preview);
    } catch (error) {
      if (!(error instanceof TrackingError)) throw error;
      throw new ActionError(
        "The expanded sample exceeds the supported tracking query bounds.",
      );
    }
    return {
      message:
        "Template generated against saved policy. Local expansion is not a live Google Ads test.",
      googleTemplate: template,
      googlePreview: preview,
      googleValidatedTarget: validated.destination,
    };
  });
}
