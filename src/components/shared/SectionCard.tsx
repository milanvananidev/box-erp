import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

/** Dashboard-style card: title, optional subtitle, "View all →" link or custom actions. */
export function SectionCard({
  title,
  description,
  viewAllHref,
  actions,
  className,
  contentClassName,
  children,
}: {
  title: string;
  description?: string;
  viewAllHref?: string;
  actions?: React.ReactNode;
  className?: string;
  contentClassName?: string;
  children: React.ReactNode;
}) {
  return (
    <Card className={cn("flex flex-col", className)}>
      <CardHeader>
        <div className="min-w-0">
          <CardTitle>{title}</CardTitle>
          {description && <CardDescription className="mt-0.5">{description}</CardDescription>}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {actions}
          {viewAllHref && (
            <Link
              to={viewAllHref}
              className="inline-flex items-center gap-1 rounded text-sm font-medium text-brand-600 hover:text-brand-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
            >
              View All <ArrowRight className="size-3.5" />
            </Link>
          )}
        </div>
      </CardHeader>
      <CardContent className={cn("flex-1", contentClassName)}>{children}</CardContent>
    </Card>
  );
}
