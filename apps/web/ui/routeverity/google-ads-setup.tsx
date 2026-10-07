"use client";

import { brand } from "@/lib/routeverity/brand";
import type { FormState } from "@/lib/routeverity/mutations";
import { useCallback, useState } from "react";
import { ActionForm } from "./action-form";

export function GoogleAdsSetup({
  action,
  issuedToken,
}: {
  action: (state: FormState, form: FormData) => Promise<FormState>;
  issuedToken: string;
}) {
  const [result, setResult] = useState<FormState>({});
  const onSuccess = useCallback((state: FormState) => setResult(state), []);
  const generate = useCallback(
    async (state: FormState, form: FormData) => {
      setResult({});
      return action(state, form);
    },
    [action],
  );
  return (
    <section className="rv-stack">
      <h3>Google Ads setup (local evaluation)</h3>
      <p className="rv-muted">
        Status: {brand.certificationStatus}. No Google certification, live Ads
        test or parallel-tracking verification is claimed.
      </p>
      <ActionForm
        action={generate}
        label="Generate Google Ads template"
        preserveValues
        onSuccess={onSuccess}
      >
        <label>
          Google setup tracking credential
          <input
            key={issuedToken}
            name="token"
            defaultValue={issuedToken}
            autoComplete="off"
            required
            maxLength={47}
          />
        </label>
        <label>
          Sample Google final URL
          <input name="destination" type="url" maxLength={8000} required />
        </label>
        <label>
          Final URL insertion
          <select name="insertion" defaultValue="escapedlpurl">
            <option value="escapedlpurl">
              {"{escapedlpurl} - single escaped final URL"}
            </option>
            <option value="lpurl">
              {"{lpurl} - escaped when nested in this template"}
            </option>
          </select>
        </label>
      </ActionForm>
      {result.googleTemplate && (
        <div className="rv-stack">
          <label>
            Google Ads tracking template
            <textarea readOnly rows={5} value={result.googleTemplate} />
          </label>
          <label>
            Local Google-style expansion
            <textarea readOnly rows={5} value={result.googlePreview} />
          </label>
          <label>
            Validated sample next hop
            <textarea readOnly rows={3} value={result.googleValidatedTarget} />
          </label>
        </div>
      )}
      <p>
        Paste the tracking template into the intended Google Ads campaign,
        leaving the ad Final URL as the merchant HTTPS page. Account-level use
        binds every inheriting ad to this one RouteVerity campaign and its
        approved hostnames. More-specific templates override it.
      </p>
      <p className="rv-muted">
        Keep braces literal; do not double-encode or use +2/+3 URL macros. This
        preview models a single encoded substitution and does not contact Google
        or the landing page. Verify actual encoding with Google Ads Test after
        DNS/TLS and deployment. Templates contain a revocable bearer credential;
        never share them in public logs.
      </p>
      <p className="rv-muted">
        Parallel tracking sends visitors directly to their final URL and
        measures separately. Our response-header click ID does not automatically
        reach the merchant. Conversion uploads, automatic click-to-merchant
        correlation and raw Google ID retention are not provided.
        GCLID/GBRAID/WBRAID are fingerprinted only; braid macros are not
        invented by this generator.
      </p>
      <a className="underline" href="/google-ads">
        Google Ads availability and official references
      </a>
    </section>
  );
}
