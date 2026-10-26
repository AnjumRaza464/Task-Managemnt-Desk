import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth-guard";
import { prisma } from "@/lib/prisma";

const INLINE_TYPES = /^(image\/|application\/pdf$|text\/plain$)/;

/**
 * Serves a shared file. Add `?download=1` to force a download; images, PDFs
 * and plain text otherwise open in the browser. Opening a file records
 * `viewedAt` for the user so managers can see who has seen it.
 */
export async function GET(req: Request, { params }: RouteContext<"/api/files/[id]">) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const file = await prisma.sharedFile.findUnique({
    where: { id },
    select: {
      fileName: true,
      mimeType: true,
      size: true,
      data: true,
      isPublic: true,
      sharedById: true,
      recipients: { where: { userId: user.id }, select: { viewedAt: true } },
    },
  });
  if (!file) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const isRecipient = file.recipients.length > 0;
  const isManager = user.role !== "MEMBER";
  if (!file.isPublic && !isRecipient && !isManager) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Record the first open for recipients, and for anyone opening a public file.
  if (file.sharedById !== user.id && (isRecipient || file.isPublic) && !file.recipients[0]?.viewedAt) {
    await prisma.sharedFileRecipient.upsert({
      where: { fileId_userId: { fileId: id, userId: user.id } },
      create: { fileId: id, userId: user.id, viewedAt: new Date() },
      update: { viewedAt: new Date() },
    });
  }

  const forceDownload = new URL(req.url).searchParams.get("download") === "1";
  const disposition = !forceDownload && INLINE_TYPES.test(file.mimeType) ? "inline" : "attachment";
  const safeName = encodeURIComponent(file.fileName).replace(/['()]/g, escape);
  return new NextResponse(new Uint8Array(file.data), {
    headers: {
      "Content-Type": file.mimeType,
      "Content-Length": String(file.size),
      "Content-Disposition": `${disposition}; filename*=UTF-8''${safeName}`,
      "Cache-Control": "private, no-store",
    },
  });
}
