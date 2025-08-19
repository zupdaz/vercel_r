"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"
import { ChevronDown, ChevronUp, FileText, Database, CheckCircle, XCircle } from "lucide-react"
import DataTable from "@/components/data-table"
import { Badge } from "@/components/ui/badge"

interface ProcessedFileResultsProps {
  processedFiles: Array<{
    fileName: string
    result: any
  }>
  onClear: () => void
}

export default function ProcessedFileResults({ processedFiles, onClear }: ProcessedFileResultsProps) {
  const [expandedFile, setExpandedFile] = useState<number | null>(null)
  const [activeTab, setActiveTab] = useState<Record<number, string>>({})

  const toggleExpand = (index: number) => {
    setExpandedFile(expandedFile === index ? null : index)
  }

  const handleTabChange = (index: number, value: string) => {
    setActiveTab((prev) => ({ ...prev, [index]: value }))
  }

  if (processedFiles.length === 0) {
    return null
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Processed Files ({processedFiles.length})</CardTitle>
        <Button variant="outline" size="sm" onClick={onClear}>
          Clear Results
        </Button>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {processedFiles.map((file, index) => (
            <div key={index} className="border rounded-md overflow-hidden">
              <div
                className="flex items-center justify-between p-4 cursor-pointer hover:bg-muted/50"
                onClick={() => toggleExpand(index)}
              >
                <div className="flex items-center">
                  <FileText className="h-5 w-5 mr-2 text-muted-foreground" />
                  <h3 className="font-medium">{file.fileName}</h3>
                </div>
                <div className="flex items-center">
                  <div className="text-sm text-muted-foreground mr-4">
                    {file.result.type === "legacy" && <span>Legacy CSV: {file.result.data.length} rows</span>}
                    {file.result.type === "excel" && (
                      <span>
                        Excel: {file.result.methodData.length} method rows, {file.result.sampleData.length} sample rows
                      </span>
                    )}
                    {file.result.type === "csv" && (
                      <span>
                        CSV: {file.result.dataTable.length} data rows, {file.result.sizeClassTable.length} size class
                        rows
                      </span>
                    )}
                  </div>
                  <div className="flex items-center mr-4">
                    <Database className="h-4 w-4 mr-1" />
                    {file.result.savedToDatabase ? (
                      <Badge variant="outline" className="bg-green-50 text-green-700 flex items-center">
                        <CheckCircle className="h-3 w-3 mr-1" />
                        Saved
                      </Badge>
                    ) : file.result.savedToDatabase === false ? (
                      <Badge variant="outline" className="bg-red-50 text-red-700 flex items-center">
                        <XCircle className="h-3 w-3 mr-1" />
                        Not saved
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="bg-gray-50 text-gray-700 flex items-center">
                        Pending
                      </Badge>
                    )}
                  </div>
                  {expandedFile === index ? (
                    <ChevronUp className="h-5 w-5 text-muted-foreground" />
                  ) : (
                    <ChevronDown className="h-5 w-5 text-muted-foreground" />
                  )}
                </div>
              </div>

              {expandedFile === index && (
                <div className="p-4 border-t">
                  {file.result.type === "legacy" && (
                    <div className="mt-2">
                      <DataTable data={file.result.data} />
                    </div>
                  )}

                  {file.result.type === "excel" && (
                    <Tabs
                      defaultValue="method"
                      value={activeTab[index] || "method"}
                      onValueChange={(value) => handleTabChange(index, value)}
                      className="w-full"
                    >
                      <TabsList className="mb-4">
                        <TabsTrigger value="method">Method Data</TabsTrigger>
                        <TabsTrigger value="sample">Sample & Result Data</TabsTrigger>
                      </TabsList>
                      <TabsContent value="method">
                        <DataTable data={file.result.methodData} />
                      </TabsContent>
                      <TabsContent value="sample">
                        <DataTable data={file.result.sampleData} />
                      </TabsContent>
                    </Tabs>
                  )}

                  {file.result.type === "csv" && (
                    <Tabs
                      defaultValue="dataTable"
                      value={activeTab[index] || "dataTable"}
                      onValueChange={(value) => handleTabChange(index, value)}
                      className="w-full"
                    >
                      <TabsList className="mb-4">
                        <TabsTrigger value="dataTable">Data Table</TabsTrigger>
                        <TabsTrigger value="sizeClass">Size Class Table</TabsTrigger>
                      </TabsList>
                      <TabsContent value="dataTable">
                        <DataTable data={file.result.dataTable} />
                      </TabsContent>
                      <TabsContent value="sizeClass">
                        <DataTable data={file.result.sizeClassTable} />
                      </TabsContent>
                    </Tabs>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
