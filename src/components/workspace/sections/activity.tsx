import { Empty, Panel } from "@/components/workspace/ws-ui";
import { formatDateTime } from "@/lib/workspace/dates";
import type { Activity } from "@/lib/workspace/types";

export function ActivityList({ activity, full, limit = 8 }: { activity: Activity[]; full?: boolean; limit?: number }) {
  const list = full ? activity : activity.slice(0, limit);
  return (
    <Panel title={full ? "Activity history" : "Recent activity"} subtitle={full ? "Who changed what, newest first." : undefined}>
      {list.length ? (
        <ol className="space-y-2.5">
          {list.map((a) => (
            <li key={a.id} className="flex gap-3 text-sm">
              <span className="bg-dash-accent mt-1.5 h-2 w-2 shrink-0 rounded-full" aria-hidden />
              <div className="min-w-0">
                <p className="text-dash-foreground">
                  <span className="font-semibold">{a.actor_name}</span> {a.action}
                </p>
                <p className="text-dash-muted-foreground text-xs">{formatDateTime(a.created_at)}</p>
              </div>
            </li>
          ))}
        </ol>
      ) : (
        <Empty title="No activity yet" />
      )}
    </Panel>
  );
}
