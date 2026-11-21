import * as React from "react";
import { Command as CommandPrimitive } from "cmdk";
import { Search } from "lucide-react";
import { cn } from "@/lib/utils";

export function Command({ className, ...props }: React.ComponentProps<typeof CommandPrimitive>) {
  return <CommandPrimitive className={cn("flex h-full w-full flex-col overflow-hidden bg-popover", className)} {...props} />;
}

export function CommandInput({ className, ...props }: React.ComponentProps<typeof CommandPrimitive.Input>) {
  return (
    <div className="flex items-center gap-2 border-b border-border px-4">
      <Search className="size-4 shrink-0 text-muted-foreground" />
      <CommandPrimitive.Input
        className={cn("flex h-12 w-full bg-transparent text-sm outline-none placeholder:text-[#98a2b3]", className)}
        {...props}
      />
    </div>
  );
}

export const CommandList = ({ className, ...p }: React.ComponentProps<typeof CommandPrimitive.List>) => (
  <CommandPrimitive.List className={cn("max-h-[360px] overflow-y-auto overflow-x-hidden p-1.5", className)} {...p} />
);
export const CommandEmpty = (p: React.ComponentProps<typeof CommandPrimitive.Empty>) => (
  <CommandPrimitive.Empty className="py-8 text-center text-sm text-muted-foreground" {...p} />
);
export const CommandGroup = ({ className, ...p }: React.ComponentProps<typeof CommandPrimitive.Group>) => (
  <CommandPrimitive.Group
    className={cn("[&_[cmdk-group-heading]]:px-2.5 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-xs [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:text-muted-foreground", className)}
    {...p}
  />
);
export const CommandItem = ({ className, ...p }: React.ComponentProps<typeof CommandPrimitive.Item>) => (
  <CommandPrimitive.Item
    className={cn(
      "relative flex cursor-default items-center gap-2.5 rounded-md px-2.5 py-2 text-sm outline-none select-none data-[selected=true]:bg-brand-50 data-[selected=true]:text-brand-800 [&_svg]:size-4 [&_svg]:text-muted-foreground data-[selected=true]:[&_svg]:text-brand-600",
      className,
    )}
    {...p}
  />
);
export const CommandSeparator = (p: React.ComponentProps<typeof CommandPrimitive.Separator>) => (
  <CommandPrimitive.Separator className="-mx-1.5 my-1 h-px bg-border" {...p} />
);
