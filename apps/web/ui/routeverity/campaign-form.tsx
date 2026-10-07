"use client";

import type { FormState } from "@/lib/routeverity/mutations";
import { useCallback, useState } from "react";
import { ActionForm } from "./action-form";

export type CampaignFormValues = {
  name: string;
  advertiser: string;
  trafficSource: string;
  externalCampaignId: string;
  currency: string;
  status: string;
  trackingDomainId: string;
  notes: string;
  revision: string;
  destinationDomains: { hostname: string; includeSubdomains: boolean }[];
  trackingParameters: Record<string, string | undefined>;
};

export function CampaignForm({
  action,
  initial,
  domains,
  currencies,
  sources,
  statuses,
  parameterKeys,
}: {
  action: (state: FormState, form: FormData) => Promise<FormState>;
  initial?: CampaignFormValues;
  domains: { id: string; slug: string; available: boolean }[];
  currencies: string[];
  sources: { value: string; label: string }[];
  statuses: readonly string[];
  parameterKeys: readonly string[];
}) {
  const [revision, setRevision] = useState(initial?.revision ?? "");
  const onSuccess = useCallback((state: FormState) => {
    if (state.revision) setRevision(state.revision);
  }, []);
  const [values, setValues] = useState({
    name: initial?.name ?? "",
    advertiser: initial?.advertiser ?? "",
    trafficSource: initial?.trafficSource ?? "GOOGLE_ADS",
    externalCampaignId: initial?.externalCampaignId ?? "",
    currency: initial?.currency ?? "GBP",
    status: initial?.status ?? "DRAFT",
    trackingDomainId: initial?.trackingDomainId ?? "",
    notes: initial?.notes ?? "",
  });
  const updateField = (key: keyof typeof values, value: string) =>
    setValues((current) => ({ ...current, [key]: value }));
  const [parameters, setParameters] = useState(
    initial?.trackingParameters ?? {},
  );
  const [rules, setRules] = useState(initial?.destinationDomains ?? []);
  const updateRule = (index: number, data: Partial<(typeof rules)[number]>) =>
    setRules((current) =>
      current.map((rule, position) =>
        position === index ? { ...rule, ...data } : rule,
      ),
    );
  return (
    <ActionForm
      action={action}
      label={initial ? "Save campaign" : "Create campaign"}
      onSuccess={onSuccess}
      preserveValues
    >
      {initial && <input name="revision" type="hidden" value={revision} />}
      <div className="grid gap-5 sm:grid-cols-2">
        <label>
          Campaign name
          <input
            name="name"
            value={values.name}
            onChange={(event) => updateField("name", event.target.value)}
            minLength={2}
            maxLength={120}
            required
          />
        </label>
        <label>
          Advertiser
          <input
            name="advertiser"
            value={values.advertiser}
            onChange={(event) => updateField("advertiser", event.target.value)}
            minLength={2}
            maxLength={120}
            required
          />
        </label>
        <label>
          Traffic source
          <select
            name="trafficSource"
            value={values.trafficSource}
            onChange={(event) =>
              updateField("trafficSource", event.target.value)
            }
          >
            {sources.map((source) => (
              <option key={source.value} value={source.value}>
                {source.label}
              </option>
            ))}
          </select>
        </label>
        <label>
          External campaign ID
          <input
            name="externalCampaignId"
            value={values.externalCampaignId}
            onChange={(event) =>
              updateField("externalCampaignId", event.target.value)
            }
            maxLength={200}
          />
        </label>
        <label>
          Currency
          <select
            name="currency"
            value={values.currency}
            onChange={(event) => updateField("currency", event.target.value)}
          >
            {currencies.map((currency) => (
              <option key={currency}>{currency}</option>
            ))}
          </select>
        </label>
        <label>
          Status
          <select
            name="status"
            value={values.status}
            onChange={(event) => updateField("status", event.target.value)}
          >
            {statuses.map((status) => (
              <option key={status} value={status}>
                {status.charAt(0) + status.slice(1).toLowerCase()}
              </option>
            ))}
          </select>
        </label>
      </div>
      <label>
        Tracking domain
        <select
          name="trackingDomainId"
          value={values.trackingDomainId}
          onChange={(event) =>
            updateField("trackingDomainId", event.target.value)
          }
        >
          <option value="">Unassigned</option>
          {domains.map((domain) => (
            <option key={domain.id} value={domain.id}>
              {domain.slug}
              {!domain.available ? " (unavailable / unverified)" : ""}
            </option>
          ))}
        </select>
      </label>
      <p className="rv-muted">
        Drafts may be incomplete. Active requires a verified, unsuspended
        transparent tracking domain and at least one approved destination.
        Redirects also require an issued credential and tracking-domain DNS/TLS.
        Active status alone does not make a domain publicly reachable.
      </p>
      <fieldset className="rv-stack">
        <legend className="mb-3 font-semibold">
          Allowed landing-page domains
        </legend>
        <p className="rv-muted">
          Exact hostname matching is the default. Include subdomains only when
          you control and approve them. Do not approve a shared hosting
          provider&apos;s parent domain.
        </p>
        <input
          type="hidden"
          name="destinationDomains"
          value={JSON.stringify(rules)}
        />
        {rules.map((rule, index) => (
          <div
            className="flex flex-col gap-3 rounded-lg border border-[var(--rv-border)] p-4 sm:flex-row sm:items-end"
            key={index}
          >
            <label className="flex-1">
              Destination hostname {index + 1}
              <input
                value={rule.hostname}
                maxLength={253}
                placeholder="shop.example.com"
                onChange={(event) =>
                  updateRule(index, { hostname: event.target.value })
                }
                required
              />
            </label>
            <label className="flex items-center gap-2 py-2">
              <input
                className="!m-0 !w-4"
                type="checkbox"
                checked={rule.includeSubdomains}
                onChange={(event) =>
                  updateRule(index, { includeSubdomains: event.target.checked })
                }
              />
              Include subdomains {index + 1}
            </label>
            <button
              type="button"
              className="rv-button rv-secondary"
              onClick={() =>
                setRules((current) =>
                  current.filter((_, position) => position !== index),
                )
              }
            >
              Remove hostname {index + 1}
            </button>
          </div>
        ))}
        <button
          type="button"
          className="rv-button rv-secondary w-fit"
          disabled={rules.length >= 50}
          onClick={() =>
            setRules((current) => [
              ...current,
              { hostname: "", includeSubdomains: false },
            ])
          }
        >
          Add destination hostname
        </button>
      </fieldset>
      <fieldset className="rv-stack">
        <legend className="mb-3 font-semibold">
          Tracking parameters (saved configuration)
        </legend>
        <p className="rv-muted">
          Optional UTM metadata, stored only. Existing destination parameters
          are not changed. Google Ads templates are generated separately from
          the saved campaign's tracking credential and destination policy.
        </p>
        <div className="grid gap-5 sm:grid-cols-2">
          {parameterKeys.map((key) => (
            <label key={key}>
              {key}
              <input
                name={key}
                maxLength={500}
                value={parameters[key] ?? ""}
                onChange={(event) =>
                  setParameters((current) => ({
                    ...current,
                    [key]: event.target.value,
                  }))
                }
              />
            </label>
          ))}
        </div>
      </fieldset>
      <label>
        Notes
        <textarea
          name="notes"
          value={values.notes}
          onChange={(event) => updateField("notes", event.target.value)}
          maxLength={5000}
          rows={4}
        />
      </label>
    </ActionForm>
  );
}
