import * as React from 'react'
import { Slot } from '@radix-ui/react-slot'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

const buttonVariants = cva(
  // Base
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg text-sm font-semibold ring-offset-background transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 active:scale-[0.98]',
  {
    variants: {
      variant: {
        // Primário — gradiente vermelho
        default:
          'bg-primary text-primary-foreground hover:bg-primary/90 shadow-sm btn-glow-red',
        // Gradiente rico
        gradient:
          'bg-gradient-to-r from-red-700 via-red-600 to-red-700 text-white hover:brightness-110 shadow-glow-red btn-glow-red',
        // Destrutivo
        destructive:
          'bg-destructive text-destructive-foreground hover:bg-destructive/90 shadow-sm',
        // Contorno
        outline:
          'border border-border bg-transparent hover:bg-accent hover:text-accent-foreground',
        // Contorno colorido
        'outline-primary':
          'border border-primary/60 bg-transparent text-primary hover:bg-primary/10 hover:border-primary',
        // Suave
        secondary:
          'bg-secondary text-secondary-foreground hover:bg-secondary/80',
        // Ghost
        ghost: 'bg-transparent hover:bg-accent hover:text-accent-foreground',
        // Link
        link: 'text-primary underline-offset-4 hover:underline bg-transparent',
        // Premium (dourado)
        premium:
          'bg-gradient-to-r from-amber-500 via-yellow-400 to-amber-500 text-black font-bold hover:brightness-110 shadow-md',
      },
      size: {
        default: 'h-10 px-5 py-2',
        xs: 'h-7 rounded-md px-3 text-xs',
        sm: 'h-9 rounded-lg px-4',
        lg: 'h-12 rounded-xl px-8 text-base',
        xl: 'h-14 rounded-xl px-10 text-base font-bold',
        icon: 'h-10 w-10 p-0',
        'icon-sm': 'h-8 w-8 p-0',
        'icon-lg': 'h-12 w-12 p-0',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  },
)

export interface ButtonProps
  extends
    React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
  loading?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className,
      variant,
      size,
      asChild = false,
      loading,
      children,
      disabled,
      ...props
    },
    ref,
  ) => {
    const Comp = asChild ? Slot : 'button'

    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        disabled={disabled || loading}
        {...props}
      >
        {loading ? (
          <>
            <svg
              className="animate-spin h-4 w-4"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8v8H4z"
              />
            </svg>
            {children}
          </>
        ) : (
          children
        )}
      </Comp>
    )
  },
)

Button.displayName = 'Button'

export { Button, buttonVariants }
