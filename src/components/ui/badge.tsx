import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/cn";

const badgeVariants = cva(
  "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium leading-4 whitespace-nowrap",
  {
    variants: {
      variant: {
        default: "bg-secondary text-secondary-foreground",
        success:
          "bg-[color-mix(in_oklch,var(--success)_20%,transparent)] text-success-foreground dark:text-[var(--success)]",
        warning:
          "bg-[color-mix(in_oklch,var(--warning)_20%,transparent)] text-warning-foreground dark:text-[var(--warning)]",
        danger:
          "bg-[color-mix(in_oklch,var(--danger)_20%,transparent)] text-[var(--danger)]",
        info:
          "bg-[color-mix(in_oklch,var(--info)_20%,transparent)] text-info-foreground dark:text-[var(--info)]",
        muted: "bg-muted text-muted-foreground",
        outline: "border border-border text-foreground",
      },
    },
    defaultVariants: { variant: "default" },
  },
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

export function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <span className={cn(badgeVariants({ variant }), className)} {...props} />
  );
}
