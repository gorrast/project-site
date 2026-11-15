import * as React from "react"

import { cn } from "@/lib/utils"

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        // outline-hidden: focus shows as the accent border (DESIGN.md › Field)
        "flex h-10 w-full min-w-0 rounded-[10px] border border-line-strong bg-page px-3.5 text-sm text-ink outline-hidden transition-[border-color] duration-150 placeholder:text-ink-3 focus-visible:border-accent disabled:pointer-events-none disabled:border-line disabled:text-ink-3 aria-invalid:border-neg",
        className
      )}
      {...props}
    />
  )
}

export { Input }
