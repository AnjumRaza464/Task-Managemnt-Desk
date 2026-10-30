"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  BarChart3,
  Bell,
  CalendarDays,
  CalendarRange,
  FolderKanban,
  FolderOpen,
  KanbanSquare,
  LayoutDashboard,
  ListTodo,
  Search,
  Settings,
  Timer,
  Users,
  type LucideIcon,
} from "lucide-react";
import { globalSearch, type SearchHit, type SearchResults } from "@/actions/search";
import { Button } from "@/components/ui/button";
import { Command, CommandDialog, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";

type Page = { label: string; href: string; icon: LucideIcon };

const MANAGER_PAGES: Page[] = [
  { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { label: "Users", href: "/users", icon: Users },
  { label: "Projects", href: "/workspaces", icon: FolderKanban },
  { label: "Monthly plans", href: "/monthly-plans", icon: CalendarRange },
  { label: "All tasks", href: "/tasks", icon: ListTodo },
  { label: "Kanban", href: "/tasks/kanban", icon: KanbanSquare },
  { label: "Calendar", href: "/calendar", icon: CalendarDays },
  { label: "Files", href: "/files", icon: FolderOpen },
  { label: "Reports", href: "/reports", icon: BarChart3 },
  { label: "Attendance", href: "/attendance", icon: Timer },
  { label: "Notifications", href: "/notifications", icon: Bell },
  { label: "Settings", href: "/settings", icon: Settings },
];

const MEMBER_PAGES: Page[] = [
  { label: "My tasks", href: "/my-tasks", icon: ListTodo },
  { label: "My projects", href: "/my-projects", icon: FolderKanban },
  { label: "Files", href: "/my-files", icon: FolderOpen },
  { label: "Notifications", href: "/my-notifications", icon: Bell },
];

const MIN_QUERY = 2;

/**
 * Header search box (Ctrl/Cmd+K) that looks across tasks, users, plans and
 * files on the server, plus quick links to pages. Results open with
 * client-side navigation.
 */
export function GlobalSearch({ scope }: { scope: "manager" | "member" }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResults | null>(null);
  const [, startTransition] = useTransition();
  const latest = useRef("");

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setOpen((o) => !o);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const q = query.trim();
  useEffect(() => {
    latest.current = q;
    if (q.length < MIN_QUERY) return;
    const timer = setTimeout(() => {
      startTransition(async () => {
        const r = await globalSearch(q);
        // Ignore answers to a query the user has already moved past.
        if (latest.current === r.q) setResults(r);
      });
    }, 250);
    return () => clearTimeout(timer);
  }, [q]);

  const fresh = results && results.q === q ? results : null;
  const searching = q.length >= MIN_QUERY && !fresh;
  const pages = (scope === "manager" ? MANAGER_PAGES : MEMBER_PAGES).filter(
    (p) => q.length === 0 || p.label.toLowerCase().includes(q.toLowerCase()),
  );
  const hitCount = fresh ? fresh.tasks.length + fresh.users.length + fresh.projects.length + fresh.plans.length + fresh.files.length : 0;
  const nothing = !searching && q.length >= MIN_QUERY && hitCount === 0 && pages.length === 0;

  function go(href: string) {
    setOpen(false);
    setQuery("");
    router.push(href);
  }

  function hits(heading: string, items: SearchHit[], Icon: LucideIcon) {
    if (items.length === 0) return null;
    return (
      <CommandGroup heading={heading}>
        {items.map((item) => (
          <CommandItem key={`${heading}:${item.id}`} value={`${heading}:${item.id}`} onSelect={() => go(item.href)}>
            <Icon className="text-muted-foreground" />
            <span className="min-w-0 flex-1">
              <span className="block truncate">{item.label}</span>
              {item.detail && <span className="block truncate text-xs text-muted-foreground">{item.detail}</span>}
            </span>
          </CommandItem>
        ))}
      </CommandGroup>
    );
  }

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        className="hidden h-8 w-60 justify-start gap-2 font-normal text-muted-foreground sm:inline-flex"
        onClick={() => setOpen(true)}
      >
        <Search className="size-4" />
        <span className="flex-1 text-left">Search…</span>
        <kbd className="rounded border bg-muted px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">Ctrl K</kbd>
      </Button>
      <Button variant="ghost" size="icon" className="sm:hidden" aria-label="Search" onClick={() => setOpen(true)}>
        <Search className="size-4" />
      </Button>

      <CommandDialog
        open={open}
        onOpenChange={(next) => {
          setOpen(next);
          if (!next) setQuery("");
        }}
        title="Search"
        description="Search tasks, users, plans and files"
        className="sm:max-w-lg"
      >
        <Command shouldFilter={false}>
          <CommandInput
            autoFocus
            placeholder={scope === "manager" ? "Search tasks, users, plans, files…" : "Search your tasks and files…"}
            value={query}
            onValueChange={setQuery}
          />
          <CommandList className="max-h-96">
            {searching && <p className="py-6 text-center text-sm text-muted-foreground">Searching…</p>}
            {nothing && (
              <p className="py-6 text-center text-sm text-muted-foreground">
                No results for &ldquo;{q}&rdquo;.
              </p>
            )}
            {fresh && hits("Tasks", fresh.tasks, ListTodo)}
            {fresh && hits("Users", fresh.users, Users)}
            {fresh && hits("Projects", fresh.projects, FolderKanban)}
            {fresh && hits("Monthly plans", fresh.plans, CalendarRange)}
            {fresh && hits("Files", fresh.files, FolderOpen)}
            {pages.length > 0 && (
              <CommandGroup heading="Pages">
                {pages.map((p) => (
                  <CommandItem key={p.href} value={`page:${p.href}`} onSelect={() => go(p.href)}>
                    <p.icon className="text-muted-foreground" />
                    {p.label}
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
          </CommandList>
        </Command>
      </CommandDialog>
    </>
  );
}
