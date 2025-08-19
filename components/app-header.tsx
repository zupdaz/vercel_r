import { cn } from "@/lib/utils"

interface AppHeaderProps {
  className?: string
}

export default function AppHeader({ className }: AppHeaderProps) {
  return (
    <header className={cn("bg-white border-b border-gray-200 py-3 px-6", className)}>
      <div className="container mx-auto flex items-center justify-between">
        <div className="flex items-center gap-4">
          <h1 className="text-2xl font-bold text-[#00ab4d]">RAPTOR</h1>
        </div>
        <div className="text-sm text-gray-500">Research and Analysis Platform</div>
      </div>
    </header>
  )
}
