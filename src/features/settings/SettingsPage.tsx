import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Database, DatabaseZap, Factory, KeyRound, Monitor, ShieldCheck, Unplug } from "lucide-react";
import { usePageMeta } from "@/hooks/use-page-meta";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Kbd } from "@/components/ui/kbd";
import { FormField } from "@/components/shared/FormField";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { Skeleton } from "@/components/ui/skeleton";
import { modKeyLabel } from "@/hooks/use-hotkeys";
import { isTauri, dataSource } from "@/lib/env";
import { useCompanySettings, useConfigureDb, useDbStatus, useForgetDb, useImportDemo, useUpdateCompanySettings } from "./api";
import { LIVE_MODULES, MOCK_MODULES } from "@/lib/live-commands";

function DatabaseCard() {
  const status = useDbStatus();
  const configure = useConfigureDb();
  const forget = useForgetDb();
  const [uri, setUri] = useState("");
  const [database, setDatabase] = useState("boxerp");
  const [confirmForget, setConfirmForget] = useState(false);
  const desktop = isTauri();
  const s = status.data;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await configure.mutateAsync({ uri: uri.trim(), database: database.trim() });
      setUri("");
      toast.success("Connected", { description: `${res.host} / ${res.database}` });
    } catch (err) {
      toast.error("Connection failed", { description: err instanceof Error ? err.message : undefined });
    }
  };

  return (
    <Card>
      <CardHeader className="border-b border-border pb-4">
        <div className="flex gap-3">
          <span className="flex size-10 items-center justify-center rounded-xl bg-brand-50 text-brand-600"><Database className="size-5" /></span>
          <div>
            <CardTitle>Database connection</CardTitle>
            <CardDescription>MongoDB is accessed only from the desktop app's Rust layer — never from the UI.</CardDescription>
          </div>
        </div>
        {desktop && (status.isLoading ? <Skeleton className="h-6 w-24" /> : s?.connected ? <Badge tone="success" size="md" dot>Connected</Badge> : s?.configured ? <Badge tone="danger" size="md" dot>Unreachable</Badge> : <Badge tone="neutral" size="md" dot>Not configured</Badge>)}
      </CardHeader>
      <CardContent className="pt-5">
        {!desktop ? (
          <div className="flex gap-3 rounded-xl bg-info-soft p-4 text-sm text-info-foreground">
            <Monitor className="mt-0.5 size-4 shrink-0" />
            <p>You're viewing the browser preview with mock data. Open the desktop app (<code className="font-mono text-xs">pnpm tauri dev</code>) to configure the database.</p>
          </div>
        ) : (
          <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
            <form onSubmit={submit} className="space-y-4">
              {s?.configured && (
                <div className="grid grid-cols-3 gap-3 rounded-xl border border-border bg-subtle p-4 text-sm">
                  <div><div className="text-xs text-muted-foreground">Host</div><div className="truncate font-medium">{s.host}</div></div>
                  <div><div className="text-xs text-muted-foreground">Database</div><div className="font-medium">{s.database}</div></div>
                  <div><div className="text-xs text-muted-foreground">Stored in</div><div className="font-medium">{s.source === "env" ? "Environment variable" : "OS keychain"}</div></div>
                  {s.error && <p className="col-span-3 text-xs text-danger-foreground">{s.error}</p>}
                </div>
              )}
              <FormField label="Connection string" htmlFor="db-uri" required hint="mongodb+srv://<user>:<password>@cluster.example.net — use this computer's own database user">
                <Input id="db-uri" type="password" autoComplete="off" spellCheck={false} value={uri} onChange={(e) => setUri(e.target.value)}
                  placeholder={s?.configured ? "•••••••• (saved — enter a new one to replace)" : "mongodb+srv://…"} />
              </FormField>
              <FormField label="Database name" htmlFor="db-name" required>
                <Input id="db-name" value={database} onChange={(e) => setDatabase(e.target.value)} className="max-w-xs" />
              </FormField>
              <div className="flex flex-wrap gap-2">
                <Button type="submit" loading={configure.isPending} disabled={!uri.trim() || !database.trim()}>Test & save</Button>
                {import.meta.env.DEV && s?.connected && <DemoImportButton />}
                {s?.configured && s.source !== "env" && (
                  <Button type="button" variant="outline" onClick={() => setConfirmForget(true)}><Unplug /> Disconnect</Button>
                )}
              </div>
            </form>
            <aside className="space-y-3 rounded-xl bg-subtle p-4 text-[13px] text-[#475467]">
              <p className="flex items-center gap-2 font-medium text-foreground"><ShieldCheck className="size-4 text-success" /> How credentials are handled</p>
              <ul className="list-disc space-y-1.5 pl-4">
                <li>Nothing is bundled in the installer. Each computer is set up once by an administrator.</li>
                <li>The connection string is stored in the OS keychain (macOS Keychain / Windows Credential Manager), not in a file.</li>
                <li>Give each computer its own MongoDB user with only <code>readWrite</code> on the BoxERP database, and restrict Atlas network access to the factory/office IPs.</li>
                <li>TLS is required; plain <code>mongodb://</code> to a remote host is rejected.</li>
              </ul>
            </aside>
          </div>
        )}
      </CardContent>
      <ConfirmDialog
        open={confirmForget}
        onOpenChange={setConfirmForget}
        title="Disconnect this computer?"
        description="The saved connection string will be removed from this computer's keychain. Data in MongoDB is not affected. You'll need the credentials again to reconnect."
        confirmLabel="Disconnect"
        onConfirm={async () => {
          try { await forget.mutateAsync(); toast.success("Disconnected"); }
          catch (e) { toast.error("Couldn't disconnect", { description: e instanceof Error ? e.message : undefined }); throw e; }
        }}
      />
    </Card>
  );
}

function DemoImportButton() {
  const imp = useImportDemo();
  return (
    <Button type="button" variant="soft" loading={imp.isPending} onClick={async () => {
      try {
        const r = await imp.mutateAsync();
        toast.success("Demo data loaded", { description: r.collections.map(([n, c]) => `${c} ${n}`).join(", ") });
      } catch (e) {
        toast.error("Couldn't load demo data", { description: e instanceof Error ? e.message : undefined });
      }
    }}>
      <DatabaseZap /> Load demo data (dev)
    </Button>
  );
}

function CompanySettingsCard() {
  const settingsQuery = useCompanySettings();
  const updateSettings = useUpdateCompanySettings();
  const data = settingsQuery.data;

  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [phone, setPhone] = useState("");
  const [gstin, setGstin] = useState("");
  const [wastageTargetPct, setWastageTargetPct] = useState(3.0);
  const [weeklyOff, setWeeklyOff] = useState("Sunday");
  const [openingCash, setOpeningCash] = useState(0);
  const [openingBank, setOpeningBank] = useState(0);
  const [openingDate, setOpeningDate] = useState("2026-04-01");
  const [initialized, setInitialized] = useState(false);

  useEffect(() => {
    if (data && !initialized) {
      setName(data.name);
      setAddress(data.address);
      setPhone(data.phone);
      setGstin(data.gstin);
      setWastageTargetPct(data.wastageTargetPct);
      setWeeklyOff(data.weeklyOff);
      setOpeningCash(data.openingCashBalance / 100);
      setOpeningBank(data.openingBankBalance / 100);
      setOpeningDate(data.openingDate);
      setInitialized(true);
    }
  }, [data, initialized]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await updateSettings.mutateAsync({
        name: name.trim(),
        address: address.trim(),
        phone: phone.trim(),
        gstin: gstin.trim(),
        wastageTargetPct: Number(wastageTargetPct),
        weeklyOff,
        openingCashBalance: Math.round(Number(openingCash) * 100),
        openingBankBalance: Math.round(Number(openingBank) * 100),
        openingDate,
      });
      toast.success("Settings saved", { description: "Company profile and factory rules updated." });
    } catch (err) {
      toast.error("Couldn't save settings", { description: err instanceof Error ? err.message : undefined });
    }
  };

  if (settingsQuery.isLoading) {
    return (
      <Card>
        <CardHeader><Skeleton className="h-6 w-48" /></CardHeader>
        <CardContent><Skeleton className="h-40 w-full" /></CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="border-b border-border pb-4">
        <div className="flex gap-3">
          <span className="flex size-10 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
            <Factory className="size-5" />
          </span>
          <div>
            <CardTitle>Company profile & factory settings</CardTitle>
            <CardDescription>Printed on salary slips, reports, and used for wastage KPI targets.</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-5">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField label="Company / Factory name" htmlFor="comp-name" required>
              <Input id="comp-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Gujarat Corrugated Box Industry" />
            </FormField>
            <FormField label="GSTIN" htmlFor="comp-gstin">
              <Input id="comp-gstin" value={gstin} onChange={(e) => setGstin(e.target.value)} placeholder="24AABCB1234D1Z2" />
            </FormField>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField label="Factory address" htmlFor="comp-address" required>
              <Input id="comp-address" value={address} onChange={(e) => setAddress(e.target.value)} placeholder="GIDC Industrial Estate, Rajkot, Gujarat" />
            </FormField>
            <FormField label="Contact phone" htmlFor="comp-phone">
              <Input id="comp-phone" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+91 98765 43210" />
            </FormField>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField label="Wastage target (%)" htmlFor="comp-wastage" hint="Target threshold for factory wastage alerts">
              <Input id="comp-wastage" type="number" step="0.1" min="0" max="100" value={wastageTargetPct} onChange={(e) => setWastageTargetPct(Number(e.target.value))} />
            </FormField>
            <FormField label="Weekly off day" htmlFor="comp-weekly-off">
              <Input id="comp-weekly-off" value={weeklyOff} onChange={(e) => setWeeklyOff(e.target.value)} placeholder="Sunday" />
            </FormField>
          </div>
          <div className="border-t border-border pt-4">
            <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Opening Balances</p>
            <div className="grid gap-4 sm:grid-cols-3">
              <FormField label="Opening cash in hand (₹)" htmlFor="comp-open-cash">
                <Input id="comp-open-cash" type="number" step="any" value={openingCash} onChange={(e) => setOpeningCash(Number(e.target.value))} />
              </FormField>
              <FormField label="Opening bank balance (₹)" htmlFor="comp-open-bank">
                <Input id="comp-open-bank" type="number" step="any" value={openingBank} onChange={(e) => setOpeningBank(Number(e.target.value))} />
              </FormField>
              <FormField label="As-of date" htmlFor="comp-open-date" required>
                <Input id="comp-open-date" type="date" value={openingDate} onChange={(e) => setOpeningDate(e.target.value)} />
              </FormField>
            </div>
          </div>
          <div className="pt-2">
            <Button type="submit" loading={updateSettings.isPending} disabled={!name.trim() || !address.trim()}>
              Save changes
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

function DataSourceCard() {
  const live = dataSource === "tauri";
  return (
    <Card>
      <CardHeader><div><CardTitle>Data source</CardTitle><CardDescription>Which screens read and write MongoDB</CardDescription></div></CardHeader>
      <CardContent className="space-y-3 text-sm">
        {!live && <p className="rounded-lg bg-info-soft px-3 py-2 text-[13px] text-info-foreground">Running on mock data. Start the desktop app with <code className="font-mono text-xs">VITE_DATA_SOURCE=tauri</code> to use the database.</p>}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="mb-1.5 text-xs font-medium text-muted-foreground uppercase">{live ? "Live (MongoDB)" : "Ready for MongoDB"}</p>
            <ul className="space-y-1">{LIVE_MODULES.map((m) => <li key={m} className="flex items-center gap-2"><span className="size-2 rounded-full bg-success" />{m}</li>)}</ul>
          </div>
          <div>
            <p className="mb-1.5 text-xs font-medium text-muted-foreground uppercase">Still mock data</p>
            <ul className="space-y-1 text-muted-foreground">{MOCK_MODULES.map((m) => <li key={m} className="flex items-center gap-2"><span className="size-2 rounded-full bg-[#d0d5dd]" />{m}</li>)}</ul>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

const shortcuts: [string, string][] = [
  [`${modKeyLabel} K`, "Search & command palette"],
  [`${modKeyLabel} B`, "Collapse / expand sidebar"],
  [`${modKeyLabel} 1 – 8`, "Jump to a module"],
  [`${modKeyLabel} ⇧ E`, "New expense"],
  [`${modKeyLabel} ⇧ I`, "New income"],
  ["/", "Focus table search"],
  [`${modKeyLabel} Enter`, "Save open form"],
  ["Esc", "Close drawer / dialog"],
];

export default function SettingsPage() {
  usePageMeta("Settings", "Connection, preferences and shortcuts");
  return (
    <div className="grid gap-5">
      <CompanySettingsCard />
      <DatabaseCard />
      <DataSourceCard />
      <div className="grid gap-5 lg:grid-cols-2">
        <Card>
          <CardHeader><div><CardTitle>Keyboard shortcuts</CardTitle><CardDescription>Work faster without the mouse</CardDescription></div></CardHeader>
          <CardContent>
            <ul className="divide-y divide-border">
              {shortcuts.map(([k, d]) => (
                <li key={d} className="flex items-center justify-between py-2.5 text-sm">
                  <span className="text-[#344054]">{d}</span>
                  <span className="flex gap-1">{k.split(" ").map((p) => <Kbd key={p}>{p}</Kbd>)}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><div><CardTitle>Billing & Vyapar</CardTitle><CardDescription>How BoxERP and Vyapar work together</CardDescription></div></CardHeader>
          <CardContent className="space-y-3 text-sm text-[#475467]">
            <p className="flex gap-2"><KeyRound className="mt-0.5 size-4 shrink-0 text-brand-500" /> Vyapar remains the system for invoices and GST. BoxERP does not issue bills.</p>
            <p>Customer receipts and vendor payments can be imported from Vyapar CSV exports. Each imported row keeps its Vyapar voucher number, so importing the same file twice never creates duplicates.</p>
            <p>When you enter a payment manually, BoxERP warns you if a matching Vyapar entry already exists.</p>
            <p className="text-xs text-muted-foreground">Data source: <span className="font-medium">{dataSource === "mock" ? "Mock data (UI review)" : "MongoDB"}</span></p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
