import Link from "next/link";
import { requireMemberPage } from "@/lib/auth-guard";
import { APP_NAME } from "@/lib/constants";
import { BrandLogo } from "@/components/shared/brand-logo";
import { GlobalSearch } from "@/components/layout/global-search";
import { MemberHeaderActions } from "@/components/layout/member-header-actions";
import { MemberNav } from "@/components/layout/member-nav";
import { getUnseenFileCount } from "@/lib/queries/files";
import { getUnreadNotificationCount } from "@/lib/queries/notifications";
import { ChatWidget } from "@/components/chat/chat-widget";

export default async function MemberLayout({ children }: LayoutProps<"/">) {
  const user = await requireMemberPage();
  const [unseenFiles, unreadNotifications] = await Promise.all([getUnseenFileCount(user.id), getUnreadNotificationCount(user.id)]);

  return (
    <div className="flex min-h-svh flex-col">
      <header className="sticky top-0 z-30 border-b bg-background/80 backdrop-blur supports-backdrop-filter:bg-background/60">
        <div className="mx-auto flex h-14 w-full max-w-6xl items-center gap-3 px-4">
          <Link href="/my-tasks" className="flex items-center gap-2 font-semibold">
            <BrandLogo className="h-9" />
            <span className="sr-only">{APP_NAME}</span>
          </Link>
          <MemberNav unseenFiles={unseenFiles} unreadNotifications={unreadNotifications} />
          <div className="ml-auto flex items-center gap-1">
            <GlobalSearch scope="member" />
            <MemberHeaderActions user={user} />
          </div>
        </div>
      </header>
      <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 p-4 md:p-6">{children}</main>
      <ChatWidget currentUser={user} />
    </div>
  );
}
