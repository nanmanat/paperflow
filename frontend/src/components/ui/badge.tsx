import * as React from 'react'
import { cn } from '@/lib/utils'

interface BadgeProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'secondary' | 'success' | 'destructive' | 'purple' | 'outline'
}

export function Badge({ className, variant = 'default', ...props }: BadgeProps) {
  return (
    <div className={cn(
      'inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors',
      {
        default: 'border-transparent bg-primary text-primary-foreground',
        secondary: 'border-transparent bg-secondary text-secondary-foreground',
        success: 'border-transparent bg-green-500/20 text-green-400 border-green-500/30',
        destructive: 'border-transparent bg-destructive/20 text-red-400',
        purple: 'border-transparent bg-purple-500/20 text-purple-400 border-purple-500/30',
        outline: 'text-foreground',
      }[variant],
      className
    )} {...props} />
  )
}
