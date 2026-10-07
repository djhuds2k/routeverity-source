"use client";

import { Button } from "@dub/ui";
import { signIn } from "next-auth/react";
import { useState } from "react";

export function LoginForm() {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  return (
    <form
      className="rv-stack"
      onSubmit={async (event) => {
        event.preventDefault();
        setPending(true);
        setError("");
        const email = String(new FormData(event.currentTarget).get("email"))
          .trim()
          .toLowerCase();
        try {
          const result = await signIn("email", {
            email,
            callbackUrl: "/app",
            redirect: false,
          });
          if (!result || result.error)
            setError(
              "We could not send your sign-in link. Check your email address, wait a few minutes, or check the application logs.",
            );
          else window.location.assign("/login/check-email");
        } catch (cause) {
          console.error("Email sign-in failed", cause);
          setError("Sign-in is unavailable. Please retry.");
        } finally {
          setPending(false);
        }
      }}
    >
      <label>
        Email address
        <input
          name="email"
          type="email"
          autoComplete="email"
          maxLength={254}
          required
          placeholder="you@company.com"
        />
      </label>
      <Button
        className="rv-button"
        type="submit"
        text="Send sign-in link"
        loading={pending}
      />
      {error && (
        <p role="alert" className="text-[var(--rv-danger)]">
          {error}
        </p>
      )}
      <p className="rv-muted text-xs">
        A secure, one-time email link signs you in or creates your account. No
        password required.
      </p>
    </form>
  );
}
