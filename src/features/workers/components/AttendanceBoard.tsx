import { useEffect, useMemo, useRef, useState } from "react";
import { addDays, format, isSunday, parseISO, subDays } from "date-fns";
import { toast } from "sonner";
import { CalendarDays, CheckCheck, ChevronLeft, ChevronRight, Save, Search, Undo2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Kbd } from "@/components/ui/kbd";
import { Hint } from "@/components/ui/tooltip";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { EmptyState, ErrorState, RowsSkeleton } from "@/components/shared/states";
import { modKeyLabel, useHotkeys } from "@/hooks/use-hotkeys";
import { formatDayLong, formatINR } from "@/lib/format";
import { cn, initials } from "@/lib/utils";
import type { AttendanceStatus, Worker } from "@/types/domain";
import { DEPARTMENTS, monthRange, useAttendanceDay, useSaveAttendance, useWorkerRoster, workingDays, type AttendanceMark } from "../api";

type Draft = Record<string, AttendanceMark | undefined>;

const STATUS: { value: AttendanceStatus; short: string; label: string; key: string; on: string }[] = [
  { value: "present", short: "P", label: "Present", key: "p", on: "bg-success text-white border-success" },
  { value: "half_day", short: "H", label: "Half day", key: "h", on: "bg-warning text-white border-warning" },
  { value: "absent", short: "A", label: "Absent", key: "a", on: "bg-danger text-white border-danger" },
  { value: "leave", short: "L", label: "Leave", key: "l", on: "bg-violet text-white border-violet" },
];

/** Estimated earning for one day; final numbers come from payroll. */
function dayWage(w: Worker, m: AttendanceMark | undefined, date: string) {
  if (!m) return 0;
  const factor = m.status === "present" ? 1 : m.status === "half_day" ? 0.5 : 0;
  const ot = w.overtimeRatePerHour * m.overtimeHours;
  if (w.wageType === "piece_rate") return w.wageRate * (m.pieces ?? 0) + ot;
  if (w.wageType === "daily") return w.wageRate * factor + ot;
  const { from, to } = monthRange(date.slice(0, 7));
  return Math.round((w.wageRate / Math.max(workingDays(from, to), 1)) * factor) + ot;
}

const same = (a?: AttendanceMark, b?: AttendanceMark) =>
  a?.status === b?.status && (a?.overtimeHours ?? 0) === (b?.overtimeHours ?? 0) && (a?.pieces ?? 0) === (b?.pieces ?? 0);

export function AttendanceBoard() {
  const today = format(new Date(), "yyyy-MM-dd");
  const [date, setDate] = useState(today);
  const [pendingDate, setPendingDate] = useState<string | null>(null);
  const [dept, setDept] = useState<string>("all");
  const [search, setSearch] = useState("");

  const roster = useWorkerRoster();
  const day = useAttendanceDay(date);
  const save = useSaveAttendance();

  const activeWorkers = useMemo(
    () => (roster.data ?? []).filter((w) => w.active && w.joinedOn <= date).sort((a, b) => a.department.localeCompare(b.department) || a.name.localeCompare(b.name)),
    [roster.data, date],
  );

  const saved = useMemo<Draft>(() => {
    const out: Draft = {};
    for (const r of day.data ?? []) out[r.workerId] = { workerId: r.workerId, status: r.status, overtimeHours: r.overtimeHours, pieces: r.pieces };
    return out;
  }, [day.data]);

  const [draft, setDraft] = useState<Draft>({});
  useEffect(() => setDraft(saved), [saved]);

  const dirtyIds = activeWorkers.filter((w) => !same(draft[w.id], saved[w.id])).map((w) => w.id);
  const dirty = dirtyIds.length > 0;

  const visible = activeWorkers.filter(
    (w) => (dept === "all" || w.department === dept) && (!search || `${w.name} ${w.code}`.toLowerCase().includes(search.toLowerCase())),
  );

  const counts = useMemo(() => {
    const c = { present: 0, half_day: 0, absent: 0, leave: 0, unmarked: 0, ot: 0, manDays: 0 };
    for (const w of activeWorkers) {
      const m = draft[w.id];
      if (!m) c.unmarked++;
      else {
        c[m.status]++;
        c.ot += m.overtimeHours;
        c.manDays += m.status === "present" ? 1 : m.status === "half_day" ? 0.5 : 0;
      }
    }
    return c;
  }, [draft, activeWorkers]);

  const wagesToday = activeWorkers.reduce((s, w) => s + dayWage(w, draft[w.id], date), 0);

  const setMark = (w: Worker, patch: Partial<AttendanceMark>) =>
    setDraft((d) => {
      const cur = d[w.id] ?? { workerId: w.id, status: "present" as AttendanceStatus, overtimeHours: 0 };
      const next = { ...cur, ...patch };
      if (next.status === "absent" || next.status === "leave") {
        next.overtimeHours = 0;
        next.pieces = undefined;
      }
      return { ...d, [w.id]: next };
    });

  const markAllPresent = () =>
    setDraft((d) => {
      const next = { ...d };
      for (const w of visible) if (!next[w.id]) next[w.id] = { workerId: w.id, status: "present", overtimeHours: 0 };
      return next;
    });

  const goTo = (d: string) => {
    if (d > today) return;
    if (dirty) setPendingDate(d);
    else setDate(d);
  };

  const onSave = async () => {
    const marks = dirtyIds.map((id) => draft[id]).filter((m): m is AttendanceMark => !!m);
    if (!marks.length) return;
    try {
      await save.mutateAsync({ date, marks });
      toast.success(`Attendance saved for ${formatDayLong(date)}`, { description: `${marks.length} worker${marks.length > 1 ? "s" : ""} updated` });
    } catch (e) {
      toast.error("Couldn't save attendance", { description: e instanceof Error ? e.message : undefined });
    }
  };

  useHotkeys({ "mod+s": () => void onSave(), "alt+arrowleft": () => goTo(format(subDays(parseISO(date), 1), "yyyy-MM-dd")), "alt+arrowright": () => goTo(format(addDays(parseISO(date), 1), "yyyy-MM-dd")) });

  /* keyboard entry: focus a row, press P/H/A/L, focus moves down */
  const rowRefs = useRef<Record<string, HTMLTableRowElement | null>>({});
  const onRowKey = (e: React.KeyboardEvent, w: Worker, i: number) => {
    if ((e.target as HTMLElement).tagName === "INPUT") return;
    const s = STATUS.find((x) => x.key === e.key.toLowerCase());
    const focus = (j: number) => visible[j] && rowRefs.current[visible[j]!.id]?.focus();
    if (s && !e.metaKey && !e.ctrlKey) {
      e.preventDefault();
      setMark(w, { status: s.value });
      focus(i + 1);
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      focus(i + 1);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      focus(i - 1);
    }
  };

  const loading = roster.isLoading || day.isLoading;
  const error = roster.error ?? day.error;
  const sunday = isSunday(parseISO(date));

  return (
    <div className="rounded-xl border border-border bg-card shadow-card">
      {/* Date bar */}
      <div className="flex flex-wrap items-center gap-3 rounded-t-xl border-b border-border px-4 py-3">
        <div className="flex items-center gap-1">
          <Hint label="Previous day  Alt ←">
            <Button variant="outline" size="icon-sm" onClick={() => goTo(format(subDays(parseISO(date), 1), "yyyy-MM-dd"))} aria-label="Previous day"><ChevronLeft /></Button>
          </Hint>
          <div className="relative">
            <CalendarDays className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input type="date" value={date} max={today} onChange={(e) => e.target.value && goTo(e.target.value)} className="w-[160px] pl-9" aria-label="Attendance date" />
          </div>
          <Hint label="Next day  Alt →">
            <Button variant="outline" size="icon-sm" disabled={date >= today} onClick={() => goTo(format(addDays(parseISO(date), 1), "yyyy-MM-dd"))} aria-label="Next day"><ChevronRight /></Button>
          </Hint>
          {date !== today && <Button variant="ghost" size="sm" onClick={() => goTo(today)}>Today</Button>}
        </div>
        <div className="text-[15px] font-semibold">{formatDayLong(date)}</div>
        <div className="ml-auto flex items-center gap-2">
          <div className="relative w-52">
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Find worker…" className="pl-9" />
          </div>
          <Select value={dept} onValueChange={setDept}>
            <SelectTrigger className="w-[160px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All departments</SelectItem>
              {DEPARTMENTS.map((d) => <SelectItem key={d} value={d}>{d}</SelectItem>)}
            </SelectContent>
          </Select>
          <Button variant="outline" onClick={markAllPresent} disabled={loading || !visible.some((w) => !draft[w.id])}>
            <CheckCheck /> Mark rest present
          </Button>
        </div>
      </div>

      {/* Summary */}
      <div className="flex flex-wrap items-center gap-x-6 gap-y-2 border-b border-border bg-subtle px-5 py-2.5 text-[13px] tabular">
        <Chip color="bg-success" label="Present" value={counts.present} />
        <Chip color="bg-warning" label="Half day" value={counts.half_day} />
        <Chip color="bg-danger" label="Absent" value={counts.absent} />
        <Chip color="bg-violet" label="Leave" value={counts.leave} />
        <Chip color="bg-[#d0d5dd]" label="Not marked" value={counts.unmarked} strong={counts.unmarked > 0} />
        <span className="text-muted-foreground">Man-days <b className="text-foreground">{counts.manDays}</b></span>
        <span className="text-muted-foreground">Overtime <b className="text-foreground">{counts.ot} h</b></span>
        <span className="ml-auto text-muted-foreground">Est. wages for the day <b className="text-foreground">{formatINR(wagesToday)}</b></span>
      </div>

      {sunday && (
        <div className="border-b border-border bg-info-soft px-5 py-2 text-[13px] text-info-foreground">
          Sunday is the weekly off. Mark only the workers who came in.
        </div>
      )}

      {/* Rows */}
      {error ? (
        <ErrorState error={error} onRetry={() => { roster.refetch(); day.refetch(); }} />
      ) : loading ? (
        <RowsSkeleton rows={8} className="p-5" />
      ) : visible.length === 0 ? (
        <EmptyState compact title="No workers match" description="Change the department filter or search." />
      ) : (
        <div className="max-h-[calc(100vh-430px)] min-h-72 overflow-y-auto">
          <table className="w-full text-sm tabular">
            <thead className="sticky top-0 z-10 bg-card shadow-[0_1px_0_var(--border)]">
              <tr className="text-left text-[13px] text-[#475467]">
                <th className="h-10 pr-4 pl-5 font-medium">Worker</th>
                <th className="px-4 font-medium">Department</th>
                <th className="px-4 font-medium">Status</th>
                <th className="px-4 font-medium">OT hrs</th>
                <th className="px-4 font-medium">Pieces</th>
                <th className="pr-5 pl-4 text-right font-medium">Day wage (est.)</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((w, i) => {
                const m = draft[w.id];
                const changed = dirtyIds.includes(w.id);
                const off = m?.status === "absent" || m?.status === "leave";
                return (
                  <tr
                    key={w.id}
                    ref={(el) => { rowRefs.current[w.id] = el; }}
                    tabIndex={0}
                    onKeyDown={(e) => onRowKey(e, w, i)}
                    className={cn(
                      "border-b border-border/70 outline-none focus-visible:bg-brand-50/70 focus-visible:shadow-[inset_3px_0_0_var(--brand-500)]",
                      !m && "bg-[#fffbeb]/60",
                      changed && "shadow-[inset_3px_0_0_var(--brand-300)]",
                    )}
                  >
                    <td className="py-2 pr-4 pl-5">
                      <div className="flex items-center gap-3">
                        <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold text-[#475467]">{initials(w.name)}</span>
                        <div className="min-w-0">
                          <div className="truncate font-medium">{w.name}</div>
                          <div className="text-xs text-muted-foreground">{w.code} · {w.designation}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 text-[#475467]">{w.department}</td>
                    <td className="px-4">
                      <div className="flex gap-1" role="radiogroup" aria-label={`Status for ${w.name}`}>
                        {STATUS.map((s) => (
                          <Hint key={s.value} label={`${s.label} (${s.short})`}>
                            <button
                              type="button"
                              role="radio"
                              aria-checked={m?.status === s.value}
                              tabIndex={-1}
                              onClick={() => setMark(w, { status: s.value })}
                              className={cn(
                                "size-8 rounded-lg border text-[13px] font-semibold transition-colors",
                                m?.status === s.value ? s.on : "border-border bg-card text-muted-foreground hover:bg-muted",
                              )}
                            >
                              {s.short}
                            </button>
                          </Hint>
                        ))}
                      </div>
                    </td>
                    <td className="px-4">
                      <Input
                        type="number" min={0} max={12} step={0.5} disabled={!m || off} aria-label={`Overtime hours for ${w.name}`}
                        value={m && m.overtimeHours ? m.overtimeHours : ""} placeholder="0" className="h-8 w-20"
                        onChange={(e) => setMark(w, { overtimeHours: Math.max(0, Math.min(12, Number(e.target.value) || 0)) })}
                      />
                    </td>
                    <td className="px-4">
                      {w.wageType === "piece_rate" ? (
                        <Input
                          type="number" min={0} disabled={!m || off} aria-label={`Pieces for ${w.name}`}
                          value={m?.pieces ?? ""} placeholder="0" className="h-8 w-24"
                          onChange={(e) => setMark(w, { pieces: e.target.value === "" ? undefined : Math.max(0, Math.floor(Number(e.target.value))) })}
                        />
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="pr-5 pl-4 text-right font-medium">{m ? formatINR(dayWage(w, m, date)) : <span className="text-muted-foreground">—</span>}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Footer */}
      <div className="sticky bottom-0 z-20 flex items-center gap-3 rounded-b-xl border-t border-border bg-card px-4 py-3 shadow-[0_-4px_12px_-6px_rgb(16_24_40/0.12)]">
        <p className="text-xs text-muted-foreground">
          Click a row, then press <Kbd>P</Kbd> <Kbd>H</Kbd> <Kbd>A</Kbd> <Kbd>L</Kbd>. Focus moves to the next worker. <Kbd>↑</Kbd><Kbd>↓</Kbd> to move.
        </p>
        <div className="ml-auto flex items-center gap-2">
          {dirty && <span className="text-[13px] font-medium text-brand-700">{dirtyIds.length} unsaved change{dirtyIds.length > 1 ? "s" : ""}</span>}
          <Button variant="outline" disabled={!dirty} onClick={() => setDraft(saved)}><Undo2 /> Discard</Button>
          <Hint label={`${modKeyLabel} S`}>
            <Button disabled={!dirty} loading={save.isPending} onClick={onSave}><Save /> Save attendance</Button>
          </Hint>
        </div>
      </div>

      <ConfirmDialog
        open={!!pendingDate}
        onOpenChange={(v) => !v && setPendingDate(null)}
        title="Discard unsaved attendance?"
        description={`You have ${dirtyIds.length} unsaved change${dirtyIds.length > 1 ? "s" : ""} for ${formatDayLong(date)}. Switching dates will discard them.`}
        confirmLabel="Discard changes"
        onConfirm={() => { if (pendingDate) setDate(pendingDate); setPendingDate(null); }}
      />
    </div>
  );
}

function Chip({ color, label, value, strong }: { color: string; label: string; value: number; strong?: boolean }) {
  return (
    <span className={cn("flex items-center gap-1.5", strong ? "font-medium text-warning-foreground" : "text-[#475467]")}>
      <span className={cn("size-2 rounded-full", color)} /> {label} <b className="text-foreground">{value}</b>
    </span>
  );
}
