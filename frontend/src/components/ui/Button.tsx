import * as React from "react"
import { cn } from "@/lib/utils"

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'default' | 'outline' | 'ghost' | 'glass' | 'gradient' | 'danger'
  size?: 'default' | 'sm' | 'lg' | 'icon'
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "default", size = "default", ...props }, ref) => {
    
    const baseStyles = "inline-flex items-center justify-center whitespace-nowrap rounded-xl text-sm font-semibold ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 active:scale-95 duration-200"
    
    const variants = {
      default: "bg-slate-900 text-white hover:bg-slate-800 shadow-md",
      outline: "border-2 border-slate-200 bg-transparent hover:bg-slate-50 text-slate-900",
      ghost: "hover:bg-slate-100 hover:text-slate-900 text-slate-600",
      glass: "bg-white/20 backdrop-blur-md border border-white/30 text-slate-900 hover:bg-white/30 shadow-xl",
      gradient: "bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 text-white shadow-lg hover:shadow-indigo-500/25 bg-[length:200%_auto] hover:bg-right transition-all duration-500",
      danger: "bg-rose-500 text-white hover:bg-rose-600 shadow-md hover:shadow-rose-500/20"
    }
    
    const sizes = {
      default: "h-11 px-6 py-2",
      sm: "h-9 rounded-lg px-4",
      lg: "h-14 rounded-2xl px-8 text-base",
      icon: "h-11 w-11",
    }

    return (
      <button
        className={cn(baseStyles, variants[variant], sizes[size], className)}
        ref={ref}
        {...props}
      />
    )
  }
)
Button.displayName = "Button"

export { Button }
