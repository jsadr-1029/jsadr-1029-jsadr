import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "inline-flex items-center justify-center rounded-full border px-2.5 py-0.5 text-xs font-medium w-fit whitespace-nowrap shrink-0 [&>svg]:size-3 gap-1 [&>svg]:pointer-events-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive transition-[color,box-shadow] overflow-hidden backdrop-blur-sm",
  {
    variants: {
      variant: {
        default:
          "border-primary/30 bg-primary/15 text-primary-foreground [a&]:hover:bg-primary/25",
        secondary:
          "border-white/10 bg-white/10 text-secondary-foreground [a&]:hover:bg-white/15",
        destructive:
          "border-destructive/30 bg-destructive/15 text-red-300 [a&]:hover:bg-destructive/25 focus-visible:ring-destructive/20 dark:focus-visible:ring-destructive/40",
        outline:
          "border-white/15 bg-transparent text-foreground [a&]:hover:bg-white/5 [a&]:hover:text-foreground",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

function Badge({
  className,
  variant,
  asChild = false,
  ...props
}: React.ComponentProps<"span"> &
  VariantProps<typeof badgeVariants> & { asChild?: boolean }) {
  const Comp = asChild ? Slot : "span"

  return (
    <Comp
      data-slot="badge"
      className={cn(badgeVariants({ variant }), className)}
      {...props}
    />
  )
}

export { Badge, badgeVariants }
