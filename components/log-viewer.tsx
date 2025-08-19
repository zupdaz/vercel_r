"use client"

import { useEffect, useRef, useState } from "react"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Button } from "@/components/ui/button"
import { ChevronDown, ChevronUp } from "lucide-react"

interface LogViewerProps {
  logs: string[]
}

export default function LogViewer({ logs }: LogViewerProps) {
  const scrollAreaRef = useRef<HTMLDivElement>(null)
  const [expanded, setExpanded] = useState(false)

  useEffect(() => {
    if (scrollAreaRef.current && expanded) {
      scrollAreaRef.current.scrollTop = scrollAreaRef.current.scrollHeight
    }
  }, [logs, expanded])

  const toggleExpanded = () => {
    setExpanded(!expanded)
  }

  return (
    <div className="border rounded-md bg-slate-50">
      <div
        className="p-2 flex justify-between items-center cursor-pointer hover:bg-slate-100 border-b"
        onClick={toggleExpanded}
      >
        <div className="text-sm text-muted-foreground font-mono">System Logs ({logs.length} entries)</div>
        <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
          {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </Button>
      </div>

      {expanded && (
        <ScrollArea className="h-[300px] bg-black text-white font-mono text-sm p-4" ref={scrollAreaRef}>
          {logs.map((log, index) => {
            // Color-code log levels
            let className = "whitespace-pre-wrap break-all"
            if (log.includes("ERROR")) className += " text-red-400"
            if (log.includes("WARN")) className += " text-yellow-400"
            if (log.includes("INFO")) className += " text-blue-400"
            if (log.includes("DEBUG")) className += " text-green-400"

            return (
              <div key={index} className={className}>
                {log}
              </div>
            )
          })}
        </ScrollArea>
      )}
    </div>
  )
}
