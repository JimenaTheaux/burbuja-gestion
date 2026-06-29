import * as React from 'react'
import { Slot } from '@radix-ui/react-slot'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-[10px] text-[15px] font-semibold transition-all duration-300 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0',
  {
    variants: {
      variant: {
        default:     'bg-primary text-white hover:bg-[#28B99A] active:scale-[0.98]',
        secondary:   'bg-transparent text-primary border-[1.5px] border-primary hover:bg-[rgba(61,214,181,0.06)]',
        destructive: 'bg-[#FDECEA] text-[#D32F2F] border-[1.5px] border-[#D32F2F] hover:bg-[#fcd9d6]',
        ghost:       'hover:bg-[rgba(61,214,181,0.06)] hover:text-primary',
        link:        'text-sky underline-offset-4 hover:underline',
      },
      size: {
        default: 'h-11 px-5 py-3',
        sm:      'h-9 rounded-[8px] px-3 text-sm',
        lg:      'h-12 rounded-[10px] px-8',
        icon:    'h-10 w-10',
      },
    },
    defaultVariants: {
      variant: 'default',
      size:    'default',
    },
  }
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : 'button'
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    )
  }
)
Button.displayName = 'Button'

export { Button, buttonVariants }
