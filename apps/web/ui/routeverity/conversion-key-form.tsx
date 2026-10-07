"use client";

import type { FormState } from "@/lib/routeverity/mutations";
import { useCallback, useState } from "react";
import { ActionForm } from "./action-form";

export function ConversionKeyForm({
  action,
}: {
  action: (state: FormState, form: FormData) => Promise<FormState>;
}) {
  const [key, setKey] = useState("");
  const onSuccess = useCallback(
    (state: FormState) => setKey(state.conversionKey ?? ""),
    [],
  );
  return (
    <div className="rv-stack">
      <ActionForm
        action={action}
        label="Issue conversion API key"
        onSuccess={onSuccess}
      >
        <label>
          Key label
          <input name="name" minLength={2} maxLength={60} required />
        </label>
        <label className="flex items-center gap-2">
          <input
            className="!m-0 !w-4"
            type="checkbox"
            name="confirm"
            required
          />
          I confirm this key permits server-to-server conversion creation
        </label>
      </ActionForm>
      {key && (
        <label>
          New conversion API key (shown once)
          <input readOnly autoComplete="off" value={key} />
        </label>
      )}
      <p className="rv-muted">
        Send only in the Authorization: Bearer header. Never put the key in a
        URL or browser script. Tracking credentials cannot create conversions.
      </p>
    </div>
  );
}
