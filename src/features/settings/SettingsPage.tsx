import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  Building2,
  Database,
  Keyboard,
  Save,
  ShieldCheck,
  Unplug,
  Phone,
  MapPin,
  Receipt,
  Calendar,
  Wallet,
  Monitor,
  RefreshCw,
} from "lucide-react";
import { usePageMeta } from "@/hooks/use-page-meta";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CurrencyInput } from "@/components/ui/currency-input";
import { Kbd } from "@/components/ui/kbd";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FormField } from "@/components/shared/FormField";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { Skeleton } from "@/components/ui/skeleton";
import { modKeyLabel } from "@/hooks/use-hotkeys";
import { isTauri } from "@/lib/env";
import {
  useCompanySettings,
  useConfigureDb,
  useDbStatus,
  useForgetDb,
  useUpdateCompanySettings,
} from "./api";
import { AppUpdatesView, APP_VERSION, type ReleaseInfo } from "./components/AppUpdatesView";

function CompanySettingsView() {
  const settingsQuery = useCompanySettings();
  const updateSettings = useUpdateCompanySettings();
  const data = settingsQuery.data;

  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [phone, setPhone] = useState("");
  const [gstin, setGstin] = useState("");
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
        wastageTargetPct: data?.wastageTargetPct ?? 3.0,
        weeklyOff,
        openingCashBalance: Math.round(Number(openingCash) * 100),
        openingBankBalance: Math.round(Number(openingBank) * 100),
        openingDate,
      });
      toast.success("Settings saved", {
        description: "Company profile and financial balances updated.",
      });
    } catch (err) {
      toast.error("Couldn't save settings", {
        description: err instanceof Error ? err.message : undefined,
      });
    }
  };

  if (settingsQuery.isLoading) {
    return (
      <Card>
        <CardHeader><Skeleton className="h-6 w-48" /></CardHeader>
        <CardContent className="space-y-4">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-28 w-full" />
        </CardContent>
      </Card>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Business Details Card */}
      <Card>
        <CardHeader className="border-b border-border pb-4">
          <div className="flex items-center gap-3">
            <span className="flex size-10 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
              <Building2 className="size-5" />
            </span>
            <div>
              <CardTitle className="text-base font-semibold">Factory & Company Profile</CardTitle>
              <CardDescription className="text-xs">
                Business identity printed on quotations, proposals, reports, and payment receipts.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-5 space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField label="Company / Business Name" htmlFor="comp-name" required>
              <Input
                id="comp-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Gujarat Corrugated Box Industry"
                className="font-medium"
              />
            </FormField>
            <FormField label="GSTIN (Tax ID)" htmlFor="comp-gstin">
              <div className="relative">
                <Receipt className="size-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
                <Input
                  id="comp-gstin"
                  value={gstin}
                  onChange={(e) => setGstin(e.target.value)}
                  placeholder="24AABCB1234D1Z2"
                  className="pl-9 font-mono"
                />
              </div>
            </FormField>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <FormField label="Factory & Works Address" htmlFor="comp-address" required>
              <div className="relative">
                <MapPin className="size-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
                <Input
                  id="comp-address"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="Plot 42, GIDC Industrial Estate, Rajkot, Gujarat"
                  className="pl-9"
                />
              </div>
            </FormField>
            <FormField label="Official Phone / Contact" htmlFor="comp-phone">
              <div className="relative">
                <Phone className="size-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
                <Input
                  id="comp-phone"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+91 98765 43210"
                  className="pl-9"
                />
              </div>
            </FormField>
          </div>

          <div className="max-w-xs pt-1">
            <FormField label="Weekly Factory Holiday" htmlFor="comp-weekly-off">
              <Input
                id="comp-weekly-off"
                value={weeklyOff}
                onChange={(e) => setWeeklyOff(e.target.value)}
                placeholder="Sunday"
              />
            </FormField>
          </div>
        </CardContent>
      </Card>

      {/* Opening Balances Card */}
      <Card>
        <CardHeader className="border-b border-border pb-4">
          <div className="flex items-center gap-3">
            <span className="flex size-10 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
              <Wallet className="size-5" />
            </span>
            <div>
              <CardTitle className="text-base font-semibold">Opening Balances & Books Baseline</CardTitle>
              <CardDescription className="text-xs">
                Starting ledger balances used to calculate running cash in hand and bank totals.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-5 space-y-4">
          <div className="grid gap-4 sm:grid-cols-3">
            <FormField label="Opening Cash in Hand (₹)" htmlFor="comp-open-cash">
              <CurrencyInput
                id="comp-open-cash"
                placeholder="0"
                value={openingCash}
                onChange={(val) => setOpeningCash(val || 0)}
                className="font-mono text-base"
              />
            </FormField>
            <FormField label="Opening Bank Balance (₹)" htmlFor="comp-open-bank">
              <CurrencyInput
                id="comp-open-bank"
                placeholder="0"
                value={openingBank}
                onChange={(val) => setOpeningBank(val || 0)}
                className="font-mono text-base"
              />
            </FormField>
            <FormField label="Books Baseline Date" htmlFor="comp-open-date" required>
              <div className="relative">
                <Calendar className="size-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
                <Input
                  id="comp-open-date"
                  type="date"
                  value={openingDate}
                  onChange={(e) => setOpeningDate(e.target.value)}
                  className="pl-9"
                />
              </div>
            </FormField>
          </div>

          <div className="flex justify-end pt-3">
            <Button
              type="submit"
              loading={updateSettings.isPending}
              disabled={!name.trim() || !address.trim()}
              className="px-6"
            >
              <Save className="size-4" /> Save Company Settings
            </Button>
          </div>
        </CardContent>
      </Card>
    </form>
  );
}

function DatabaseSettingsView() {
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
      toast.success("Database connected successfully", {
        description: `${res.host} / ${res.database}`,
      });
    } catch (err) {
      toast.error("Connection failed", {
        description: err instanceof Error ? err.message : undefined,
      });
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="border-b border-border pb-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="flex size-10 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
                <Database className="size-5" />
              </span>
              <div>
                <CardTitle className="text-base font-semibold">MongoDB Database Connection</CardTitle>
                <CardDescription className="text-xs">
                  Direct IPC connection between the desktop Rust runtime and your MongoDB replica set.
                </CardDescription>
              </div>
            </div>

            {desktop && (
              status.isLoading ? (
                <Skeleton className="h-6 w-24" />
              ) : s?.connected ? (
                <Badge tone="success" size="md" dot>Connected</Badge>
              ) : s?.configured ? (
                <Badge tone="danger" size="md" dot>Unreachable</Badge>
              ) : (
                <Badge tone="neutral" size="md" dot>Not Configured</Badge>
              )
            )}
          </div>
        </CardHeader>

        <CardContent className="pt-5">
          {!desktop ? (
            <div className="flex items-center gap-3 rounded-xl bg-info-soft p-4 text-sm text-info-foreground">
              <Monitor className="size-5 shrink-0" />
              <p>
                You are viewing the browser preview. Launch the desktop application to configure direct MongoDB credentials.
              </p>
            </div>
          ) : (
            <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
              <form onSubmit={submit} className="space-y-4">
                {s?.configured && (
                  <div className="grid grid-cols-3 gap-3 rounded-xl border border-border bg-subtle p-3.5 text-xs">
                    <div>
                      <span className="text-muted-foreground block text-[11px]">Host / Cluster</span>
                      <span className="font-semibold text-foreground truncate block">{s.host || "—"}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground block text-[11px]">Database</span>
                      <span className="font-semibold text-foreground">{s.database || "boxerp"}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground block text-[11px]">Credentials Stored In</span>
                      <span className="font-semibold text-foreground">
                        {s.source === "env" ? "Environment Variable" : "OS Keychain"}
                      </span>
                    </div>
                    {s.error && (
                      <p className="col-span-3 text-xs text-danger-foreground font-medium pt-1">
                        Error: {s.error}
                      </p>
                    )}
                  </div>
                )}

                <FormField
                  label="MongoDB Connection String (URI)"
                  htmlFor="db-uri"
                  required
                  hint="mongodb+srv://<user>:<password>@cluster.mongodb.net — stored in your OS keychain"
                >
                  <Input
                    id="db-uri"
                    type="password"
                    autoComplete="off"
                    spellCheck={false}
                    value={uri}
                    onChange={(e) => setUri(e.target.value)}
                    placeholder={s?.configured ? "•••••••••••••••• (Saved in Keychain — enter new URI to replace)" : "mongodb+srv://user:pass@cluster.mongodb.net"}
                    className="font-mono text-sm"
                  />
                </FormField>

                <div className="max-w-xs">
                  <FormField label="Database Name" htmlFor="db-name" required>
                    <Input
                      id="db-name"
                      value={database}
                      onChange={(e) => setDatabase(e.target.value)}
                      className="font-mono text-sm"
                    />
                  </FormField>
                </div>

                <div className="flex flex-wrap items-center gap-2 pt-2">
                  <Button
                    type="submit"
                    loading={configure.isPending}
                    disabled={!uri.trim() || !database.trim()}
                  >
                    <RefreshCw className="size-4" /> Save & Connect
                  </Button>
                  {s?.configured && s.source !== "env" && (
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setConfirmForget(true)}
                      className="text-danger-foreground border-danger/30 hover:bg-danger-soft"
                    >
                      <Unplug className="size-4" /> Disconnect Database
                    </Button>
                  )}
                </div>
              </form>

              {/* Security info card */}
              <div className="space-y-3 rounded-xl border border-border bg-subtle p-4 text-xs text-[#475467]">
                <p className="flex items-center gap-2 font-semibold text-foreground text-sm">
                  <ShieldCheck className="size-4 text-success" /> Zero Plain-Text Storage
                </p>
                <ul className="list-disc space-y-2 pl-4 leading-relaxed">
                  <li>Credentials are saved directly to the hardware-backed <b>OS Keychain</b> (macOS Keychain or Windows Credential Manager).</li>
                  <li>No database credentials ever touch JavaScript, browser memory, or disk configuration files.</li>
                  <li>Mandatory TLS 1.3 encryption across all communication between the Rust backend and MongoDB Atlas.</li>
                </ul>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <ConfirmDialog
        open={confirmForget}
        onOpenChange={setConfirmForget}
        title="Disconnect Database?"
        description="The saved connection string will be removed from this computer's keychain. Your data in MongoDB remains completely safe. You will need your credentials to reconnect."
        confirmLabel="Disconnect"
        onConfirm={async () => {
          try {
            await forget.mutateAsync();
            toast.success("Disconnected from database");
          } catch (e) {
            toast.error("Couldn't disconnect", {
              description: e instanceof Error ? e.message : undefined,
            });
            throw e;
          }
        }}
      />
    </div>
  );
}

function ShortcutsView() {
  const shortcutList = [
    { group: "Navigation", items: [
      { key: `${modKeyLabel} K`, desc: "Search & Command Palette" },
      { key: `${modKeyLabel} B`, desc: "Toggle Sidebar Collapse" },
      { key: `${modKeyLabel} 1`, desc: "Jump to Dashboard" },
      { key: `${modKeyLabel} 2`, desc: "Jump to Box Costing" },
      { key: `${modKeyLabel} 3`, desc: "Jump to Inventory" },
      { key: `${modKeyLabel} 4`, desc: "Jump to Workers & HR" },
      { key: `${modKeyLabel} 5`, desc: "Jump to Payroll" },
      { key: `${modKeyLabel} 6`, desc: "Jump to Income & Expenses" },
      { key: `${modKeyLabel} 7`, desc: "Jump to Reports" },
      { key: `${modKeyLabel} 8`, desc: "Jump to Settings" },
    ]},
    { group: "Actions & Forms", items: [
      { key: `${modKeyLabel} ⇧ I`, desc: "New Income Transaction" },
      { key: `${modKeyLabel} ⇧ E`, desc: "New Expense Transaction" },
      { key: "N", desc: "Add New Item (when in list views)" },
      { key: "/", desc: "Focus Table Quick Search" },
      { key: `${modKeyLabel} Enter`, desc: "Save / Submit Current Form" },
      { key: "Esc", desc: "Close Open Drawer or Dialog" },
    ]},
  ];

  return (
    <div className="grid gap-6 md:grid-cols-2">
      {shortcutList.map((section) => (
        <Card key={section.group}>
          <CardHeader className="border-b border-border pb-3">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Keyboard className="size-4 text-brand-600" /> {section.group} Shortcuts
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-3">
            <ul className="divide-y divide-border">
              {section.items.map((item) => (
                <li key={item.desc} className="flex items-center justify-between py-2 text-xs">
                  <span className="text-[#344054] font-medium">{item.desc}</span>
                  <span className="flex items-center gap-1">
                    {item.key.split(" ").map((k) => (
                      <Kbd key={k}>{k}</Kbd>
                    ))}
                  </span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

export default function SettingsPage() {
  usePageMeta("Settings", "Company profile, database connection & system shortcuts");
  const [activeTab, setActiveTab] = useState<"company" | "database" | "updates" | "shortcuts">("company");
  const [isCheckingUpdate, setIsCheckingUpdate] = useState(false);
  const [lastRelease, setLastRelease] = useState<ReleaseInfo | null>(null);
  const [hasChecked, setHasChecked] = useState(false);

  const handleCheckUpdate = async (silent = false) => {
    setIsCheckingUpdate(true);
    try {
      const res = await fetch("https://api.github.com/repos/milanvananidev/box-erp/releases/latest");
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data: ReleaseInfo = await res.json();
      setLastRelease(data);
      setHasChecked(true);

      const latestClean = data.tag_name.replace(/^v/, "");
      const isNewer = latestClean.localeCompare(APP_VERSION, undefined, { numeric: true }) > 0;
      if (isNewer) {
        toast.info(`New version ${data.tag_name} is available!`, {
          description: "An updated Windows installer (.exe) is ready to download.",
          action: {
            label: "View Update",
            onClick: () => setActiveTab("updates"),
          },
        });
      } else if (!silent) {
        toast.success("BoxERP is up to date", {
          description: `You are running the latest version (v${APP_VERSION}).`,
        });
      }
    } catch (e) {
      if (!silent) {
        toast.error("Couldn't check for updates", {
          description: e instanceof Error ? e.message : "Please check your network connection.",
        });
      }
    } finally {
      setIsCheckingUpdate(false);
    }
  };

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border pb-3">
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as typeof activeTab)}>
          <TabsList>
            <TabsTrigger value="company" className="flex items-center gap-2">
              <Building2 className="size-4" /> Company & Factory
            </TabsTrigger>
            <TabsTrigger value="database" className="flex items-center gap-2">
              <Database className="size-4" /> Database Connection
            </TabsTrigger>
            <TabsTrigger value="updates" className="flex items-center gap-2">
              <RefreshCw className="size-4" /> App & Updates
            </TabsTrigger>
            <TabsTrigger value="shortcuts" className="flex items-center gap-2">
              <Keyboard className="size-4" /> Shortcuts
            </TabsTrigger>
          </TabsList>
        </Tabs>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleCheckUpdate(false)}
            loading={isCheckingUpdate}
            className="text-xs h-8 gap-1.5 cursor-pointer shadow-2xs"
            title="Check for software updates from GitHub"
          >
            <RefreshCw className="size-3.5" /> Check for Updates
          </Button>
        </div>
      </div>

      {activeTab === "company" && <CompanySettingsView />}
      {activeTab === "database" && <DatabaseSettingsView />}
      {activeTab === "updates" && (
        <AppUpdatesView
          isChecking={isCheckingUpdate}
          onCheck={() => handleCheckUpdate(false)}
          lastRelease={lastRelease}
          hasChecked={hasChecked}
        />
      )}
      {activeTab === "shortcuts" && <ShortcutsView />}
    </div>
  );
}
