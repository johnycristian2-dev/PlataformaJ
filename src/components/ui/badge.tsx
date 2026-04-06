import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

const badgeVariants = cva(
  'inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2',
  {
    variants: {
      variant: {
        default: 'border-transparent bg-primary text-primary-foreground',
        secondary: 'border-transparent bg-secondary text-secondary-foreground',
        destructive:
          'border-transparent bg-destructive/20 text-destructive border-destructive/30',
        outline: 'border-border text-foreground bg-transparent',
        success:
          'border-transparent bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
        warning:
          'border-transparent bg-amber-500/15 text-amber-400 border-amber-500/30',
        info: 'border-transparent bg-blue-500/15 text-blue-400 border-blue-500/30',
        premium:
          'border-transparent bg-gradient-to-r from-amber-500/20 to-yellow-400/20 text-amber-400 border-amber-500/40',
        muted: 'border-transparent bg-muted text-muted-foreground',
        'primary-subtle':
          'border-transparent bg-primary/15 text-primary border-primary/25',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  },
)

export interface BadgeProps
  extends
    React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props} />
  )
}

export { Badge, badgeVariants }
