"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import { VerificationBadge } from "@/components/users/verification-badge";
import { INPUT } from "@/components/workspace/ws-ui";
import type { RegisteredUserRow } from "@/lib/registered-users";

export function RegisteredUsersTable({ rows }: { rows: RegisteredUserRow[] }) {
  const [query, setQuery] = useState("");
  const [institution, setInstitution] = useState("");
  const [course, setCourse] = useState("");
  const [kind, setKind] = useState("");

  const institutions = useMemo(
    () => [...new Set(rows.map((row) => row.institution).filter((value): value is string => Boolean(value)))].sort(),
    [rows],
  );
  const courses = useMemo(
    () => [...new Set(rows.map((row) => row.course).filter((value): value is string => Boolean(value)))].sort(),
    [rows],
  );

  const needle = query.trim().toLowerCase();
  function formatTsh(n: number): string {
    return n > 0 ? `TSh ${n.toLocaleString("en-US")}` : "—";
  }

  const list = rows.filter((row) => {
    const haystack = `${row.name ?? ""} ${row.email} ${row.phone ?? ""}`.toLowerCase();
    if (needle && !haystack.includes(needle)) return false;
    if (institution && row.institution !== institution) return false;
    if (course && row.course !== course) return false;
    if (kind === "staff" && !row.staff) return false;
    if (kind === "student" && row.staff) return false;
    if (kind === "waiting" && (row.staff || row.profileComplete)) return false;
    return true;
  });

  return (
    <div>
      <div className="mb-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search name, email or phone"
          className={INPUT}
          aria-label="Search users"
        />
        <select value={institution} onChange={(event) => setInstitution(event.target.value)} className={INPUT} aria-label="Institution">
          <option value="">All institutions</option>
          {institutions.map((value) => (
            <option key={value}>{value}</option>
          ))}
        </select>
        <select value={course} onChange={(event) => setCourse(event.target.value)} className={INPUT} aria-label="Course">
          <option value="">All courses</option>
          {courses.map((value) => (
            <option key={value}>{value}</option>
          ))}
        </select>
        <select value={kind} onChange={(event) => setKind(event.target.value)} className={INPUT} aria-label="Account type">
          <option value="">All accounts</option>
          <option value="student">Students</option>
          <option value="staff">Staff</option>
          <option value="waiting">Signed up, no details yet</option>
        </select>
      </div>

      {list.length === 0 ? (
        <div className="border-dash-border bg-dash-card rounded-2xl border px-5 py-10 text-center">
          <p className="text-dash-muted-foreground text-sm">No accounts match this search.</p>
        </div>
      ) : (
        <div className="border-dash-border bg-dash-card overflow-hidden rounded-2xl border shadow-sm">
          <div className="overflow-x-auto">
            <table className="min-w-[1400px] w-full text-sm">
              <thead className="bg-dash-muted/80 text-dash-muted-foreground text-left text-xs font-semibold tracking-wide uppercase">
                <tr>
                  <th className="px-4 py-3">User</th>
                  <th className="px-4 py-3">Institution</th>
                  <th className="px-4 py-3">Course</th>
                  <th className="px-4 py-3">Plan</th>
                  <th className="px-4 py-3">Titles</th>
                  <th className="px-4 py-3">Claims</th>
                  <th className="px-4 py-3">Jobs</th>
                  <th className="px-4 py-3">Groups</th>
                  <th className="px-4 py-3">Paid</th>
                  <th className="px-4 py-3">Registered</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-dash-border divide-y">
                {list.map((row) => (
                  <tr key={row.id} className="hover:bg-dash-muted/40">
                    <td className="px-4 py-3">
                      <p className="flex flex-wrap items-center gap-2">
                        <span className="text-dash-foreground font-semibold">{row.name ?? "No name yet"}</span>
                        <VerificationBadge verified={row.emailConfirmed} />
                      </p>
                      <p className="text-dash-muted-foreground text-xs">{row.email || "No email"}</p>
                      {row.phone ? <p className="text-dash-muted-foreground text-xs">{row.phone}</p> : null}
                    </td>
                    <td className="text-dash-foreground px-4 py-3">{row.institution ?? "—"}</td>
                    <td className="text-dash-foreground px-4 py-3">{row.course ?? "—"}</td>
                    <td className="px-4 py-3">
                      <p className="text-dash-foreground text-xs font-semibold">{row.staff ? "Staff" : row.planLabel}</p>
                      {!row.staff ? (
                        <p className="text-dash-muted-foreground text-xs">
                          {row.profileComplete ? "Profile saved" : "Details missing"}
                          {row.blocked ? " · Blocked" : ""}
                        </p>
                      ) : null}
                    </td>
                    <td className="px-4 py-3">
                      {row.heldTitleName ? (
                        <p className="text-dash-foreground text-xs font-medium" title={row.heldTitleId ?? undefined}>
                          {row.heldTitleName.slice(0, 42)}
                          {row.heldTitleName.length > 42 ? "…" : ""}
                        </p>
                      ) : (
                        <span className="text-dash-muted-foreground text-xs">—</span>
                      )}
                      <p className="text-dash-muted-foreground mt-0.5 text-xs">Shortlist {row.shortlistCount}</p>
                    </td>
                    <td className="px-4 py-3 text-xs">
                      {row.claimsTotal ? (
                        <>
                          <span className="text-dash-foreground font-semibold">{row.claimsTotal}</span>
                          {row.claimsPending ? (
                            <span className="text-amber-700 dark:text-amber-300"> · {row.claimsPending} pending</span>
                          ) : null}
                        </>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs">
                      {row.jobsPosted ? (
                        <div>
                          <p className="text-dash-foreground font-semibold">{row.jobsPosted}</p>
                          <p className="text-dash-muted-foreground mt-0.5 font-mono text-[10px]" title={row.jobPublicIds.join(", ")}>
                            {row.jobPublicIds.slice(0, 2).join(", ")}
                            {row.jobPublicIds.length > 2 ? ` +${row.jobPublicIds.length - 2}` : ""}
                          </p>
                        </div>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs">
                      {row.groupsCreated ? (
                        <p className="text-dash-foreground font-semibold">{row.groupsCreated}</p>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="text-dash-foreground px-4 py-3 text-xs tabular-nums">{formatTsh(row.paidTotalTsh)}</td>
                    <td className="text-dash-foreground px-4 py-3 whitespace-nowrap">{row.registeredOn}</td>
                    <td className="px-4 py-3 text-right">
                      <Link
                        href={`/users/${row.id}`}
                        className="bg-dash-accent inline-flex rounded-lg px-3 py-1.5 text-xs font-semibold text-white"
                      >
                        View
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-dash-muted-foreground border-dash-border border-t px-4 py-2 text-xs">
            Showing {list.length} of {rows.length}
          </p>
        </div>
      )}
    </div>
  );
}
