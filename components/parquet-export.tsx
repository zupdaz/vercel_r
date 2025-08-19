"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Download, Database, Loader2 } from "lucide-react"
import { useToast } from "@/hooks/use-toast"

export default function ParquetExport() {
  const [isExporting, setIsExporting] = useState<string | null>(null)
  const { toast } = useToast()

  const exportParquetFiles = async (dataType: "dissolution" | "particle") => {
    setIsExporting(dataType)

    try {
      const response = await fetch(`/api/export-parquet?type=${dataType}`, {
        method: "GET",
      })

      if (!response.ok) {
        throw new Error(`Failed to export ${dataType} data`)
      }

      const data = await response.json()

      if (data.error) {
        throw new Error(data.error)
      }

      // Download each file separately
      data.files.forEach((file: { name: string; content: string }) => {
        const blob = new Blob([file.content], { type: "text/csv" })
        const url = URL.createObjectURL(blob)
        const link = document.createElement("a")
        link.href = url
        link.download = file.name
        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)
        URL.revokeObjectURL(url)
      })

      toast({
        title: "Export Successful",
        description: `${dataType === "dissolution" ? "Dissolution" : "Particle Size"} CSV files downloaded successfully.`,
      })
    } catch (error) {
      console.error(`Error exporting ${dataType} data:`, error)
      toast({
        title: "Export Failed",
        description: `Failed to export ${dataType} data. Please try again.`,
        variant: "destructive",
      })
    } finally {
      setIsExporting(null)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Database className="h-5 w-5" />
          Export CSV Files
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <h3 className="font-medium">Dissolution Data</h3>
            <p className="text-sm text-muted-foreground">
              Export dissolution_method and dissolution_sample tables as separate CSV files
            </p>
            <Button
              onClick={() => exportParquetFiles("dissolution")}
              disabled={isExporting !== null}
              className="w-full"
            >
              {isExporting === "dissolution" ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Exporting...
                </>
              ) : (
                <>
                  <Download className="h-4 w-4 mr-2" />
                  Export Dissolution
                </>
              )}
            </Button>
          </div>

          <div className="space-y-2">
            <h3 className="font-medium">Particle Size Data</h3>
            <p className="text-sm text-muted-foreground">
              Export particle_size_class and particle_metadata tables as separate CSV files
            </p>
            <Button onClick={() => exportParquetFiles("particle")} disabled={isExporting !== null} className="w-full">
              {isExporting === "particle" ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Exporting...
                </>
              ) : (
                <>
                  <Download className="h-4 w-4 mr-2" />
                  Export Particle Size
                </>
              )}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
