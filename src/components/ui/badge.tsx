import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

const badgeVariants = cva(
  'inline-flex items-center rounded-[99px] px-[7px] py-[2px] text-[9px] font-bold transition-colors',
  {
    variants: {
      variant: {
        default:     'bg-[#EBF5FF] text-[#7EB8E8]',
        secondary:   'bg-[#F0F0F0] text-[#9A9A9A]',
        destructive: 'bg-[#FDECEA] text-[#D32F2F]',
        outline:     'border border-border text-ink',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  }
)

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />
}

export { Badge, badgeVariants }
