import type { ReactNode } from "react";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { UserDetailActions } from "@/components/users/user-detail-actions";
import { UserOwnershipClaims } from "@/components/users/user-ownership-claims";
import { VerificationBadge } from "@/components/users/verification-badge";
import { ensurePortalAccount, isAuthUuid, isPublicId, requireStaffPage } from "@/lib/portal/accounts";
import { fetchRegisteredUser } from "@/lib/registered-users";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const metadata = { title: "User · Honic" };

export default async function RegisteredUserPage(props: { params: Promise<{ id: string }> }) {
  const db = await requireStaffPage();
  const { id: raw } = await props.params;
  const id = String(raw ?? "").trim();

  // Legacy bookmarks with auth UUID → redirect to opaque public id.
  if (isAuthUuid(id)) {
    const publicId = await ensurePortalAccount(db, id).catch(() => null);
    if (!publicId) notFound();
    redirect(`/users/${publicId}`);
  }
  if (!isPublicId(id)) notFound();

  let user: Awaited<ReturnType<typeof fetchRegisteredUser>> = null;
  let error: string | null = null;
  try {
    user = await fetchRegisteredUser(db, id);
  } catch (err) {
    error = err instanceof Error ? err.message : "Could not load this user.";
  }
  if (!error && !user) notFound();
  if (user && user.id !== id.toLowerCase() && isPublicId(user.id)) {
    redirect(`/users/${user.id}`);
  }

  const name = user?.name || user?.email || "User";

  return (
    <DashboardShell
      title={name}
      subtitle={user?.email || "Registered account"}
      statusDotClass={error ? "bg-amber-500" : "bg-emerald-500"}
      headerBelow={
        <div className="flex flex-wrap items-center gap-3">
          <Link href="/users" className="text-dash-accent text-sm font-semibold">
            ← Registered users
          </Link>
          {user ? <VerificationBadge verified={user.emailConfirmed} /> : null}
        </div>
      }
    >
      {error || !user ? (
        <div role="alert" className="border-dash-border bg-dash-card rounded-2xl border border-amber-500/35 px-4 py-3 text-sm text-amber-950 dark:text-amber-100">
          <p className="font-medium">Could not open this user.</p>
          <p className="mt-1">{error}</p>
        </div>
      ) : (
        <div className="space-y-4">
          <section className="border-dash-border bg-dash-card rounded-2xl border p-4 shadow-sm">
            <h2 className="text-dash-foreground text-sm font-semibold">Actions</h2>
            <p className="text-dash-muted-foreground mt-1 mb-3 text-xs">
              Password reset emails a link. Block stops sign-in. Release title puts the title back on the list and gives one free change.
            </p>
            <UserDetailActions
              publicId={user.id}
              email={user.email}
              name={user.name}
              staff={user.staff}
              blocked={user.blocked}
              emailConfirmed={user.emailConfirmed}
              hasProfile={user.profileComplete}
              hasProject={Boolean(user.projectId)}
              hasTitle={Boolean(user.title)}
            />
          </section>

          <div className="grid gap-4 lg:grid-cols-2">
            <Card title="Details">
              <div>
                <Fact label="Name" value={user.name} />
                <Fact label="Email" value={user.email || null} />
                <Fact label="Phone" value={user.phone} />
                <Fact label="Registration number" value={user.regNo} />
                <Fact label="Institution" value={user.institution} />
                <Fact label="Course" value={user.course} />
                <Fact label="Study level" value={user.studyLevel} />
                <Fact label="Year of study" value={user.yearOfStudy} />
                <Fact label="Academic year" value={user.academicYear} />
                <Fact label="Partner" value={user.partner} />
                <Fact label="Project type" value={user.projectCategory} />
                <Fact label="Change credits" value={String(user.changeCredits)} />
                <Fact label="Registered" value={user.registeredOn} />
                <Fact label="Last sign-in" value={user.lastSignIn} />
              </div>
            </Card>

            <Card title="Project and workspace">
              <div>
                <Fact
                  label="Linked project"
                  value={
                    user.projectId ? (
                      <Link href={`/projects/${user.projectId}`} className="text-dash-accent font-semibold">
                        {user.projectTitle ?? "Open project"}
                      </Link>
                    ) : null
                  }
                />
                <Fact label="Selected title" value={user.title?.title ?? null} />
                {user.titles.length > 1 ? (
                  <div className="mt-2">
                    <p className="text-dash-muted-foreground text-xs font-semibold tracking-wide uppercase">All titles</p>
                    <ul className="mt-1 space-y-1 text-sm">
                      {user.titles.map((t) => (
                        <li key={t.id}>{t.title}</li>
                      ))}
                    </ul>
                  </div>
                ) : null}
                {user.workspaces.length ? (
                  <div className="mt-3">
                    <p className="text-dash-muted-foreground text-xs font-semibold tracking-wide uppercase">Workspaces</p>
                    <ul className="mt-1 space-y-1 text-sm">
                      {user.workspaces.map((ws) => (
                        <li key={ws.id}>
                          <Link href={`/students/${ws.id}`} className="text-dash-accent font-semibold">
                            {ws.name}
                          </Link>
                          <span className="text-dash-muted-foreground"> · {ws.role}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : (
                  <Fact label="Workspaces" value={null} />
                )}
              </div>
            </Card>
          </div>

          {user.activity.length ? (
            <Card title="Recent activity">
              <ul className="space-y-2 text-sm">
                {user.activity.map((row, index) => (
                  <li key={`${row.when}-${index}`} className="border-dash-border border-b pb-2 last:border-b-0 last:pb-0">
                    <p className="text-dash-foreground">
                      <span className="font-semibold">{row.who}</span> {row.action}
                    </p>
                    <p className="text-dash-muted-foreground text-xs">{row.when}</p>
                  </li>
                ))}
              </ul>
            </Card>
          ) : null}

          <UserOwnershipClaims userId={user.userId} publicId={user.id} />
        </div>
      )}
    </DashboardShell>
  );
}

function Card({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="border-dash-border bg-dash-card rounded-2xl border p-4 shadow-sm">
      <h2 className="text-dash-foreground mb-3 text-sm font-semibold">{title}</h2>
      {children}
    </section>
  );
}

function Fact({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="border-dash-border grid grid-cols-[8.5rem_minmax(0,1fr)] gap-2 border-b py-2 text-sm last:border-b-0">
      <p className="text-dash-muted-foreground">{label}</p>
      <p className="text-dash-foreground min-w-0 break-words">{value || "—"}</p>
    </div>
  );
}
