import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva } from "class-variance-authority";

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "press inline-flex max-w-full min-w-0 items-center justify-center gap-2 whitespace-nowrap rounded-pill text-body font-semibold transition-[color,background-color,border-color,transform] duration-150 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:bg-surface-2 disabled:text-tertiary disabled:opacity-100 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default:
          "bg-primary text-primary-foreground hover:bg-primary/90",
        destructive:
          "bg-blank/20 text-blank hover:bg-blank/20",
        shaky:
          "bg-shaky/12 text-shaky hover:bg-shaky/20",
        success:
          "bg-know/20 text-know hover:bg-know/20",
        outline:
          "border border-border bg-transparent text-foreground hover:bg-surface-2",
        secondary:
          "bg-surface-2 text-foreground hover:bg-surface-2/80",
        ghost: "bg-transparent text-foreground hover:bg-surface-2",
        link: "h-auto bg-transparent p-0 text-primary underline-offset-4 hover:underline",
      },
      size: {
        default: "h-action px-6",
        sm: "h-8 px-3 text-meta",
        lg: "h-action px-8",
        icon: "h-tap w-tap",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

const Button = React.forwardRef(({ className, variant, size, asChild = false, ...props }, ref) => {
  const Comp = asChild ? Slot : "button"
  return (
    (<Comp
      className={cn(buttonVariants({ variant, size, className }))}
      ref={ref}
      {...props} />)
  );
})
Button.displayName = "Button"

export { Button, buttonVariants }
