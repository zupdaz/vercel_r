"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import type { QueueItem } from "@/lib/types"
import { subscribeToQueue, clearCompletedItems } from "@/lib/services/queue-service"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Trash2, Loader2 } from "lucide-react"

export default function QueueStatus() {
  const [queueItems, setQueueItems] = useState<QueueItem[]>([])

  useEffect(() => {
    const unsubscribe = subscribeToQueue(setQueueItems)
    return unsubscribe
  }, [])

  const getStatusBadge = (status: QueueItem["status"]) => {
    switch (status) {
      case "processing":
        return (
          <Badge variant="secondary" className="flex items-center gap-1">
            <Loader2 className="h-3 w-3 animate-spin" />
            Processing
          </Badge>
        )
      case "completed":
        return <Badge className="bg-green-100 text-green-800">Completed</Badge>
      case "failed":
        return (
          <Badge variant="destructive" className="font-semibold">
            Failed
          </Badge>
        )
      default:
        return null
    }
  }

  // Add this function to display error details for failed items
  const renderQueueItem = (item: QueueItem) => {
    // Skip queued items
    if (item.status === "queued") return null

    return (
      <div key={item.id} className="flex items-center justify-between p-2 border rounded-md">
        <div className="flex-1 truncate">
          <div className="font-medium truncate">{item.fileName}</div>
          <div className="text-sm text-muted-foreground">{(item.fileSize / 1024).toFixed(2)} KB</div>
          {item.status === "failed" && item.error && (
            <div className="text-xs text-red-500 truncate mt-1" title={item.error}>
              Error: {item.error.length > 50 ? `${item.error.substring(0, 50)}...` : item.error}
            </div>
          )}
        </div>
        <div className="flex items-center gap-2">
          <div>{getStatusBadge(item.status)}</div>
        </div>
      </div>
    )
  }

  const processingCount = queueItems.filter((item) => item.status === "processing").length
  const completedCount = queueItems.filter((item) => item.status === "completed").length
  const failedCount = queueItems.filter((item) => item.status === "failed").length

  // Only show non-queued items
  const visibleItems = queueItems.filter((item) => item.status !== "queued")

  if (visibleItems.length === 0) {
    return null
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="flex items-center gap-2">
          Processing Queue
          {processingCount > 0 && <Loader2 className="h-4 w-4 animate-spin text-primary" />}
        </CardTitle>
        <Button variant="outline" size="sm" onClick={clearCompletedItems} disabled={completedCount + failedCount === 0}>
          <Trash2 className="h-4 w-4 mr-2" />
          Clear Completed
        </Button>
      </CardHeader>
      <CardContent>
        <div className="space-y-2 max-h-[300px] overflow-y-auto">{visibleItems.map(renderQueueItem)}</div>

        {processingCount > 0 && (
          <div className="mt-4 p-2 bg-blue-50 text-blue-800 rounded-md text-sm">
            Files are being processed. Please be patient.
          </div>
        )}
      </CardContent>
    </Card>
  )
}
