"use client";

import type { FormState } from "@/lib/routeverity/mutations";
import { useCallback, useState } from "react";
import { ActionForm } from "./action-form";
import { GoogleAdsSetup } from "./google-ads-setup";

export function TrackingCredentialForm({
  issue,
  revoke,
  campaignId,
  domain,
  googleSetup,
}: {
  issue: (state: FormState, form: FormData) => Promise<FormState>;
  revoke: (state: FormState, form: FormData) => Promise<FormState>;
  campaignId: string;
  domain: string | null;
  googleSetup: (state: FormState, form: FormData) => Promise<FormState>;
}) {
  const [token, setToken] = useState("");
  const [destination, setDestination] = useState("");
  const [trackingUrl, setTrackingUrl] = useState("");
  const onSuccess = useCallback((state: FormState) => {
    setToken(state.trackingToken ?? "");
    setTrackingUrl("");
  }, []);
  return (
    <div className="rv-stack">
      <p className="rv-muted">
        A bearer credential binds requests to this campaign and its assigned
        domain. Issuing a new credential immediately invalidates the previous
        one. Copy it once and treat tracking URLs as credentials.
      </p>
      <ActionForm
        action={issue}
        label="Issue / rotate tracking credential"
        onSuccess={onSuccess}
      >
        <label className="flex items-center gap-2">
          <input
            className="!m-0 !w-4"
            type="checkbox"
            name="confirm"
            required
          />
          I confirm rotation invalidates previous tracking URLs
        </label>
      </ActionForm>
      <ActionForm
        action={revoke}
        label="Revoke tracking credential"
        onSuccess={onSuccess}
        secondary
      >
        <label className="flex items-center gap-2">
          <input
            className="!m-0 !w-4"
            type="checkbox"
            name="confirm"
            required
          />
          I confirm revocation stops tracking URLs
        </label>
      </ActionForm>
      {token && (
        <>
          <label>
            New tracking credential (shown once)
            <input readOnly value={token} autoComplete="off" />
          </label>
          {domain && (
            <form
              className="rv-stack"
              onSubmit={(event) => {
                event.preventDefault();
                setTrackingUrl(
                  `https://${domain}/click?${new URLSearchParams({
                    url: destination,
                    rv_campaign: campaignId,
                    rv_token: token,
                  })}`,
                );
              }}
            >
              <label>
                Test next-hop URL
                <input
                  type="url"
                  value={destination}
                  maxLength={8000}
                  onChange={(event) => setDestination(event.target.value)}
                  required
                />
              </label>
              <button type="submit" className="rv-button w-fit">
                Build test tracking URL
              </button>
              {trackingUrl && (
                <label>
                  Test tracking URL
                  <textarea readOnly value={trackingUrl} rows={4} />
                </label>
              )}
            </form>
          )}
          <p className="rv-muted">
            This is not a Google Ads tracking template or a live destination
            check. The endpoint enforces saved policies and HTTPS next hops. DNS
            routing and valid TLS on the tracking domain are your hosting
            responsibility.
          </p>
        </>
      )}
      <GoogleAdsSetup key={token} action={googleSetup} issuedToken={token} />
    </div>
  );
}
