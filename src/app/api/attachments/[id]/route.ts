import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth-guard";
import { prisma } from "@/lib/prisma";

export async function GET(_req: Request, { params }: RouteContext<"/api/attachments/[id]">) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const attachment = await prisma.attachment.findUnique({
    where: { id },
    select: { fileName: true, mimeType: true, size: true, data: true, task: { select: { assigneeId: true } } },
  });
  if (!attachment) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Members may only download attachments from their own tasks.
  if (user.role === "MEMBER" && attachment.task.assigneeId !== user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

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
