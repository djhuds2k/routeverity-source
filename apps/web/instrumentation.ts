import type { Instrumentation } from "next";
import { reportOperationalError } from "@/lib/routeverity/safe-error-log";

export const onRequestError: Instrumentation.onRequestError = (error) => {
  reportOperationalError("routeverity.request.failed", error);
};
