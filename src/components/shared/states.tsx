import type { LucideIcon } from "lucide-react";
import { AlertTriangle, Inbox, Loader2, RotateCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

export function PageLoader() {
  return (
    <div className="flex h-[60vh] items-center justify-center text-muted-foreground">
      <Loader2 className="size-6 animate-spin" />
    </div>
  );
}

export function EmptyState({
  icon: Icon = Inbox,
  title,
  description,
  action,
  className,
  compact,
}: {
  icon?: LucideIcon;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
  compact?: boolean;
}) {
  return (
    <div className={cn("flex flex-col items-center justify-center text-center", compact ? "gap-2 py-8" : "gap-3 py-16", className)}>
      <div className="flex size-12 items-center justify-center rounded-2xl bg-brand-50 text-brand-600">
        <Icon className="size-6" strokeWidth={1.75} />
      </div>
      <div className="space-y-1">
        <p className="text-[15px] font-semibold">{title}</p>
        {description && <p className="mx-auto max-w-sm text-sm text-muted-foreground">{description}</p>}
      </div>
      {action}
    </div>
  );
}

export function ErrorState({
  title = "Couldn't load this data",
  error,
  onRetry,
  className,
  compact,
}: {
  title?: string;
  error?: unknown;
  onRetry?: () => void;
  className?: string;
  compact?: boolean;
}) {
  const message = error instanceof Error ? error.message : undefined;
  return (
    <div className={cn("flex flex-col items-center justify-center gap-3 text-center", compact ? "py-8" : "py-16", className)}>
      <div className="flex size-12 items-center justify-center rounded-2xl bg-danger-soft text-danger-foreground">
        <AlertTriangle className="size-6" strokeWidth={1.75} />
      </div>
      <div className="space-y-1">
        <p className="text-[15px] font-semibold">{title}</p>
        {message && <p className="mx-auto max-w-sm text-sm text-muted-foreground">{message}</p>}
      </div>
      {onRetry && (
        <Button variant="outline" size="sm" onClick={onRetry}>
          <RotateCw /> Try again
        </Button>
      )}
    </div>
  );
}

export function RowsSkeleton({ rows = 3, className }: { rows?: number; className?: string }) {
  return (
    <div className={cn("space-y-3", className)}>
      {Array.from({ length: rows }).map((_, i) => (
        <Skeleton key={i} className="h-9 w-full" />
      ))}
    </div>
  );
}
