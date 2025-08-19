"use client"

import { useState } from "react"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { Download, ChevronLeft, ChevronRight } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

interface ResultsViewerProps {
  data: any
}

export default function ResultsViewer({ data }: ResultsViewerProps) {
  const [page, setPage] = useState(1)
  const [rowsPerPage, setRowsPerPage] = useState(10)
  const [searchTerm, setSearchTerm] = useState("")

  // Handle different data structures
  const methodData = data.methodData || []
  const sampleData = data.sampleData || []
  const csvData = Array.isArray(data) ? data : []

  const hasMultipleTables = methodData.length > 0 || sampleData.length > 0

  // Function to rename column headers for display
  const renameColumnHeader = (header: string) => {
    // Map replicate to vessel_no in the UI
    if (header === "replicate") return "vessel_no"
    return header
  }

  const renderTable = (tableData: any[]) => {
    if (!tableData || tableData.length === 0) {
      return <div className="text-center py-4">No data available</div>
    }

    // Filter data based on search term
    const filteredData = searchTerm
      ? tableData.filter((row) =>
          Object.values(row).some((value) => String(value).toLowerCase().includes(searchTerm.toLowerCase())),
        )
      : tableData

    const columns = Object.keys(tableData[0] || {})
    const totalPages = Math.ceil(filteredData.length / rowsPerPage)
    const startIndex = (page - 1) * rowsPerPage
    const visibleData = filteredData.slice(startIndex, startIndex + rowsPerPage)

    return (
      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <div className="text-sm text-muted-foreground">
            Showing {filteredData.length > 0 ? startIndex + 1 : 0}-
            {Math.min(startIndex + rowsPerPage, filteredData.length)} of {filteredData.length} rows
          </div>
          <Button variant="outline" size="sm" onClick={() => downloadCSV(tableData)}>
            <Download className="h-4 w-4 mr-2" />
            Download CSV
          </Button>
        </div>

        <div className="border rounded-md overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                {columns.map((column) => (
                  <TableHead key={column}>{renameColumnHeader(column)}</TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {visibleData.map((row, rowIndex) => (
                <TableRow key={rowIndex}>
                  {columns.map((column) => (
                    <TableCell key={`${rowIndex}-${column}`}>{row[column]?.toString() || ""}</TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
            >
              <ChevronLeft className="h-4 w-4" />
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages || totalPages === 0}
            >
              Next
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
          <div className="flex items-center space-x-2">
            <span className="text-sm text-muted-foreground">Rows per page:</span>
            <select
              value={rowsPerPage}
              onChange={(e) => {
                setRowsPerPage(Number(e.target.value))
                setPage(1)
              }}
              className="h-8 w-16 rounded-md border border-input bg-background px-2"
            >
              <option value={10}>10</option>
              <option value={25}>25</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
            </select>
          </div>
        </div>
      </div>
    )
  }

  const downloadCSV = (tableData: any[]) => {
    if (!tableData || tableData.length === 0) return

    const columns = Object.keys(tableData[0])

    // Rename columns for the CSV export
    const renamedColumns = columns.map((col) => (col === "replicate" ? "vessel_no" : col))

    const csvContent = [
      renamedColumns.join(","),
      ...tableData.map((row) =>
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
    link.setAttribute("download", "parsed_data.csv")
    link.style.visibility = "hidden"
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center">
        <Input
          placeholder="Search results..."
          value={searchTerm}
          onChange={(e) => {
            setSearchTerm(e.target.value)
            setPage(1)
          }}
          className="max-w-sm"
        />
      </div>

      {hasMultipleTables ? (
        <Tabs defaultValue="method">
          <TabsList>
            <TabsTrigger value="method" disabled={methodData.length === 0}>
              Method Data
            </TabsTrigger>
            <TabsTrigger value="sample" disabled={sampleData.length === 0}>
              Sample Data
            </TabsTrigger>
          </TabsList>
          <TabsContent value="method">
            <Card>
              <CardHeader>
                <CardTitle>Method Data</CardTitle>
              </CardHeader>
              <CardContent>{renderTable(methodData)}</CardContent>
            </Card>
          </TabsContent>
          <TabsContent value="sample">
            <Card>
              <CardHeader>
                <CardTitle>Sample Data</CardTitle>
              </CardHeader>
              <CardContent>{renderTable(sampleData)}</CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Parsed Data</CardTitle>
          </CardHeader>
          <CardContent>{renderTable(csvData)}</CardContent>
        </Card>
      )}
    </div>
  )
}
