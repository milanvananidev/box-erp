import { eachDayOfInterval, endOfMonth, format, getISODay, isSunday, parseISO, startOfMonth } from "date-fns";
import { Hint } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import type { AttendanceRecord } from "@/types/domain";

const CELL: Record<AttendanceRecord["status"], { cls: string; label: string }> = {
  present: { cls: "bg-success text-white", label: "Present" },
  half_day: { cls: "bg-warning text-white", label: "Half day" },
  absent: { cls: "bg-danger text-white", label: "Absent" },
  leave: { cls: "bg-violet text-white", label: "Leave" },
};

/** Month grid (Mon–Sun) coloured by attendance status. */
export function MonthCalendar({ month, records, joinedOn, leftOn }: { month: string; records: AttendanceRecord[]; joinedOn: string; leftOn?: string }) {
  const first = parseISO(`${month}-01`);
  const days = eachDayOfInterval({ start: startOfMonth(first), end: endOfMonth(first) });
  const byDate = new Map(records.map((r) => [r.date, r]));
  const today = format(new Date(), "yyyy-MM-dd");
  const lead = getISODay(days[0]!) - 1;

  return (
    <div>
      <div className="mb-1.5 grid grid-cols-7 gap-1.5 text-center text-[11px] font-medium text-muted-foreground">
        {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => <div key={d}>{d}</div>)}
      </div>
      <div className="grid grid-cols-7 gap-1.5">
        {Array.from({ length: lead }).map((_, i) => <div key={`l${i}`} />)}
        {days.map((d) => {
          const iso = format(d, "yyyy-MM-dd");
          const r = byDate.get(iso);
          const outside = iso > today || iso < joinedOn || (leftOn && iso > leftOn);
          const sun = isSunday(d);
          const tip = r
            ? [CELL[r.status].label, r.overtimeHours ? `${r.overtimeHours}h OT` : "", r.pieces ? `${r.pieces} pcs` : ""].filter(Boolean).join(" · ")
            : outside ? "—" : sun ? "Weekly off" : "Not marked";
          return (
            <Hint key={iso} label={`${format(d, "EEE d MMM")}: ${tip}`}>
              <div
                className={cn(
                  "relative flex h-9 items-center justify-center rounded-md text-xs font-medium tabular",
                  r ? CELL[r.status].cls : outside ? "text-[#d0d5dd]" : sun ? "bg-muted text-muted-foreground" : "border border-dashed border-warning text-warning-foreground",
                  iso === today && "ring-2 ring-brand-400 ring-offset-1",
                )}
              >
                {d.getDate()}
                {r && r.overtimeHours > 0 && <span className="absolute top-0.5 right-1 size-1.5 rounded-full bg-white/90" />}
              </div>
            </Hint>
          );
        })}
      </div>
      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-muted-foreground">
        {Object.values(CELL).map((c) => (
          <span key={c.label} className="flex items-center gap-1.5"><span className={cn("size-2.5 rounded-sm", c.cls)} />{c.label}</span>
        ))}
        <span className="flex items-center gap-1.5"><span className="size-2.5 rounded-sm border border-dashed border-warning" />Not marked</span>
        <span className="flex items-center gap-1.5"><span className="size-1.5 rounded-full bg-success ring-2 ring-success/30" />Dot = overtime</span>
      </div>
    </div>
  );
}
