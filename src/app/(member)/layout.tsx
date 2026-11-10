import { requireMemberPage } from "@/lib/auth-guard";
import { WorkspaceShell } from "@/components/layout/workspace-shell";

export default async function MemberLayout({ children }: LayoutProps<"/">) {
  const user = await requireMemberPage();
  return <WorkspaceShell user={user}>{children}</WorkspaceShell>;
}
