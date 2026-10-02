import { FileSpreadsheet, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";

export function ExportButtons({ report, scope }: { report: string; scope: string }) {
  const href = (format: "csv" | "xlsx") => `/api/export?report=${report}&format=${format}&month=${scope}`;
  return (
    <div className="flex items-center gap-2">
      <Button variant="outline" size="sm" nativeButton={false} render={<a href={href("csv")} download />}>
        <FileText /> CSV
      </Button>
      <Button variant="outline" size="sm" nativeButton={false} render={<a href={href("xlsx")} download />}>
        <FileSpreadsheet /> Excel
      </Button>
    </div>
  );
}
