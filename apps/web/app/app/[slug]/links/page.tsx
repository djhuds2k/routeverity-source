import { prisma } from "@/lib/prisma";
import { createLink, deleteLink } from "@/lib/routeverity/actions";
import { requireWorkspace } from "@/lib/routeverity/auth";
import { canWrite } from "@/lib/routeverity/validation";
import { ActionForm } from "@/ui/routeverity/action-form";

export default async function Links({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const { workspace, role } = await requireWorkspace(slug);
  const [links, domains] = await Promise.all([
    prisma.link.findMany({
      where: { projectId: workspace.id },
      orderBy: { createdAt: "desc" },
    }),
    prisma.domain.findMany({
      where: {
        projectId: workspace.id,
        verified: true,
        suspendedAt: null,
        type: { not: "TRANSPARENT_TRACKING" },
      },
    }),
  ]);
  return (
    <main className="rv-page rv-stack">
      <div>
        <h1>Links</h1>
        <p className="rv-muted mt-2">
          Basic standard redirects. Click measurement is not enabled.
        </p>
      </div>
      <section className="rv-card overflow-x-auto">
        {links.length ? (
          <table className="w-full">
            <thead>
              <tr>
                <th>Link</th>
                <th>Destination</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {links.map((link) => (
                <tr key={link.id}>
                  <td>
                    <a
                      className="underline"
                      href={link.shortLink}
                      target="_blank"
                      rel="noreferrer"
                    >
                      {link.shortLink}
                    </a>
                  </td>
                  <td className="max-w-xs break-all">{link.url}</td>
                  <td>
                    {canWrite(role) && (
                      <ActionForm
                        action={deleteLink.bind(null, slug, link.id)}
                        label="Remove link"
                        secondary
                      />
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="rv-muted py-8 text-center">
            No links yet. Create your first standard link below.
          </p>
        )}
      </section>
      {canWrite(role) && (
        <section className="rv-card rv-stack max-w-2xl">
          <h2>Create a link</h2>
          {domains.length ? (
            <ActionForm
              action={createLink.bind(null, slug)}
              label="Create link"
            >
              <label>
                Domain
                <select name="domainId" required>
                  {domains.map((domain) => (
                    <option value={domain.id} key={domain.id}>
                      {domain.type === "DEVELOPMENT"
                        ? "Local development"
                        : domain.slug}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Link key
                <input
                  name="key"
                  required
                  maxLength={80}
                  pattern={"[a-zA-Z0-9_\\-]+"}
                  placeholder="summer-launch"
                />
              </label>
              <label>
                Destination URL
                <input
                  name="url"
                  type="url"
                  required
                  maxLength={8000}
                  placeholder="https://example.com"
                />
              </label>
            </ActionForm>
          ) : (
            <p className="rv-muted">
              Add and verify a standard domain before creating a link.
            </p>
          )}
        </section>
      )}
    </main>
  );
}
