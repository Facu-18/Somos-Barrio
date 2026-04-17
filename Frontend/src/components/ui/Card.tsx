import type { HTMLAttributes } from 'react'
import { cn } from '../../lib/utils'

export function Card({ className, children, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn('bg-white border border-gray-200 rounded-xl shadow-sm', className)}
      {...props}
    >
      {children}
    </div>
  )
}
