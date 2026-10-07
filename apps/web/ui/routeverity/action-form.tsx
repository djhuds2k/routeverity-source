"use client";

import type { FormState } from "@/lib/routeverity/actions";
import { Button } from "@dub/ui";
import { useRouter } from "next/navigation";
import { startTransition, useActionState, useEffect } from "react";

export function ActionForm({
  action,
  children,
  label,
  secondary = false,
  onSuccess,
  preserveValues = false,
}: {
  action: (state: FormState, form: FormData) => Promise<FormState>;
  children?: React.ReactNode;
  label: string;
  secondary?: boolean;
  onSuccess?: (state: FormState) => void;
  preserveValues?: boolean;
}) {
  const [state, formAction, pending] = useActionState(action, {});
  const router = useRouter();
  useEffect(() => {
    if (state.href) router.push(state.href);
    if (state.message) {
      onSuccess?.(state);
      router.refresh();
    }
  }, [state, router, onSuccess]);
  return (
    <form
      action={preserveValues ? undefined : formAction}
      className="rv-stack"
      onSubmit={
        preserveValues
          ? (event) => {
              event.preventDefault();
              const form = new FormData(event.currentTarget);
              // Resolved validation errors must not trigger React's native form reset.
              startTransition(() => formAction(form));
            }
          : undefined
      }
    >
      {children}
      <Button
        type="submit"
        text={label}
        loading={pending}
        variant={secondary ? "secondary" : "primary"}
        className={secondary ? "w-fit" : "rv-button w-fit"}
      />
      {state.error && (
        <p role="alert" className="text-[var(--rv-danger)]">
          {state.error}
        </p>
      )}
      {state.message && (
        <p role="status" className="text-[var(--rv-success)]">
          {state.message}
        </p>
      )}
    </form>
  );
}
