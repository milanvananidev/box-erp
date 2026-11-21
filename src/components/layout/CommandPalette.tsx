import { useNavigate } from "react-router-dom";
import { ArrowDownLeft, ArrowUpRight, Calculator, HandCoins, UserCheck, UserPlus, PackagePlus, PanelLeft, Package, User } from "lucide-react";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import {
  Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList, CommandSeparator,
} from "@/components/ui/command";
import { Kbd } from "@/components/ui/kbd";
import { allNavItems } from "@/lib/nav";
import { useUI } from "@/stores/ui";
import { modKeyLabel } from "@/hooks/use-hotkeys";
import { useMaterials } from "@/features/inventory/api";
import { useWorkerRoster } from "@/features/workers/api";

export function CommandPalette() {
  const open = useUI((s) => s.commandOpen);
  const setOpen = useUI((s) => s.setCommandOpen);
  const openTxn = useUI((s) => s.openTxnSheet);
  const toggleSidebar = useUI((s) => s.toggleSidebar);
  const navigate = useNavigate();
  const { data: roster = [] } = useWorkerRoster();
  const workers = roster.filter((w) => w.active);
  const { data: materials = [] } = useMaterials();

  const run = (fn: () => void) => {
    setOpen(false);
    // let the dialog close before opening drawers so focus is restored correctly
    requestAnimationFrame(fn);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent hideClose className="max-w-xl overflow-hidden p-0">
        <DialogTitle className="sr-only">Command palette</DialogTitle>
        <DialogDescription className="sr-only">Search pages, records and actions</DialogDescription>
        <Command loop>
          <CommandInput placeholder="Search workers, materials, or type a command…" />
          <CommandList>
            <CommandEmpty>No results found.</CommandEmpty>
            <CommandGroup heading="Actions">
              <CommandItem value="add expense out payment" onSelect={() => run(() => openTxn("out"))}>
                <ArrowUpRight /> Add expense <Kbd className="ml-auto">{modKeyLabel}⇧E</Kbd>
              </CommandItem>
              <CommandItem value="add income receipt in" onSelect={() => run(() => openTxn("in"))}>
                <ArrowDownLeft /> Add income <Kbd className="ml-auto">{modKeyLabel}⇧I</Kbd>
              </CommandItem>
              <CommandItem value="box costing quotation estimate calculator" onSelect={() => run(() => navigate("/costing"))}>
                <Calculator /> Box costing & estimate
              </CommandItem>
              <CommandItem value="mark attendance" onSelect={() => run(() => navigate("/workers"))}>
                <UserCheck /> Mark attendance
              </CommandItem>
              <CommandItem value="salary advance give worker" onSelect={() => run(() => navigate("/workers?tab=advances"))}>
                <HandCoins /> Give salary advance
              </CommandItem>
              <CommandItem value="add new worker employee" onSelect={() => run(() => navigate("/workers?tab=workers&new=1"))}>
                <UserPlus /> Add worker
              </CommandItem>
              <CommandItem value="material inward stock receive" onSelect={() => run(() => navigate("/inventory?inward=1"))}>
                <PackagePlus /> Material inward
              </CommandItem>
              <CommandItem value="toggle sidebar collapse" onSelect={() => run(toggleSidebar)}>
                <PanelLeft /> Toggle sidebar <Kbd className="ml-auto">{modKeyLabel}B</Kbd>
              </CommandItem>
            </CommandGroup>
            <CommandSeparator />
            <CommandGroup heading="Go to">
              {allNavItems.map((item) => (
                <CommandItem
                  key={item.to}
                  value={`go ${item.label} ${item.keywords?.join(" ") ?? ""}`}
                  onSelect={() => run(() => navigate(item.to))}
                >
                  <item.icon /> {item.label}
                  {item.hotkey && <Kbd className="ml-auto">{modKeyLabel}{item.hotkey}</Kbd>}
                </CommandItem>
              ))}
            </CommandGroup>
            <CommandSeparator />
            <CommandGroup heading="Workers">
              {workers.map((w) => (
                <CommandItem key={w.id} value={`${w.name} ${w.code} ${w.department}`} onSelect={() => run(() => navigate(`/workers?tab=workers&worker=${w.id}`))}>
                  <User /> {w.name}
                  <span className="text-muted-foreground">{w.code} · {w.department}</span>
                </CommandItem>
              ))}
            </CommandGroup>
            <CommandGroup heading="Materials">
              {materials.map((m) => (
                <CommandItem key={m.id} value={`${m.name} ${m.code} ${m.category}`} onSelect={() => run(() => navigate(`/inventory?material=${m.id}`))}>
                  <Package /> {m.name}
                  <span className="text-muted-foreground">{m.code}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </DialogContent>
    </Dialog>
  );
}
