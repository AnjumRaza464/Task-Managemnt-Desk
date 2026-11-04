import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireMemberPage } from "@/lib/auth-guard";
import { syncOverdueTasks } from "@/lib/overdue";
import { getProjectForUser } from "@/lib/queries/projects";
import { getTaskFormOptions } from "@/lib/queries/tasks";
import { getAssignableUsers } from "@/lib/queries/users";
import { MemberProjectView } from "@/components/member/member-project-view";

export const metadata: Metadata = { title: "Project" };

export default async function MemberProjectPage({ params }: PageProps<"/my-projects/[id]">) {
  const user = await requireMemberPage();
  await syncOverdueTasks();
  const { id } = await params;
  const data = await getProjectForUser(id, user);
  if (!data) notFound();
  const [users, options] = await Promise.all([getAssignableUsers(), data.access.canManage ? getTaskFormOptions(user) : Promise.resolve(null)]);

  return <MemberProjectView data={data} currentUserId={user.id} users={users} options={options} />;
}
