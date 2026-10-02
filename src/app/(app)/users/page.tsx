import type { Metadata } from "next";
import { requireManagerPage } from "@/lib/auth-guard";
import { getUsers } from "@/lib/queries/users";
import { PageHeader } from "@/components/shared/page-header";
import { UserFilters } from "@/components/users/user-filters";
import { UsersTable } from "@/components/users/users-table";
import type { Role } from "@/generated/prisma/enums";

export const metadata: Metadata = { title: "Users" };

export default async function UsersPage({ searchParams }: PageProps<"/users">) {
  const manager = await requireManagerPage();
  const params = await searchParams;
  const q = typeof params.q === "string" ? params.q : "";
  const role = typeof params.role === "string" ? (params.role as Role | "ALL") : "ALL";
  const status = typeof params.status === "string" ? (params.status as "active" | "inactive" | "all") : "all";

  const users = await getUsers({ q, role, status });

  return (
    <>
      <PageHeader
        title="Users"
        description={`${users.length} user${users.length === 1 ? "" : "s"} · manage team members and manager accounts`}
      />
      <div className="flex flex-col gap-4">
        <UserFilters />
        <UsersTable users={users} currentUserId={manager.id} />
      </div>
    </>
  );
}
