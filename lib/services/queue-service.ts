import type { QueueItem } from "../types"

// In-memory queue for demonstration
// In production, this would be persisted in a database
let queue: QueueItem[] = []
let isProcessing = false
const MAX_CONCURRENT_PROCESSING = 1 // Process one file at a time per user
let currentlyProcessing = 0

// Callbacks for UI updates
const subscribers: ((queue: QueueItem[]) => void)[] = []

export function subscribeToQueue(callback: (queue: QueueItem[]) => void) {
  subscribers.push(callback)
  callback([...queue]) // Initial call with current queue
  return () => {
    const index = subscribers.indexOf(callback)
    if (index !== -1) {
      subscribers.splice(index, 1)
    }
  }
}

function notifySubscribers() {
  subscribers.forEach((callback) => callback([...queue]))
}

export function addToQueue(item: Omit<QueueItem, "id" | "status">): QueueItem {
  // Check if a file with the same name and project is already in the queue
  const existingItem = queue.find((qItem) => qItem.fileName === item.fileName && qItem.projectId === item.projectId)

  if (existingItem) {
    // If it's already completed or failed, replace it
    if (existingItem.status === "completed" || existingItem.status === "failed") {
      // Remove the existing item
      queue = queue.filter((qItem) => qItem.id !== existingItem.id)
    } else {
      // If it's queued or processing, return the existing item
      return existingItem
    }
  }

  const newItem: QueueItem = {
    ...item,
    id: `queue-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    status: "queued",
  }

  queue.push(newItem)
  notifySubscribers()
  processQueue()

  return newItem
}

export function getQueueItems(): QueueItem[] {
  return [...queue]
}

export function getQueueItemById(id: string): QueueItem | undefined {
  return queue.find((item) => item.id === id)
}

export function getQueueLength(): number {
  return queue.length
}

export function getQueueStatus(): {
  total: number
  queued: number
  processing: number
  completed: number
  failed: number
} {
  return {
    total: queue.length,
    queued: queue.filter((item) => item.status === "queued").length,
    processing: queue.filter((item) => item.status === "processing").length,
    completed: queue.filter((item) => item.status === "completed").length,
    failed: queue.filter((item) => item.status === "failed").length,
  }
}

export function updateQueueItem(id: string, updates: Partial<QueueItem>): QueueItem | undefined {
  const index = queue.findIndex((item) => item.id === id)
  if (index === -1) return undefined

  // Ensure we're not overriding the status incorrectly
  if (updates.status) {
    // Once an item is failed, it should stay failed unless explicitly reset
    if (queue[index].status === "failed" && updates.status === "completed") {
      console.warn(`Attempted to change status from failed to completed for item: ${id}`)
      delete updates.status
    }
    // Once an item is completed, it shouldn't be marked as failed
    else if (queue[index].status === "completed" && updates.status === "failed") {
      console.warn(`Attempted to set status to failed for a completed item: ${id}`)
      delete updates.status
    }
  }

  queue[index] = { ...queue[index], ...updates }
  notifySubscribers()
  return queue[index]
}

export function clearCompletedItems() {
  queue = queue.filter((item) => item.status !== "completed" && item.status !== "failed")
  notifySubscribers()
}

async function processQueue() {
  if (isProcessing || currentlyProcessing >= MAX_CONCURRENT_PROCESSING) return

  isProcessing = true

  try {
    const nextItem = queue.find((item) => item.status === "queued")
    if (!nextItem) {
      isProcessing = false
      return
    }

    currentlyProcessing++
    updateQueueItem(nextItem.id, { status: "processing", startTime: new Date() })

    // This would be replaced with actual file processing logic
    // For now, we'll simulate processing with a timeout
    await new Promise((resolve) => setTimeout(resolve, 2000))

    // Simulate success (90% of the time)
    if (Math.random() > 0.1) {
      updateQueueItem(nextItem.id, {
        status: "completed",
        endTime: new Date(),
        result: { message: "Processing completed successfully" },
      })
    } else {
      // Simulate failure (10% of the time)
      updateQueueItem(nextItem.id, {
        status: "failed",
        endTime: new Date(),
        error: "Simulated processing error",
      })
    }
  } catch (error) {
    console.error("Error processing queue:", error)
  } finally {
    currentlyProcessing--
    isProcessing = false

    // Continue processing if there are more items
    if (queue.some((item) => item.status === "queued")) {
      processQueue()
    }
  }
}
