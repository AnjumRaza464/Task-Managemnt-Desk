import Link from "next/link";
import { Activity } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { activityDetail, activityLabel } from "@/lib/activity-format";
import { formatDateTime, timeAgo } from "@/lib/utils";

type Row = {
  id: string;
  action: string;
  details: unknown;
  createdAt: Date;
  actor: { name: string };
  task: { id: string; title: string } | null;
};

export function ProjectActivity({ activity, taskHref }: { activity: Row[]; taskHref: string }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Activity className="size-4 text-muted-foreground" /> Activity
        </CardTitle>
        <CardDescription>Everything that happened in this project, newest first.</CardDescription>
      </CardHeader>
      <CardContent>
        {activity.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">No activity yet.</p>
        ) : (
          <ol className="relative space-y-4 border-l pl-4">
            {activity.map((a) => {
              const detail = activityDetail(a.action, a.details);
              return (
                <li key={a.id} className="relative text-sm">
                  <span className="absolute -left-[21px] top-1.5 size-2.5 rounded-full border-2 border-background bg-primary" />
                  <p>
                    <span className="font-medium">{a.actor.name}</span> {activityLabel(a.action)}
                    {a.task && (
                      <>
                        {" on "}
                        <Link href={`${taskHref}/${a.task.id}`} className="font-medium hover:underline">
                          {a.task.title}
                        </Link>
                      </>
                    )}
                  </p>
                  <p className="text-xs text-muted-foreground" title={formatDateTime(a.createdAt)}>
                    {detail && <span>{detail} · </span>}
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
