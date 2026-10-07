import { prisma } from "@/lib/prisma";
import { addDomain, changeDomain } from "@/lib/routeverity/actions";
import { requireWorkspace } from "@/lib/routeverity/auth";
import { canWrite } from "@/lib/routeverity/validation";
import { ActionForm } from "@/ui/routeverity/action-form";

export default async function Domains({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const { workspace, role } = await requireWorkspace(slug);
  const domains = await prisma.domain.findMany({
    where: { projectId: workspace.id },
    orderBy: { createdAt: "asc" },
  });
  return (
    <main className="rv-page rv-stack">
      <div>
        <h1>Domains</h1>
        <p className="rv-muted mt-2">
          Manage ownership and availability. Hosting and TLS are not
          automatically provisioned.
        </p>
      </div>
      {!domains.length && (
        <section className="rv-card">No domains yet.</section>
      )}
      {domains.map((domain) => (
        <section className="rv-card rv-stack" key={domain.id}>
          <div className="flex flex-wrap justify-between gap-3">
            <h2 className="break-all">{domain.slug}</h2>
            <span>
              {domain.suspendedAt
                ? "Suspended"
                : domain.verified
                  ? domain.type === "DEVELOPMENT"
                    ? "Verified"
                    : "Ownership verified"
                  : "Pending verification"}
            </span>
          </div>
          <dl className="grid gap-4 sm:grid-cols-3">
            <div>
              <dt className="rv-muted">Type</dt>
              <dd>{domain.type.replaceAll("_", " ")}</dd>
            </div>
            <div>
              <dt className="rv-muted">DNS ownership</dt>
              <dd>
                {domain.type === "DEVELOPMENT"
                  ? "Local only"
                  : domain.verified
                    ? "TXT record verified"
                    : "Not verified"}
              </dd>
            </div>
            <div>
              <dt className="rv-muted">TLS</dt>
              <dd>
                {domain.type === "DEVELOPMENT"
                  ? "Not applicable (local HTTP)"
                  : "Not checked / managed externally"}
              </dd>
            </div>
          </dl>
          {domain.type === "TRANSPARENT_TRACKING" && (
            <p className="rv-muted">
              Transparent tracking uses HTTPS /click with an active campaign and
              a valid tracking credential. TXT verification proves ownership,
              not working DNS routing or TLS.
            </p>
          )}
          {domain.type !== "DEVELOPMENT" && (
            <div className="rounded-lg bg-neutral-50 p-4">
              <p>
                Publish a TXT record at <code>_routeverity.{domain.slug}</code>:
              </p>
              <code className="mt-2 block break-all">
                routeverity-verification={domain.verificationToken}
              </code>
              <p className="rv-muted mt-3">
                Configure this hostname on your application host and provision
                TLS separately. Check DNS only verifies the TXT ownership
                record; it does not provision hosting or test HTTPS.
              </p>
            </div>
          )}
          {canWrite(role) && (
            <div className="flex flex-wrap gap-4">
              {domain.type !== "DEVELOPMENT" && (
                <ActionForm
                  action={changeDomain.bind(null, slug, domain.id, "verify")}
                  label="Check DNS"
                  secondary
                />
              )}
              <ActionForm
                action={changeDomain.bind(
                  null,
                  slug,
                  domain.id,
                  domain.suspendedAt ? "resume" : "suspend",
                )}
                label={domain.suspendedAt ? "Resume domain" : "Suspend domain"}
                secondary
              />
              <ActionForm
                action={changeDomain.bind(null, slug, domain.id, "remove")}
                label="Remove domain"
                secondary
              />
            </div>
          )}
        </section>
      ))}
      {canWrite(role) && (
        <section className="rv-card rv-stack max-w-2xl">
          <h2>Add a domain</h2>
          <ActionForm action={addDomain.bind(null, slug)} label="Add domain">
            <label>
              Hostname
              <input
                name="slug"
                placeholder="links.example.com"
                required
                maxLength={253}
              />
            </label>
            <label>
              Domain type
              <select name="type">
                <option value="STANDARD_LINK">Standard link</option>
                <option value="TRANSPARENT_TRACKING">
                  Transparent tracking
                </option>
              </select>
            </label>
          </ActionForm>
        </section>
      )}
    </main>
  );
}
