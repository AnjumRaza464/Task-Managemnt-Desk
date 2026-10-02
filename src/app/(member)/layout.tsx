import Link from "next/link";
import { CalendarCheck2 } from "lucide-react";
import { requireMemberPage } from "@/lib/auth-guard";
import { APP_NAME } from "@/lib/constants";
import { MemberHeaderActions } from "@/components/layout/member-header-actions";

export default async function MemberLayout({ children }: LayoutProps<"/">) {
  const user = await requireMemberPage();

  return (
    <div className="flex min-h-svh flex-col">
      <header className="sticky top-0 z-30 border-b bg-background/80 backdrop-blur supports-backdrop-filter:bg-background/60">
        <div className="mx-auto flex h-14 w-full max-w-6xl items-center gap-3 px-4">
          <Link href="/my-tasks" className="flex items-center gap-2 font-semibold">
            <span className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <CalendarCheck2 className="size-4" />
            </span>
            {APP_NAME}
          </Link>
          <span className="hidden text-sm text-muted-foreground sm:inline">· My tasks</span>
          <div className="ml-auto">
            <MemberHeaderActions user={user} />
          </div>
        </div>
      </header>
      <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 p-4 md:p-6">{children}</main>
    </div>
  );
}
