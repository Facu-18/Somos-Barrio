import { cn } from '../../lib/utils'

export function Spinner({ className }: { className?: string }) {
  return (
    <div className={cn('flex justify-center items-center py-12', className)}>
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-700" />
    </div>
  )
}
