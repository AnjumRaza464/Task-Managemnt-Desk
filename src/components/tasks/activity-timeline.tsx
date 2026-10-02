import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { activityDetail, activityLabel } from "@/lib/activity-format";
import { formatDateTime, timeAgo } from "@/lib/utils";

type Activity = {
  id: string;
  action: string;
  details: unknown;
  createdAt: Date;
  actor: { name: string };
};

export function ActivityTimeline({ activity }: { activity: Activity[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Activity</CardTitle>
      </CardHeader>
      <CardContent>
        {activity.length === 0 ? (
          <p className="text-sm text-muted-foreground">No activity recorded.</p>
        ) : (
          <ol className="relative space-y-4 border-l pl-4">
            {activity.map((a) => {
              const detail = activityDetail(a.action, a.details);
              return (
                <li key={a.id} className="relative text-sm">
                  <span className="absolute -left-[21px] top-1.5 size-2.5 rounded-full border-2 border-background bg-primary" />
                  <p>
                    <span className="font-medium">{a.actor.name}</span> {activityLabel(a.action)}
                  </p>
                  {detail && <p className="text-xs text-muted-foreground">{detail}</p>}
                  <p className="text-xs text-muted-foreground" title={formatDateTime(a.createdAt)}>
                    {timeAgo(a.createdAt)}
                  </p>
                </li>
              );
            })}
          </ol>
        )}
      </CardContent>
    </Card>
  );
}
