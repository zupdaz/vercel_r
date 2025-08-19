import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

// Helper function to download data as CSV
export function downloadAsCSV(data: any[], filename = "download.csv") {
  if (!data || !data.length) return

  const columns = Object.keys(data[0])
  const csvContent = [
    columns.join(","),
    ...data.map((row) =>
      columns
        .map((col) => {
          const value = row[col]
          return typeof value === "string" && value.includes(",") ? `"${value}"` : value
        })
        .join(","),
    ),
  ].join("\n")

  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" })
  const url = URL.createObjectURL(blob)
  const link = document.createElement("a")
  link.setAttribute("href", url)
  link.setAttribute("download", filename)
  link.style.visibility = "hidden"
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
}

// Helper function to format date and time
export function formatDateTime(date: Date): string {
  return date.toLocaleString("en-US", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  })
}

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
