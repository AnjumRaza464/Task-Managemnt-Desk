import Link from "next/link";
import { requireMemberPage } from "@/lib/auth-guard";
import { APP_NAME } from "@/lib/constants";
import { BrandMark } from "@/components/shared/brand-logo";
import { MemberHeaderActions } from "@/components/layout/member-header-actions";
import { MemberNav } from "@/components/layout/member-nav";
import { getUnseenFileCount } from "@/lib/queries/files";
import { ChatWidget } from "@/components/chat/chat-widget";

export default async function MemberLayout({ children }: LayoutProps<"/">) {
  const user = await requireMemberPage();
  const unseenFiles = await getUnseenFileCount(user.id);

  return (
    <div className="flex min-h-svh flex-col">
      <header className="sticky top-0 z-30 border-b bg-background/80 backdrop-blur supports-backdrop-filter:bg-background/60">
        <div className="mx-auto flex h-14 w-full max-w-6xl items-center gap-3 px-4">
          <Link href="/my-tasks" className="flex items-center gap-2 font-semibold">
            <BrandMark />
            {APP_NAME}
          </Link>
          <MemberNav unseenFiles={unseenFiles} />
          <div className="ml-auto">
            <MemberHeaderActions user={user} />
          </div>
        </div>
      </header>
      <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 p-4 md:p-6">{children}</main>
      <ChatWidget currentUser={user} />
    </div>
  );
}
