import { useMemo, useState } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { formatPercent } from "@/lib/format";
import { cn } from "@/lib/utils";
import { DEPARTMENTS } from "@/features/workers/api";
import { useAttendanceReport, type AttendanceReport, type AttendanceRow } from "../api";
import type { ReportRange } from "../range";
import { ReportShell } from "./ReportShell";
import { ReportTable, tableToCsv, type RCol } from "./ReportTable";

const pctCell = (v: number) => (
  <span className="inline-flex items-center justify-end gap-2">
    <span className="h-1.5 w-14 overflow-hidden rounded-full bg-muted print:hidden">
      <span className={cn("block h-full rounded-full", v >= 90 ? "bg-success" : v >= 75 ? "bg-warning" : "bg-danger")} style={{ width: `${Math.min(v, 100)}%` }} />
    </span>
    <span className="w-11">{formatPercent(v, 0)}</span>
  </span>
);

export function AttendanceReportView({ range }: { range: ReportRange }) {
  const { data, isLoading, error, refetch } = useAttendanceReport(range);
  const [dept, setDept] = useState("all");
  const rows = useMemo(() => (data?.workers ?? []).filter((w) => dept === "all" || w.department === dept).sort((a, b) => a.pct - b.pct), [data, dept]);

  const sum = (k: keyof AttendanceRow) => rows.reduce((s, r) => s + (r[k] as number), 0);
  const expected = sum("expected");
  const paid = sum("present") + sum("halfDay") * 0.5;
  const avg = expected ? (paid / expected) * 100 : 0;

  const wCols: RCol<AttendanceRow>[] = [
    { header: "Worker", cell: (r) => <span><span className="font-medium">{r.name}</span> <span className="text-xs text-muted-foreground">{r.code}</span>{!r.active && <Badge tone="neutral" className="ml-1.5">Left</Badge>}</span>, csv: (r) => `${r.name} (${r.code})` },
    { header: "Department", cell: (r) => r.department },
    { header: "Working days", align: "right", cell: (r) => r.expected, total: expected },
    { header: "Present", align: "right", cell: (r) => r.present, total: sum("present") },
    { header: "Half", align: "right", cell: (r) => r.halfDay, total: sum("halfDay") },
    { header: "Absent", align: "right", cell: (r) => <span className={cn(r.absent > 3 && "font-medium text-danger-foreground")}>{r.absent}</span>, csv: (r) => r.absent, total: sum("absent") },
    { header: "Leave", align: "right", cell: (r) => r.leave, total: sum("leave") },
    { header: "Unmarked", align: "right", cell: (r) => <span className={cn(r.unmarked > 0 && "font-medium text-warning-foreground")}>{r.unmarked}</span>, csv: (r) => r.unmarked, total: sum("unmarked") },
    { header: "OT hrs", align: "right", cell: (r) => r.overtimeHours, total: sum("overtimeHours") },
    { header: "Attendance", align: "right", cell: (r) => pctCell(r.pct), csv: (r) => r.pct.toFixed(1), total: formatPercent(avg) },
  ];
  type Dep = AttendanceReport["departments"][number];
  const dCols: RCol<Dep>[] = [
    { header: "Department", cell: (d) => <span className="font-medium">{d.department}</span>, csv: (d) => d.department },
    { header: "Workers", align: "right", cell: (d) => d.workers },
    { header: "Absent days", align: "right", cell: (d) => d.absent },
    { header: "OT hrs", align: "right", cell: (d) => d.overtimeHours },
    { header: "Attendance", align: "right", cell: (d) => pctCell(d.pct), csv: (d) => d.pct.toFixed(1) },
  ];
  const deps = (data?.departments ?? []).slice().sort((a, b) => DEPARTMENTS.indexOf(a.department) - DEPARTMENTS.indexOf(b.department));

  return (
    <div className="flex flex-col gap-3">
      <div className="flex justify-end">
        <Select value={dept} onValueChange={setDept}>
          <SelectTrigger className="w-[190px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All departments</SelectItem>
            {DEPARTMENTS.map((d) => <SelectItem key={d} value={d}>{d}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      <ReportShell
        id="attendance"
        title={dept === "all" ? "Attendance Summary" : `Attendance Summary · ${dept}`}
        range={range}
        isLoading={isLoading}
        error={error}
        onRetry={() => refetch()}
        kpis={[
          { label: "Average attendance", value: formatPercent(avg), tone: avg >= 90 ? "good" : avg < 80 ? "bad" : undefined, sub: "Half day counts as 0.5" },
          { label: "Paid man-days", value: paid.toLocaleString("en-IN"), sub: `of ${expected.toLocaleString("en-IN")} working days` },
          { label: "Absent days", value: String(sum("absent")), sub: `${sum("leave")} leave days` },
          { label: "Overtime", value: `${sum("overtimeHours")} h`, sub: `${sum("unmarked")} unmarked days`, tone: sum("unmarked") > 0 ? "bad" : undefined },
        ]}
        sections={[
          ...(dept === "all" ? [{ title: "By department", table: <ReportTable columns={dCols} rows={deps} rowKey={(d: Dep) => d.department} />, csv: tableToCsv(dCols, deps) }] : []),
          { title: "By worker", description: "Lowest attendance first", table: <ReportTable dense columns={wCols} rows={rows} rowKey={(r) => r.workerId} />, csv: tableToCsv(wCols, rows) },
        ]}
      />
    </div>
  );
}
