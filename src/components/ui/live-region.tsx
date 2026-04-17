import * as React from "react";

import { cn } from "@/lib/cn";

interface LiveRegionProps extends React.HTMLAttributes<HTMLDivElement> {
  politeness?: "polite" | "assertive" | "off";
}

export function LiveRegion({
  politeness = "polite",
  className,
  ...props
}: LiveRegionProps) {
  return (
    <div
      role="status"
      aria-live={politeness}
      aria-atomic="true"
      className={cn("sr-only", className)}
      {...props}
    />
  );
}
