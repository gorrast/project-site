import { Button as ButtonPrimitive } from "@base-ui/react/button"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

// DESIGN.md › Components. Every button presses in; only the primary grows on hover.
// Each variant sets its own border colour so buttonVariants() is safe without cn().
const buttonVariants = cva(
  "group/button inline-flex shrink-0 cursor-pointer items-center justify-center rounded-full border text-sm font-medium whitespace-nowrap select-none [transition:scale_260ms_var(--ease-calm),background-color_160ms,color_160ms,border-color_160ms] motion-safe:active:scale-[0.965] disabled:pointer-events-none disabled:border-line disabled:bg-transparent disabled:text-ink-3 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default:
          "border-transparent bg-accent font-semibold text-accent-ink hover:bg-[color-mix(in_srgb,var(--accent)_86%,var(--ink))] motion-safe:hover:scale-[1.035]",
        secondary: "border-line-strong bg-surface-2 text-ink hover:bg-surface-3",
        outline:
          "border-line-strong text-ink-2 hover:bg-surface-2 hover:text-ink",
        ghost: "border-transparent text-ink-2 hover:bg-surface-2 hover:text-ink",
      },
      size: {
        default: "h-10 gap-2 px-5",
        sm: "h-8 gap-1.5 px-3.5 text-[13px]",
        xs: "h-6 gap-1 px-2.5 text-xs [&_svg:not([class*='size-'])]:size-3",
        icon: "size-9",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

function Button({
  className,
  variant = "default",
  size = "default",
  ...props
}: ButtonPrimitive.Props & VariantProps<typeof buttonVariants>) {
  return (
    <ButtonPrimitive
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Button, buttonVariants }
