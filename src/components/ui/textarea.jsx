import * as React from "react"

import { cn } from "@/lib/utils"

const Textarea = React.forwardRef(({ className, ...props }, ref) => {
  return (
    (<textarea
      className={cn(
        "flex min-h-32 w-full rounded-input border border-border bg-surface-2 px-4 py-4 text-body text-foreground transition-[border-color,box-shadow] duration-150 ease-out placeholder:text-placeholder placeholder:text-tertiary focus-visible:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:cursor-not-allowed disabled:bg-surface-2 disabled:text-tertiary",
        className
      )}
      ref={ref}
      {...props} />)
  );
})
Textarea.displayName = "Textarea"

export { Textarea }
