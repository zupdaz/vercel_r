import type { ErrorReport } from "../types"

// In-memory storage for error reports
const errorReports: ErrorReport[] = []

export async function submitErrorReport(report: Omit<ErrorReport, "id" | "timestamp">): Promise<ErrorReport> {
  // Create a new report with ID and timestamp
  const newReport: ErrorReport = {
    ...report,
    id: `error-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    timestamp: new Date(),
  }

  errorReports.push(newReport)

  // In a real implementation, this would send an email via an API
  console.log("Error report submitted:", newReport)

  // Log more details for debugging
  console.log("Error details:", {
    files: report.fileName,
    error: report.errorMessage,
    name: report.userName || "Not provided",
    comments: report.userComments || "Not provided",
    browser: report.browserInfo || navigator.userAgent,
    project: report.projectId,
  })

  // For static export, we'll just log the report and provide a way to download it
  const reportData = JSON.stringify(newReport, null, 2)
  const blob = new Blob([reportData], { type: "application/json" })
  const url = URL.createObjectURL(blob)

  // Create a link to download the report
  const link = document.createElement("a")
  link.href = url
  link.download = `error-report-${newReport.id}.json`

  // Append to the document, click it, and remove it
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)

  return newReport
}

export function getErrorReports(): ErrorReport[] {
  return [...errorReports]
}
