import { z } from "zod";

export const retentionDayOptions = [30, 60, 90] as const;
export const maximumRetentionDays = 90;
export const operatorRetentionDays = 365;
export const rawUserAgentRetentionHours = 24;
export const retentionDaysSchema = z.enum(["30", "60", "90"]).transform(Number);

export function retentionCutoffs(now: Date, days: number) {
  if (!Number.isFinite(now.getTime()))
    throw new Error("Retention requires a valid reference time.");
  if (!retentionDayOptions.some((option) => option === days))
    throw new Error("Retention must be 30, 60 or 90 days.");
  return {
    records: new Date(now.getTime() - days * 86_400_000),
    operator: new Date(now.getTime() - operatorRetentionDays * 86_400_000),
    rawUserAgent: new Date(
      now.getTime() - rawUserAgentRetentionHours * 3_600_000,
    ),
  };
}

export function validateRetentionBatchSize(limit: number) {
  if (!Number.isInteger(limit) || limit < 1 || limit > 500)
    throw new Error("Retention batch size must be between 1 and 500.");
}
