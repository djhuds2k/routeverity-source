import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/routeverity/auth";
import { getHealthReport } from "@/lib/routeverity/health-monitor";
import { changeWorkspaceAvailability } from "@/lib/routeverity/operator-actions";
import { isOperator } from "@/lib/routeverity/operators";
import { ActionForm } from "@/ui/routeverity/action-form";
import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";

export const dynamic = "force-dynamic";

export default async function Operations({
  searchParams,
}: {
  searchParams: Promise<{ workspace?: string | string[] }>;
}) {
  const user = await requireUser();
  if (!(await isOperator(user.id))) notFound();
  const health = await getHealthReport();
  const search = z
    .string()
    .trim()
    .max(40)
    .regex(/^([a-z0-9]+(-[a-z0-9]+)*)?$/)
    .safeParse((await searchParams).workspace ?? "");
  if (!search.success)
    return (
      <main className="rv-page rv-stack">
        <Link href="/operations">Operator controls</Link>
        <p role="alert">Provide a single valid workspace address.</p>
      </main>
    );
  const workspaces = await prisma.project.findMany({
    where: search.data ? { slug: search.data } : {},
    select: {
      id: true,
      slug: true,
      name: true,
      disabledAt: true,
      updatedAt: true,
    },
    orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
    take: 100,
  });
  const events = await prisma.routeVerityOperatorEvent.findMany({
    where: search.data
      ? { projectId: { in: workspaces.map((workspace) => workspace.id) } }
      : {},
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: 100,
  });
  return (
    <main className="rv-page rv-stack max-w-4xl">
      <Link href="/app">Back to your workspaces</Link>
      <h1>Operator controls</h1>
      <section className="rv-card rv-stack">
        <h2>Worker and dependency health</h2>
        <p>
          {health.healthy
            ? "Current checks healthy"
            : "Operational attention required"}
        </p>
        <p>
          Checked: {health.checkedAt}; database {health.database}; Redis{" "}
          {health.redis}
        </p>
        {health.issues.map((issue) => (
          <p key={issue.code}>
            {issue.severity.toUpperCase()}: {issue.code}
          </p>
        ))}
        {health.snapshot?.workers.map((worker) => (
          <p key={worker.name}>
            {worker.name}: {worker.state}; progress{" "}
            {worker.progressAt.toISOString()}; last success{" "}
            {worker.succeededAt?.toISOString() ?? "never"}
          </p>
        ))}
        <p className="rv-muted">
          This is a checked snapshot, not end-to-end availability or proof that
          production workers are scheduled. Email requires a separately running
          health monitor with --notify and private recipient configuration. An
          external dead-man monitor is still required if this monitor stops.
        </p>
      </section>
      <p className="rv-muted">
        Emergency workspace suspension blocks subsequent access and tracking
        policy lookups. Already authorized in-flight requests may finish.
        Resumption does not restore revoked credentials or separately suspended
        campaigns/domains. Every change requires a reason and a durable audit.
      </p>
      <form className="rv-stack" method="get">
        <label>
          Workspace address
          <input name="workspace" maxLength={40} defaultValue={search.data} />
        </label>
        <button className="rv-button w-fit" type="submit">
          Find workspace
        </button>
        <Link href="/operations">Show recent workspaces</Link>
      </form>
      <p className="rv-muted">
        Showing up to 100 workspaces and 100 audit events. Use an exact
        workspace address to find older workspaces. Do not include secrets or
        personal data in reasons.
      </p>
      {!workspaces.length && <p>No matching workspaces.</p>}
      {workspaces.map((workspace) => (
        <section key={workspace.id} className="rv-card rv-stack">
          <h2>{workspace.name}</h2>
          <p>
            {workspace.slug} -{" "}
            {workspace.disabledAt ? "Suspended" : "Available"}
          </p>
          <ActionForm
            action={changeWorkspaceAvailability.bind(null, workspace.id)}
            label={
              workspace.disabledAt ? "Resume workspace" : "Suspend workspace"
            }
            preserveValues
          >
            <input
              type="hidden"
              name="revision"
              value={workspace.updatedAt.toISOString()}
            />
            <input
              type="hidden"
              name="operation"
              value={workspace.disabledAt ? "resume" : "suspend"}
            />
            <label>
              Reason
              <textarea name="reason" required maxLength={500} />
            </label>
          </ActionForm>
        </section>
      ))}
      <section className="rv-stack">
        <h2>Recent operator audit</h2>
        {!events.length && <p>No operator changes recorded.</p>}
        {events.map((event) => (
          <article className="rv-card break-words" key={event.id}>
            <p>
              {event.operation} - {event.createdAt.toISOString()}
            </p>
            <p>
              Workspace: {event.projectId}; actor: {event.actorId}
            </p>
            <p>{event.reason}</p>
          </article>
        ))}
      </section>
    </main>
  );
}
