import * as React from "react"
import { cn } from "@/lib/utils"

export interface InputProps
  extends React.InputHTMLAttributes<HTMLInputElement> {
  error?: string;
}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, error, ...props }, ref) => {
    return (
      <div className="w-full">
        <input
          type={type}
          className={cn(
            "flex h-12 w-full rounded-xl border border-slate-200 bg-white/60 backdrop-blur-sm px-4 py-2 text-sm text-slate-900 transition-all duration-300 placeholder:text-slate-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/50 focus-visible:border-indigo-500 focus-visible:bg-white hover:border-slate-300 shadow-sm disabled:cursor-not-allowed disabled:opacity-50",
            error ? "border-rose-500 focus-visible:border-rose-500 focus-visible:ring-rose-500/50 bg-rose-50/50" : "",
            className
          )}
          ref={ref}
          {...props}
        />
        {error && <span className="text-xs text-rose-500 mt-1 block px-1">{error}</span>}
      </div>
    )
  }
)
Input.displayName = "Input"

export { Input }
