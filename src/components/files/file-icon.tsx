import { FileArchive, FileIcon, FileSpreadsheet, FileText, ImageIcon, type LucideIcon } from "lucide-react";

type FileKind = "image" | "document" | "sheet" | "archive" | "other";

const ICONS: Record<FileKind, LucideIcon> = {
  image: ImageIcon,
  document: FileText,
  sheet: FileSpreadsheet,
  archive: FileArchive,
  other: FileIcon,
};

/** Classifies a file from its MIME type and name. */
export function fileKindFor(mimeType: string, fileName: string): FileKind {
  if (mimeType.startsWith("image/")) return "image";
  if (mimeType === "application/pdf" || /\.(docx?|txt|md)$/i.test(fileName)) return "document";
  if (/spreadsheet|excel|csv/.test(mimeType) || /\.(xlsx?|csv)$/i.test(fileName)) return "sheet";
  if (/zip|compressed|tar/.test(mimeType) || /\.(zip|rar|7z|gz)$/i.test(fileName)) return "archive";
  return "other";
}

export function FileTypeIcon({ mimeType, fileName, className }: { mimeType: string; fileName: string; className?: string }) {
  const Icon = ICONS[fileKindFor(mimeType, fileName)];
  return <Icon className={className} />;
}
