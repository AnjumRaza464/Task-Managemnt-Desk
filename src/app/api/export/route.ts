import { NextResponse } from "next/server";
import { getCurrentManager } from "@/lib/auth-guard";
import { buildReportSheets, REPORT_KINDS, sheetsToXlsx, sheetToCsv, type ReportKind } from "@/lib/export";
import { parseMonthKey } from "@/lib/utils";
import type { ReportScope } from "@/lib/queries/reports";

/**
 * GET /api/export?report=monthly|users|status|priority&format=csv|xlsx&month=yyyy-MM|all
 */
export async function GET(request: Request) {
  const manager = await getCurrentManager();
  if (!manager) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const url = new URL(request.url);
  const report = url.searchParams.get("report") ?? "monthly";
  const format = url.searchParams.get("format") === "xlsx" ? "xlsx" : "csv";
  const month = url.searchParams.get("month") ?? "";

  if (!REPORT_KINDS.includes(report as ReportKind)) {
    return NextResponse.json({ error: "Unknown report" }, { status: 400 });
  }

  const scope: ReportScope = month === "all" ? { year: 0, month: 0, all: true } : parseMonthKey(month);
  const scopeLabel = scope.all ? "all-time" : `${scope.year}-${String(scope.month).padStart(2, "0")}`;
  const sheets = await buildReportSheets(report as ReportKind, scope);
  const fileName = `${report}-report-${scopeLabel}.${format}`;

  if (format === "xlsx") {
    const buffer = await sheetsToXlsx(sheets);
    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${fileName}"`,
        "Cache-Control": "private, no-store",
      },
    });
  }

  return new NextResponse(sheetToCsv(sheets[0]), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${fileName}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
