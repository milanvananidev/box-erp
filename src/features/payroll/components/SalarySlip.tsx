import { format, parseISO } from "date-fns";
import { useCompany } from "@/lib/company";
import { formatDate, formatINR } from "@/lib/format";
import { rupeesInWords } from "@/lib/payroll";
import type { PayrollLine, SalaryPayment } from "@/types/domain";
import { WAGE_TYPE_LABEL, WAGE_UNIT } from "@/features/workers/api";

const Row = ({ label, value, strong }: { label: string; value: string; strong?: boolean }) => (
  <tr className={strong ? "font-semibold" : undefined}>
    <td className="py-1 pr-2">{label}</td>
    <td className="py-1 text-right tabular">{value}</td>
  </tr>
);

/** A5-ish salary slip; two fit on an A4 page when printed. Plain black-on-white for laser printers. */
export function SalarySlip({ period, line, workingDays, payment }: { period: string; line: PayrollLine; workingDays: number; payment?: SalaryPayment }) {
  const company = useCompany();
  const month = format(parseISO(`${period}-01`), "MMMM yyyy");
  return (
    <article className="print-slip mx-auto w-full max-w-[720px] border border-black/70 bg-white p-6 text-[12px] leading-snug text-black">
      <header className="flex items-start justify-between border-b border-black/70 pb-3">
        <div>
          <h2 className="text-base font-bold uppercase">{company.name}</h2>
          <p>{company.address}</p>
        </div>
        <div className="text-right">
          <p className="text-sm font-bold">SALARY SLIP</p>
          <p>{month}</p>
        </div>
      </header>

      <section className="grid grid-cols-2 gap-x-8 gap-y-1 border-b border-black/30 py-3">
        <p><span className="inline-block w-28 text-black/60">Employee</span><b>{line.name}</b></p>
        <p><span className="inline-block w-28 text-black/60">Code</span>{line.code}</p>
        <p><span className="inline-block w-28 text-black/60">Department</span>{line.department}</p>
        <p><span className="inline-block w-28 text-black/60">Designation</span>{line.designation}</p>
        <p><span className="inline-block w-28 text-black/60">Wage</span>{formatINR(line.wageRate, { precise: line.wageType === "piece_rate" })}{WAGE_UNIT[line.wageType]} ({WAGE_TYPE_LABEL[line.wageType]})</p>
        <p><span className="inline-block w-28 text-black/60">OT rate</span>{formatINR(line.overtimeRatePerHour)}/hour</p>
      </section>

      <section className="grid grid-cols-6 border-b border-black/30 py-2 text-center">
        {[
          ["Working days", workingDays],
          ["Present", line.presentDays],
          ["Half days", line.halfDays],
          ["Absent / Leave", `${line.absentDays} / ${line.leaveDays}`],
          ["Paid days", line.paidDays],
          [line.wageType === "piece_rate" ? "Pieces" : "OT hours", line.wageType === "piece_rate" ? line.pieces.toLocaleString("en-IN") : line.overtimeHours],
        ].map(([k, v]) => (
          <div key={String(k)}>
            <div className="text-[10px] text-black/60 uppercase">{k}</div>
            <div className="font-semibold tabular">{v}</div>
          </div>
        ))}
      </section>

      <section className="grid grid-cols-2 gap-8 py-3">
        <table className="w-full">
          <thead><tr className="border-b border-black/50 text-left"><th className="pb-1">Earnings</th><th className="pb-1 text-right">₹</th></tr></thead>
          <tbody>
            <Row label="Basic wages" value={formatINR(line.basic)} />
            <Row label={`Overtime (${line.overtimeHours} h)`} value={formatINR(line.overtime)} />
            {line.bonus > 0 && <Row label="Bonus / incentive" value={formatINR(line.bonus)} />}
            <Row label="Gross earnings" value={formatINR(line.gross)} strong />
          </tbody>
        </table>
        <table className="w-full">
          <thead><tr className="border-b border-black/50 text-left"><th className="pb-1">Deductions</th><th className="pb-1 text-right">₹</th></tr></thead>
          <tbody>
            <Row label="Advance recovery" value={formatINR(line.advanceDeduction)} />
            {line.otherDeduction > 0 && <Row label={line.otherDeductionNote || "Other"} value={formatINR(line.otherDeduction)} />}
            <Row label="Total deductions" value={formatINR(line.advanceDeduction + line.otherDeduction)} strong />
          </tbody>
        </table>
      </section>

      <section className="flex items-center justify-between border-y border-black/70 py-2">
        <div>
          <div className="text-sm font-bold">Net pay: {formatINR(line.net)}</div>
          <div className="text-[11px] italic">{rupeesInWords(line.net)}</div>
        </div>
        <div className="text-right text-[11px]">
          {payment ? <>Paid on {formatDate(payment.paidOn)} by {payment.mode.toUpperCase()}</> : <>Payment pending</>}
          {line.advanceOutstanding - line.advanceDeduction > 0 && <div>Advance balance carried forward: {formatINR(line.advanceOutstanding - line.advanceDeduction)}</div>}
        </div>
      </section>

      <footer className="mt-10 flex justify-between text-[11px]">
        <span className="border-t border-black/60 px-6 pt-1">Employee signature / thumb</span>
        <span className="border-t border-black/60 px-6 pt-1">Authorised signatory</span>
      </footer>
    </article>
  );
}

/** Lays out slips two per A4 page. */
export function SlipPages({ children }: { children: React.ReactNode[] }) {
  const pages: React.ReactNode[][] = [];
  children.forEach((c, i) => (i % 2 === 0 ? pages.push([c]) : pages[pages.length - 1]!.push(c)));
  return (
    <>
      {pages.map((p, i) => (
        <div key={i} className="print-page flex flex-col gap-[10mm] font-sans">{p}</div>
      ))}
    </>
  );
}
