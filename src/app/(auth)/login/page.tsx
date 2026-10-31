import type { Metadata } from "next";
import { Flag, FolderKanban, MessagesSquare, Users } from "lucide-react";
import { LoginForm } from "@/components/auth/login-form";
import { LoginSceneLoader } from "@/components/auth/login-scene-loader";
import { APP_NAME } from "@/lib/constants";
import { BrandLogo } from "@/components/shared/brand-logo";

export const metadata: Metadata = {
  title: "Sign in",
};

const FEATURES = [
  { icon: FolderKanban, title: "Workspaces → Projects → Lists", text: "Every task has a home and a stage." },
  { icon: Users, title: "One task, many hands", text: "Assign several people, keep one record." },
  { icon: MessagesSquare, title: "Discussions that stay put", text: "Comments, replies and @mentions on the task." },
  { icon: Flag, title: "Milestones & timeline", text: "See the whole plan, not just today." },
];

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const params = await searchParams;
  const callbackUrl = typeof params.callbackUrl === "string" ? params.callbackUrl : "/dashboard";

  return (
    <div className="dark relative min-h-svh overflow-hidden bg-background text-foreground">
      {/* 3D board behind everything */}
      <div className="absolute inset-0">
        <div className="absolute -top-40 left-1/3 size-[36rem] rounded-full bg-primary/25 blur-3xl" />
        <div className="absolute -bottom-48 -left-32 size-[30rem] rounded-full bg-primary/10 blur-3xl" />
        <LoginSceneLoader />
        {/* vignette so text and the form stay readable */}
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_35%,rgba(8,6,9,0.75)_100%)]" />
        <div className="pointer-events-none absolute inset-y-0 right-0 hidden w-[46%] bg-linear-to-l from-background/70 via-background/25 to-transparent lg:block" />
      </div>

      <div className="pointer-events-none relative z-10 flex min-h-svh flex-col">
        <header className="flex items-center justify-between px-6 py-5 sm:px-10">
          <div className="pointer-events-auto flex items-center gap-3">
            <BrandLogo plain className="h-10" />
            <span className="sr-only">{APP_NAME}</span>
          </div>
          <span className="hidden rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-muted-foreground backdrop-blur sm:inline-flex">
            Project &amp; team management · Black &amp; Brown Bakers
          </span>
        </header>

        <main className="pointer-events-none grid flex-1 items-center gap-10 px-6 pb-10 sm:px-10 lg:grid-cols-[1.1fr_minmax(22rem,26rem)] lg:gap-16 lg:px-16">
          {/* Copy: pointer events pass through so the board underneath stays interactive */}
          <section className="hidden max-w-xl space-y-8 lg:block">
            <div className="space-y-4">
              <span className="inline-flex items-center gap-2 rounded-full border border-primary/40 bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
                <span className="size-1.5 animate-pulse rounded-full bg-primary" />
                Live board · hover a card, click to tick it off
              </span>
              <h1 className="text-5xl font-semibold leading-[1.05] tracking-tight">
                Run every project <span className="text-primary">from one board.</span>
              </h1>
              <p className="max-w-md text-base text-muted-foreground">
                Plan workspaces and projects, assign work to the right people, discuss it where it happens and watch
                milestones land on time.
              </p>
            </div>
            <ul className="grid gap-3 sm:grid-cols-2">
              {FEATURES.map((f) => (
                <li key={f.title} className="flex items-start gap-3 rounded-xl border border-white/10 bg-white/5 p-3 backdrop-blur-sm">
                  <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/15 text-primary">
                    <f.icon className="size-4" />
                  </span>
                  <span>
                    <span className="block text-sm font-medium">{f.title}</span>
                    <span className="block text-xs text-muted-foreground">{f.text}</span>
                  </span>
                </li>
              ))}
            </ul>
          </section>

          {/* Sign-in card */}
          <section className="pointer-events-auto mx-auto w-full max-w-sm lg:mx-0 lg:ml-auto">
            <div className="relative overflow-hidden rounded-3xl border border-white/12 bg-card/70 p-7 shadow-[0_30px_80px_-20px_rgba(240,43,155,0.35)] backdrop-blur-xl sm:p-8">
              <span className="absolute inset-x-0 top-0 h-px bg-linear-to-r from-transparent via-primary to-transparent" />
              <div className="mb-7 space-y-1.5">
                <h2 className="text-2xl font-semibold tracking-tight">Welcome back</h2>
                <p className="text-sm text-muted-foreground">Sign in to your workspace to continue.</p>
              </div>
              <LoginForm callbackUrl={callbackUrl} />
              <p className="mt-6 text-center text-xs text-muted-foreground/80">
                Managers plan and assign work · team members see their own tasks and projects.
              </p>
            </div>
          </section>
        </main>

        <footer className="px-6 pb-5 text-xs text-muted-foreground/60 sm:px-10">
          © {new Date().getFullYear()} UniKyn · where unicorns are born
        </footer>
      </div>
    </div>
  );
}
