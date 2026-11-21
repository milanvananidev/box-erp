import {
  Download,
  ExternalLink,
  RefreshCw,
  CheckCircle2,
  Sparkles,
  Laptop,
  FileCode,
  HardDriveDownload,
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export const APP_VERSION = "0.1.0";
const REPO_OWNER = "milanvananidev";
const REPO_NAME = "box-erp";
const GITHUB_RELEASES_URL = `https://github.com/${REPO_OWNER}/${REPO_NAME}/releases`;

export interface ReleaseAsset {
  name: string;
  size: number;
  browser_download_url: string;
}

export interface ReleaseInfo {
  tag_name: string;
  name: string;
  published_at: string;
  html_url: string;
  body: string;
  assets: ReleaseAsset[];
}

function compareSemver(v1: string, v2: string): number {
  const clean1 = v1.replace(/^v/, "").split(".").map(Number);
  const clean2 = v2.replace(/^v/, "").split(".").map(Number);
  for (let i = 0; i < Math.max(clean1.length, clean2.length); i++) {
    const a = clean1[i] || 0;
    const b = clean2[i] || 0;
    if (a > b) return 1;
    if (a < b) return -1;
  }
  return 0;
}

function formatBytes(bytes: number, decimals = 1) {
  if (bytes === 0) return "0 Bytes";
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ["Bytes", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + " " + sizes[i];
}

export function AppUpdatesView({
  isChecking,
  onCheck,
  lastRelease,
  hasChecked,
}: {
  isChecking: boolean;
  onCheck: () => void;
  lastRelease: ReleaseInfo | null;
  hasChecked: boolean;
}) {
  const isUpdateAvailable = lastRelease ? compareSemver(lastRelease.tag_name, APP_VERSION) > 0 : false;

  const exeAsset = lastRelease?.assets.find((a) => a.name.endsWith(".exe"));
  const msiAsset = lastRelease?.assets.find((a) => a.name.endsWith(".msi"));
  const dmgAsset = lastRelease?.assets.find((a) => a.name.endsWith(".dmg"));

  return (
    <div className="space-y-6">
      {/* Current Version Card */}
      <Card>
        <CardHeader className="border-b border-border pb-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <CardTitle className="text-base font-bold text-foreground">BoxERP Software Updates</CardTitle>
                <Badge tone="outline" className="font-mono text-xs">
                  v{APP_VERSION}
                </Badge>
              </div>
              <CardDescription>
                Check for official releases, installer updates (.exe), and changelogs.
              </CardDescription>
            </div>
            <Button
              onClick={onCheck}
              loading={isChecking}
              size="sm"
              className="gap-1.5 self-start sm:self-auto cursor-pointer"
            >
              <RefreshCw className="size-3.5" /> Check for Updates
            </Button>
          </div>
        </CardHeader>

        <CardContent className="pt-6 space-y-6">
          {/* Status Banner */}
          {hasChecked && (
            <div>
              {isUpdateAvailable ? (
                <div className="flex items-start gap-3 rounded-xl border border-amber-300 bg-amber-50/80 p-4 text-amber-900">
                  <Sparkles className="size-5 shrink-0 text-amber-600 mt-0.5" />
                  <div className="space-y-1">
                    <div className="font-semibold text-sm">
                      New Version {lastRelease?.tag_name} is Available!
                    </div>
                    <div className="text-xs text-amber-800">
                      You are currently on version v{APP_VERSION}. An updated installer is ready to download.
                    </div>
                  </div>
                </div>
              ) : (
                <div className="flex items-start gap-3 rounded-xl border border-emerald-200 bg-emerald-50/70 p-4 text-emerald-900">
                  <CheckCircle2 className="size-5 shrink-0 text-emerald-600 mt-0.5" />
                  <div className="space-y-1">
                    <div className="font-semibold text-sm">You are on the latest version of BoxERP!</div>
                    <div className="text-xs text-emerald-800">
                      Version v{APP_VERSION} is the latest release available on the official channel.
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Quick Details Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="rounded-xl border border-border bg-subtle p-3.5">
              <div className="text-xs text-muted-foreground font-medium flex items-center gap-1.5">
                <Laptop className="size-3.5 text-brand-600" /> Current Installed Version
              </div>
              <div className="mt-1.5 text-lg font-bold font-mono text-foreground">
                v{APP_VERSION}
              </div>
              <div className="text-[11px] text-muted-foreground mt-0.5">Production Channel</div>
            </div>

            <div className="rounded-xl border border-border bg-subtle p-3.5">
              <div className="text-xs text-muted-foreground font-medium flex items-center gap-1.5">
                <HardDriveDownload className="size-3.5 text-brand-600" /> Latest Release Available
              </div>
              <div className="mt-1.5 text-lg font-bold font-mono text-brand-700">
                {lastRelease?.tag_name ?? `v${APP_VERSION}`}
              </div>
              <div className="text-[11px] text-muted-foreground mt-0.5">
                {lastRelease ? `Released on ${new Date(lastRelease.published_at).toLocaleDateString()}` : "Up to date"}
              </div>
            </div>

            <div className="rounded-xl border border-border bg-subtle p-3.5">
              <div className="text-xs text-muted-foreground font-medium flex items-center gap-1.5">
                <FileCode className="size-3.5 text-brand-600" /> Distribution Channel
              </div>
              <div className="mt-1.5 text-sm font-bold text-foreground truncate">
                GitHub Official
              </div>
              <div className="text-[11px] text-muted-foreground mt-0.5">
                {REPO_OWNER}/{REPO_NAME}
              </div>
            </div>
          </div>

          {/* Download Installers (If release is found) */}
          {lastRelease && (
            <div className="space-y-3 pt-2">
              <h4 className="text-xs font-semibold text-foreground uppercase tracking-wider">
                Official Installers ({lastRelease.tag_name})
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {exeAsset && (
                  <a
                    href={exeAsset.browser_download_url}
                    target="_blank"
                    rel="noreferrer"
                    className="flex flex-col justify-between rounded-xl border border-brand-200 bg-brand-50/40 p-4 hover:bg-brand-50 hover:border-brand-300 transition-all cursor-pointer group"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-sm text-foreground group-hover:text-brand-700">
                          Windows Setup (.exe)
                        </span>
                        <Download className="size-4 text-brand-600 group-hover:translate-y-0.5 transition-transform" />
                      </div>
                      <p className="text-xs text-muted-foreground">Standard Windows standalone installer</p>
                    </div>
                    <div className="mt-3 text-[11px] font-mono font-medium text-brand-700">
                      {formatBytes(exeAsset.size)}
                    </div>
                  </a>
                )}

                {msiAsset && (
                  <a
                    href={msiAsset.browser_download_url}
                    target="_blank"
                    rel="noreferrer"
                    className="flex flex-col justify-between rounded-xl border border-border bg-card p-4 hover:bg-subtle transition-all cursor-pointer group"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-sm text-foreground">Windows Package (.msi)</span>
                        <Download className="size-4 text-muted-foreground group-hover:translate-y-0.5 transition-transform" />
                      </div>
                      <p className="text-xs text-muted-foreground">Enterprise WiX installer package</p>
                    </div>
                    <div className="mt-3 text-[11px] font-mono font-medium text-muted-foreground">
                      {formatBytes(msiAsset.size)}
                    </div>
                  </a>
                )}

                {dmgAsset && (
                  <a
                    href={dmgAsset.browser_download_url}
                    target="_blank"
                    rel="noreferrer"
                    className="flex flex-col justify-between rounded-xl border border-border bg-card p-4 hover:bg-subtle transition-all cursor-pointer group"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-sm text-foreground">macOS (.dmg)</span>
                        <Download className="size-4 text-muted-foreground group-hover:translate-y-0.5 transition-transform" />
                      </div>
                      <p className="text-xs text-muted-foreground">Apple Silicon drag-and-drop installer</p>
                    </div>
                    <div className="mt-3 text-[11px] font-mono font-medium text-muted-foreground">
                      {formatBytes(dmgAsset.size)}
                    </div>
                  </a>
                )}
              </div>
            </div>
          )}

          {/* Release Notes */}
          {lastRelease && lastRelease.body && (
            <div className="space-y-2 rounded-xl border border-border bg-subtle p-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-foreground">Release Notes ({lastRelease.tag_name})</span>
                <a
                  href={lastRelease.html_url}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-1 text-xs text-brand-600 hover:text-brand-700 font-medium cursor-pointer"
                >
                  View on GitHub <ExternalLink className="size-3" />
                </a>
              </div>
              <pre className="text-xs font-mono text-muted-foreground whitespace-pre-wrap leading-relaxed pt-1">
                {lastRelease.body}
              </pre>
            </div>
          )}

          {/* Footer Info */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-2 border-t border-border text-xs text-muted-foreground">
            <span>
              Developed by{" "}
              <a
                href="https://www.dhyeytechnologies.in/"
                target="_blank"
                rel="noreferrer"
                className="font-semibold text-brand-700 hover:text-brand-800 hover:underline transition-colors cursor-pointer"
              >
                Dhyey Technologies
              </a>
            </span>
            <a
              href={GITHUB_RELEASES_URL}
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-1 font-medium text-brand-600 hover:text-brand-700 cursor-pointer"
            >
              All Releases History <ExternalLink className="size-3" />
            </a>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
