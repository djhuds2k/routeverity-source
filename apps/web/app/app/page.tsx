import { prisma } from "@/lib/prisma";
import { createWorkspace } from "@/lib/routeverity/actions";
import { requireUser } from "@/lib/routeverity/auth";
import { brand } from "@/lib/routeverity/brand";
import { ActionForm } from "@/ui/routeverity/action-form";
import { SignOut } from "@/ui/routeverity/sign-out";
import Image from "next/image";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function Workspaces() {
  const user = await requireUser();
  const memberships = await prisma.projectUsers.findMany({
    where: { userId: user.id, project: { disabledAt: null } },
    include: { project: true },
    orderBy: { createdAt: "asc" },
  });
  return (
    <main className="rv-page rv-stack max-w-3xl">
      <header className="flex items-center justify-between">
        <Link href="/">
          <Image
            src={brand.wordmark}
            alt="RouteVerity"
            width={200}
            height={50}
          />
        </Link>
        <SignOut />
      </header>
      <div>
        <h1>Your workspaces</h1>
        <p className="rv-muted mt-2">{user.email}</p>
      </div>
      {memberships.map(({ project }) => (
        <Link
          key={project.id}
          href={`/app/${project.slug}`}
          className="rv-card flex items-center justify-between"
        >
          <span className="font-semibold">{project.name}</span>
          <span className="rv-muted">Open workspace &rarr;</span>
        </Link>
      ))}
      {!memberships.length && (
        <p>Create your first workspace to get started.</p>
      )}
      <section className="rv-card rv-stack">
        <h2>Create a workspace</h2>
        <ActionForm action={createWorkspace} label="Create workspace">
          <label>
            Workspace name
            <input name="name" minLength={2} maxLength={60} required />
          </label>
          <label>
            Workspace address
            <input
              name="slug"
              minLength={3}
              maxLength={40}
              pattern="[a-z0-9]+(-[a-z0-9]+)*"
              required
              placeholder="your-team"
            />
          </label>
        </ActionForm>
      </section>
    </main>
  );
}
