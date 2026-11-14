import { cn } from "@/lib/utils"

/** Segmented control: switches a view in place (DESIGN.md › Components). */
export function Segmented<T extends string>({
  options,
  value,
  onChange,
  label,
  size = "default",
  className,
}: {
  options: { value: T; label: string }[]
  value: T
  onChange: (value: T) => void
  /** Accessible name for the group. */
  label: string
  size?: "default" | "sm"
  className?: string
}) {
  return (
    <div
      role="group"
      aria-label={label}
      className={cn(
        "inline-flex max-w-full gap-0.5 overflow-x-auto rounded-full border border-line bg-control-track p-[3px]",
        className
      )}
    >
      {options.map(o => (
        <button
          key={o.value}
          type="button"
          aria-pressed={o.value === value}
          onClick={() => onChange(o.value)}
          className={cn(
            "shrink-0 cursor-pointer rounded-full font-medium whitespace-nowrap",
            size === "sm" ? "h-8 px-3.5 text-[13px]" : "h-[34px] px-[18px] text-sm",
            o.value === value ? "bg-control-thumb text-ink shadow-(--shadow-thumb)" : "text-ink-3"
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}
