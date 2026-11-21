import * as React from "react";
import { cn } from "@/lib/utils";

export const inputBase =
  "flex h-9 w-full rounded-lg border border-input bg-card px-3 py-1 text-sm text-foreground shadow-xs transition-colors placeholder:text-[#98a2b3] focus-visible:outline-none focus-visible:border-brand-400 focus-visible:ring-3 focus-visible:ring-brand-100 disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-danger aria-invalid:ring-danger-soft";

export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, type = "text", ...props }, ref) => (
    <input ref={ref} type={type} className={cn(inputBase, "tabular", className)} {...props} />
  ),
);
Input.displayName = "Input";

export const Textarea = React.forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement>>(
  ({ className, ...props }, ref) => (
    <textarea ref={ref} className={cn(inputBase, "h-auto min-h-20 py-2", className)} {...props} />
  ),
);
Textarea.displayName = "Textarea";
