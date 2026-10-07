import { saveWorkspace } from "@/lib/routeverity/actions";
import { requireWorkspace } from "@/lib/routeverity/auth";
import { ActionForm } from "@/ui/routeverity/action-form";

export default async function Settings({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const { workspace, user, role } = await requireWorkspace(slug);
  return (
    <main className="rv-page rv-stack max-w-3xl">
      <h1>Settings</h1>
      <section className="rv-card rv-stack">
        <h2>Workspace</h2>
        {role === "owner" ? (
          <ActionForm
            action={saveWorkspace.bind(null, slug)}
            label="Save workspace"
          >
            <label>
              Workspace name
              <input
                name="name"
                defaultValue={workspace.name}
                minLength={2}
                maxLength={60}
                required
              />
            </label>
          </ActionForm>
        ) : (
          <p>{workspace.name} (only the owner can change settings)</p>
        )}
        <p className="rv-muted">Address: {workspace.slug}</p>
      </section>
      <section className="rv-card rv-stack">
        <h2>Account</h2>
        <p>{user.email}</p>
        <p className="rv-muted">
          Access is verified by one-time email links. Workspace role: {role}.
        </p>
      </section>
      <section className="rv-card rv-stack">
        <h2>Plan</h2>
        <p>Free development plan</p>
        <p className="rv-muted">
          Billing is deferred. No subscription or payment is required, and no
          billing action is available.
        </p>
      </section>
    </main>
  );
}
