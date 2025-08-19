export class Logger {
  private logs: string[] = []
  private logCallback: (log: string) => void

  constructor(logCallback: (log: string) => void) {
    this.logCallback = logCallback
  }

  private formatLog(level: string, message: string): string {
    const timestamp = new Date().toISOString()
    return `${timestamp} - ${level} - ${message}`
  }

  debug(message: string): void {
    const log = this.formatLog("DEBUG", message)
    this.logs.push(log)
    this.logCallback(log)
  }

  info(message: string): void {
    const log = this.formatLog("INFO", message)
    this.logs.push(log)
    this.logCallback(log)
  }

  warn(message: string): void {
    const log = this.formatLog("WARN", message)
    this.logs.push(log)
    this.logCallback(log)
  }

  error(message: string, error?: Error): void {
    let log = this.formatLog("ERROR", message)
    if (error) {
      log += `\n${error.stack || error.message}`
    }
    this.logs.push(log)
    this.logCallback(log)
  }

  getAllLogs(): string[] {
    return [...this.logs]
  }
}

export function extractTrial(s: string): [string, string | undefined] {
  if (!s) return [s, undefined]

  // Find the first space or comma
  const spaceIndex = s.indexOf(" ")
  const commaIndex = s.indexOf(",")

  // Get the earliest occurrence of space or comma
  let splitIndex = -1
  if (spaceIndex !== -1 && commaIndex !== -1) {
    splitIndex = Math.min(spaceIndex, commaIndex)
  } else if (spaceIndex !== -1) {
    splitIndex = spaceIndex
  } else if (commaIndex !== -1) {
    splitIndex = commaIndex
  }

  // If no space or comma found, return original string
  if (splitIndex === -1) {
    return [s, undefined]
  }

  // Check if there are at least 4 connected characters before the split
  const beforeSplit = s.substring(0, splitIndex).trim()
  if (beforeSplit.length < 4) {
    return [s, undefined]
  }

  // Split the string
  const shortCode = beforeSplit
  const description = s.substring(splitIndex + 1).trim()

  return [shortCode, description || undefined]
}
