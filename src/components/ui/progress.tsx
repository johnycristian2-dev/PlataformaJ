import * as React from 'react'
import * as ProgressPrimitive from '@radix-ui/react-progress'
import { cn } from '@/lib/utils'

interface ProgressProps extends React.ComponentPropsWithoutRef<
  typeof ProgressPrimitive.Root
> {
  /** Indica se a barra deve ter gradiente vermelho */
  variant?: 'default' | 'success' | 'warning' | 'premium'
  /** Exibir label de percentual */
  showLabel?: boolean
  /** Tamanho da barra */
  size?: 'sm' | 'md' | 'lg'
}

const Progress = React.forwardRef<
  React.ElementRef<typeof ProgressPrimitive.Root>,
  ProgressProps
>(
  (
    { className, value, variant = 'default', showLabel, size = 'md', ...props },
    ref,
  ) => {
    const heightClass = { sm: 'h-1.5', md: 'h-2.5', lg: 'h-4' }[size]

    const indicatorClass = {
      default: 'bg-gradient-to-r from-primary/90 to-primary',
      success: 'bg-gradient-to-r from-emerald-600 to-emerald-400',
      warning: 'bg-gradient-to-r from-amber-600 to-amber-400',
      premium: 'bg-gradient-to-r from-amber-600 via-yellow-400 to-amber-500',
    }[variant]

    return (
      <div className="w-full">
        <ProgressPrimitive.Root
          ref={ref}
          className={cn(
            'relative w-full overflow-hidden rounded-full bg-secondary',
            heightClass,
            className,
          )}
          {...props}
        >
          <ProgressPrimitive.Indicator
            className={cn(
              'h-full w-full flex-1 transition-all duration-700 ease-out rounded-full',
              indicatorClass,
            )}
            style={{ transform: `translateX(-${100 - (value || 0)}%)` }}
          />
        </ProgressPrimitive.Root>
        {showLabel && (
          <p className="mt-1 text-xs text-muted-foreground text-right">
            {Math.round(value ?? 0)}%
          </p>
        )}
      </div>
    )
  },
)

Progress.displayName = ProgressPrimitive.Root.displayName

export { Progress }
