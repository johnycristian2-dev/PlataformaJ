import * as React from 'react'
import { cn } from '@/lib/utils'

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  /** Ícone renderizado à esquerda */
  leftIcon?: React.ReactNode
  /** Ícone/elemento renderizado à direita */
  rightIcon?: React.ReactNode
  /** Estado de erro */
  error?: string | boolean
}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, leftIcon, rightIcon, error, ...props }, ref) => {
    const hasError = !!error
    const errorMsg = typeof error === 'string' ? error : undefined

    if (leftIcon || rightIcon) {
      return (
        <div className="w-full">
          <div className="relative flex items-center w-full">
            {leftIcon && (
              <span className="absolute left-3 flex items-center pointer-events-none text-muted-foreground">
                {leftIcon}
              </span>
            )}
            <input
              type={type}
              className={cn(
                'flex h-10 w-full rounded-lg border bg-input px-4 py-2 text-sm',
                'text-foreground placeholder:text-muted-foreground/60',
                'transition-all duration-200',
                'border-border',
                'focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-0 focus:border-transparent',
                'disabled:cursor-not-allowed disabled:opacity-50',
                'file:border-0 file:bg-transparent file:text-sm file:font-medium',
                leftIcon && 'pl-10',
                rightIcon && 'pr-10',
                hasError && 'border-destructive focus:ring-destructive/40',
                className,
              )}
              ref={ref}
              {...props}
            />
            {rightIcon && (
              <span className="absolute right-3 flex items-center text-muted-foreground">
                {rightIcon}
              </span>
            )}
          </div>
          {errorMsg && (
            <p className="mt-1 text-xs text-destructive">{errorMsg}</p>
          )}
        </div>
      )
    }

    return (
      <div className="w-full">
        <input
          type={type}
          className={cn(
            'flex h-10 w-full rounded-lg border bg-input px-4 py-2 text-sm',
            'text-foreground placeholder:text-muted-foreground/60',
            'transition-all duration-200',
            'border-border',
            'focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-0 focus:border-transparent',
            'disabled:cursor-not-allowed disabled:opacity-50',
            'file:border-0 file:bg-transparent file:text-sm file:font-medium',
            hasError && 'border-destructive focus:ring-destructive/40',
            className,
          )}
          ref={ref}
          {...props}
        />
        {errorMsg && (
          <p className="mt-1 text-xs text-destructive">{errorMsg}</p>
        )}
      </div>
    )
  },
)

Input.displayName = 'Input'

export { Input }
