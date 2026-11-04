import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireMemberPage } from "@/lib/auth-guard";
import { after } from "next/server";
import { syncOverdueTasks } from "@/lib/overdue";
import { getProjectForUser } from "@/lib/queries/projects";
import { getTaskFormOptions } from "@/lib/queries/tasks";
import { getAssignableUsers } from "@/lib/queries/users";
import { MemberProjectView } from "@/components/member/member-project-view";

export const metadata: Metadata = { title: "Project" };

export default async function MemberProjectPage({ params }: PageProps<"/my-projects/[id]">) {
  const user = await requireMemberPage();
  // Overdue sync runs after the response is sent so it never delays the page.
  after(() => syncOverdueTasks());
  const { id } = await params;
  // One round of parallel queries; the form options are only handed to people who can manage tasks here.
  const [data, users, options] = await Promise.all([
    getProjectForUser(id, user),
    getAssignableUsers(),
    user.role === "MEMBER" ? Promise.resolve(null) : getTaskFormOptions(user),
  ]);
  if (!data) notFound();
  const formOptions = data.access.canManage ? (options ?? (await getTaskFormOptions(user))) : null;

  return <MemberProjectView data={data} currentUserId={user.id} users={users} options={formOptions} />;
}
