import Link from "next/link";

export function UsersRequestLinks({
  totalUsers,
  pendingRequests,
}: {
  totalUsers: number;
  pendingRequests: number;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-center gap-3">
      <p className="text-dash-foreground text-sm font-semibold tabular-nums">
        Total users: {totalUsers}
      </p>
      <Link
        href="/users/requests"
        className="border-dash-border bg-dash-card hover:bg-dash-muted inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-sm font-semibold shadow-sm"
      >
        Requested titles
        {pendingRequests > 0 ? (
          <span className="bg-dash-accent inline-flex min-w-6 items-center justify-center rounded-full px-1.5 py-0.5 text-xs font-bold text-white tabular-nums">
            {pendingRequests > 99 ? "99+" : pendingRequests}
          </span>
        ) : (
          <span className="text-dash-muted-foreground text-xs font-medium">0 new</span>
        )}
      </Link>
    </div>
  );
}
