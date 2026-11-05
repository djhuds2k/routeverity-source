import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/routeverity/auth";
import {
  deleteAccount,
  deleteWorkspace,
} from "@/lib/routeverity/deletion-actions";
import { ActionForm } from "@/ui/routeverity/action-form";
import Link from "next/link";

export default async function Account() {
  const sessionUser = await requireUser();
  const user = await prisma.user.findUniqueOrThrow({
    where: { id: sessionUser.id },
    select: { email: true },
  });
  const owned = await prisma.projectUsers.findMany({
    where: { userId: sessionUser.id, role: "owner" },
    include: { project: true },
    orderBy: { projectId: "asc" },
  });
  return (
    <main className="rv-page rv-stack max-w-3xl">
      <Link href="/app" className="underline">
        Back to workspaces
      </Link>
      <h1>Account and deletion</h1>
      <p>{user.email}</p>
      <section className="rv-card rv-stack">
        <h2>Export your account data</h2>
        <p>
          Download your current profile, memberships, non-secret
          session/provider metadata and authored-link references. Full workspace
          content requires a separate owner export. Credentials and raw
          user-agent input are never selected. Operator incident history,
          infrastructure logs/backups and customer-submitted personal references
          need separate rights-request review; this is not a complete legal
          subject-access response.
        </p>
        <a href="/account/export" className="underline">
          Download account JSON
        </a>
        <p className="rv-muted">
          Exports have a 10,000-row limit per collection and a 20 MiB total
          limit. Oversized exports fail explicitly with no partial file. Files
          contain personal data; keep them private and delete them when no
          longer needed.
        </p>
      </section>
      <section className="rv-card rv-stack">
        <h2>Permanently delete a workspace</h2>
        <p>
          Deletion removes all workspace memberships, links, domain
          registrations in this application, campaigns, click evidence,
          conversions and credentials from the live database. Other members lose
          access. Operator suspension audits retain the random workspace and
          actor IDs and reason under their separate 365-day policy.
        </p>
        <p className="rv-muted">
          Download any required click exports first. There is no undo or
          automatic backup restoration. Provider backups, logs, exported files
          and external DNS/hosting configuration are not instantly erased or
          changed. Already-authorized in-flight responses may finish, but cannot
          recreate deleted click or conversion records.
        </p>
        {owned.length ? (
          owned.map(({ project }) => (
            <section key={project.id} className="rv-card rv-stack">
              <h3>{project.name}</h3>
              <p>Workspace address: {project.slug}</p>
              <a
                href={`/app/${project.slug}/settings/export`}
                className="underline"
              >
                Download {project.slug} workspace JSON
              </a>
              {project.disabledAt && <p>Suspended workspace</p>}
              <ActionForm
                action={deleteWorkspace.bind(null, project.id)}
                label={`Permanently delete ${project.slug}`}
                preserveValues
              >
                <input
                  type="hidden"
                  name="revision"
                  value={project.updatedAt.toISOString()}
                />
                <label>
                  Type workspace address: {project.slug}
                  <input name="workspaceAddress" required autoComplete="off" />
                </label>
                <label>
                  <input type="checkbox" name="confirmDeletion" required />I
                  confirm permanent deletion of this workspace and its data.
                </label>
              </ActionForm>
            </section>
          ))
        ) : (
          <p>You do not own any workspaces.</p>
        )}
      </section>
      <section className="rv-card rv-stack">
        <h2>Permanently delete your account</h2>
        <p>
          Delete every workspace you own first, including suspended workspaces.
          This prevents silent deletion or abandonment of a shared workspace.
          Ownership transfer is not available in this baseline.
        </p>
        <p>
          Account deletion removes your memberships, account and live login
          sessions/tokens. Links you created in other members&apos; workspaces
          remain available without your author ID. Operator incident audits
          retain the random actor ID and reason for their separate 365-day
          period. Backups, infrastructure logs and previously exported files
          require separate handling. This is not a claim of immediate erasure
          everywhere.
        </p>
        {owned.length ? (
          <p role="status">
            Account deletion is blocked while you own a workspace.
          </p>
        ) : (
          <ActionForm
            action={deleteAccount}
            label="Permanently delete my account"
            preserveValues
          >
            <label>
              Type your email address
              <input name="email" type="email" required autoComplete="off" />
            </label>
            <label>
              <input type="checkbox" name="confirmDeletion" required />I confirm
              permanent account deletion and session revocation.
            </label>
          </ActionForm>
        )}
      </section>
    </main>
  );
}
