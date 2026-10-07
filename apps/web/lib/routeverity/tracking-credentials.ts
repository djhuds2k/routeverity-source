"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import {
  ActionError,
  perform,
  writableWorkspace,
  type FormState,
} from "./mutations";
import { issueTrackingToken } from "./transparent-policy";

export async function manageTrackingCredential(
  slug: string,
  campaignId: string,
  operation: "ISSUE" | "REVOKE",
  _state: FormState,
  form: FormData,
) {
  return perform(async (userId) => {
    const workspace = await writableWorkspace(userId, slug);
    if (form.get("confirm") !== "on")
      throw new ActionError(
        "Confirm that existing tracking credentials will stop working.",
      );
    if (operation !== "ISSUE" && operation !== "REVOKE")
      throw new ActionError("Unsupported tracking credential operation.");
    const token = operation === "ISSUE" ? issueTrackingToken() : null;
    await prisma.$transaction(async (tx) => {
      await tx.project.update({
        where: { id: workspace.id },
        data: { updatedAt: new Date() },
      });
      const campaign = await tx.routeVerityCampaign.findFirst({
        where: { id: campaignId, projectId: workspace.id },
      });
      if (!campaign)
        throw new ActionError("Campaign not found in this workspace.");
      if (token && !campaign.trackingDomainId)
        throw new ActionError(
          "Assign and save a transparent tracking domain before issuing a credential.",
        );
      await tx.routeVerityCampaign.update({
        where: { id: campaignId },
        data: {
          trackingTokenHash: token?.hash ?? null,
          trackingTokenIssuedAt: token ? new Date() : null,
          // Credential rotation is independent of the editable policy revision.
          updatedAt: campaign.updatedAt,
        },
      });
    });
    revalidatePath(`/app/${slug}/campaigns/${campaignId}`);
    return token
      ? {
          message:
            "Credential issued. Copy it now; the secret cannot be recovered.",
          trackingToken: token.token,
        }
      : {
          message: "Credential revoked. Previous tracking URLs no longer work.",
        };
  });
}
