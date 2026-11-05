import * as React from "react"

import { cn } from "@/lib/utils"

const Input = React.forwardRef(({ className, type, ...props }, ref) => {
  return (
    (<input
      type={type}
      className={cn(
        "flex h-action w-full rounded-input border border-border bg-surface-2 px-4 text-body text-foreground transition-[border-color,box-shadow] duration-150 ease-out file:border-0 file:bg-transparent file:text-meta file:font-medium file:text-foreground placeholder:text-placeholder placeholder:text-tertiary focus-visible:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:cursor-not-allowed disabled:bg-surface-2 disabled:text-tertiary",
        className
      )}
      ref={ref}
      {...props} />)
  );
})
Input.displayName = "Input"

export { Input }
