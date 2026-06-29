import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { X } from 'lucide-react'
import { cn } from '@/lib/utils'

const toastVariants = cva(
  'group pointer-events-auto relative flex w-full items-center justify-between space-x-4 overflow-hidden rounded-[12px] border p-4 pr-8 shadow-lg transition-all',
  {
    variants: {
      variant: {
        default:     'bg-white border-border text-ink',
        destructive: 'bg-[#FDECEA] border-[#D32F2F] text-[#D32F2F]',
        success:     'bg-[#E8F8F0] border-[#2E9E5C] text-[#2E9E5C]',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  }
)

type ToastProps = React.HTMLAttributes<HTMLDivElement> &
  VariantProps<typeof toastVariants> & {
    onClose?: () => void
  }

const Toast = React.forwardRef<HTMLDivElement, ToastProps>(
  ({ className, variant, children, onClose, ...props }, ref) => (
    <div ref={ref} className={cn(toastVariants({ variant }), className)} {...props}>
      <div className="flex-1 text-sm font-medium">{children}</div>
      {onClose && (
        <button
          onClick={onClose}
          className="absolute right-2 top-2 rounded-md p-1 opacity-70 hover:opacity-100 transition-opacity"
        >
          <X className="h-4 w-4" />
        </button>
      )}
    </div>
  )
)
Toast.displayName = 'Toast'

export { Toast, toastVariants }
