import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth-guard";
import { isGlobalRole } from "@/lib/constants";
import { getProjectAccess, getTaskAccess } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";

export async function GET(_req: Request, { params }: RouteContext<"/api/attachments/[id]">) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const attachment = await prisma.attachment.findUnique({
    where: { id },
    select: {
      fileName: true,
      mimeType: true,
      size: true,
      data: true,
      projectId: true,
      task: { select: { id: true, projectId: true, createdById: true, assignees: { select: { userId: true } } } },
    },
  });
  if (!attachment) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Members may only open files from tasks they can see (assigned or in their projects)
  // and from project discussions of their projects.
  const canView = attachment.task
    ? (await getTaskAccess(user, attachment.task)).canView
    : attachment.projectId
      ? Boolean((await getProjectAccess(user, attachment.projectId))?.canView)
      : isGlobalRole(user.role);
  if (!canView) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const safeName = encodeURIComponent(attachment.fileName).replace(/['()]/g, escape);
  return new NextResponse(new Uint8Array(attachment.data), {
    headers: {
      "Content-Type": attachment.mimeType,
      "Content-Length": String(attachment.size),
      "Content-Disposition": `attachment; filename*=UTF-8''${safeName}`,
      "Cache-Control": "private, no-store",
    },
  });
}
