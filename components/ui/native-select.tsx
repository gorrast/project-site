import { ChevronDown } from "lucide-react"

import { cn } from "@/lib/utils"

/** Native select styled as a field (forms) or a pill (filters). DESIGN.md › Select. */
export function NativeSelect({
  variant = "field",
  className,
  ...props
}: React.ComponentProps<"select"> & { variant?: "field" | "pill" }) {
  return (
    <div className={cn("relative min-w-0", className)}>
      <select
        {...props}
        className={cn(
          "w-full cursor-pointer appearance-none border border-line-strong pr-9 pl-3.5 text-ink outline-hidden focus-visible:border-accent disabled:cursor-default disabled:border-line disabled:text-ink-3",
          variant === "field"
            ? "h-10 rounded-[10px] bg-page text-sm"
            : "h-[38px] rounded-full bg-surface text-[13px] font-medium"
        )}
      />
      <ChevronDown className="pointer-events-none absolute top-1/2 right-3 size-3.5 -translate-y-1/2 text-ink-3" />
    </div>
  )
}
