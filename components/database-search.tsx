"use client"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Checkbox } from "@/components/ui/checkbox"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Trash2, Search, Database } from "lucide-react"
import { getSupabaseClient } from "@/lib/services/supabase-service"
import { Alert, AlertDescription } from "@/components/ui/alert"

interface UploadedFile {
  file_name: string
  project_id: string
  record_count: number
  upload_date?: string
  data_type: "dissolution" | "particle_size"
  unique_id: string
}

export default function DatabaseSearch() {
  const [dataType, setDataType] = useState<"dissolution" | "particle_size" | "">("")
  const [searchText, setSearchText] = useState("")
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([])
  const [selectedFiles, setSelectedFiles] = useState<string[]>([])
  const [loading, setLoading] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null)

  const filteredFiles = uploadedFiles.filter(
    (file) =>
      file.file_name.toLowerCase().includes(searchText.toLowerCase()) ||
      file.project_id.toLowerCase().includes(searchText.toLowerCase()),
  )

  const fetchUploadedFiles = async (type: "dissolution" | "particle_size") => {
    setLoading(true)
    setMessage(null)

    try {
      const supabase = getSupabaseClient()

      if (type === "dissolution") {
        // Query dissolution tables
        const { data: methodData, error: methodError } = await supabase
          .from("dissolution_method")
          .select("file_name, project_id")
          .order("file_name")

        if (methodError) throw methodError

        const fileMap = new Map<string, { project_id: string; count: number }>()
        methodData?.forEach((row) => {
          const key = `${row.file_name}_${row.project_id}`
          if (fileMap.has(key)) {
            fileMap.get(key)!.count++
          } else {
            fileMap.set(key, { project_id: row.project_id, count: 1 })
          }
        })

        const files: UploadedFile[] = Array.from(fileMap.entries()).map(([key, data]) => {
          const fileName = key.substring(0, key.lastIndexOf("_"))
          return {
            file_name: fileName,
            project_id: data.project_id,
            record_count: data.count,
            data_type: "dissolution" as const,
            unique_id: key,
          }
        })

        setUploadedFiles(files)
      } else {
        // Query particle size tables
        const { data: metadataData, error: metadataError } = await supabase
          .from("particle_metadata")
          .select("file_name, project_id")
          .order("file_name")

        if (metadataError) throw metadataError

        const fileMap = new Map<string, { project_id: string; count: number }>()
        metadataData?.forEach((row) => {
          const key = `${row.file_name}_${row.project_id}`
          if (fileMap.has(key)) {
            fileMap.get(key)!.count++
          } else {
            fileMap.set(key, { project_id: row.project_id, count: 1 })
          }
        })

        const files: UploadedFile[] = Array.from(fileMap.entries()).map(([key, data]) => {
          const fileName = key.substring(0, key.lastIndexOf("_"))
          return {
            file_name: fileName,
            project_id: data.project_id,
            record_count: data.count,
            data_type: "particle_size" as const,
            unique_id: key,
          }
        })

        setUploadedFiles(files)
      }
    } catch (error) {
      console.error("Error fetching uploaded files:", error)
      setMessage({
        type: "error",
        text: `Failed to fetch files: ${error instanceof Error ? error.message : String(error)}`,
      })
    } finally {
      setLoading(false)
    }
  }

  const handleDataTypeChange = (value: string) => {
    setDataType(value as "dissolution" | "particle_size" | "")
    setSelectedFiles([])
    setUploadedFiles([])
    setMessage(null)
    setSearchText("")

    if (value && value !== "") {
      fetchUploadedFiles(value as "dissolution" | "particle_size")
    }
  }

  const handleFileSelection = (uniqueId: string, checked: boolean) => {
    if (checked) {
      setSelectedFiles((prev) => [...prev, uniqueId])
    } else {
      setSelectedFiles((prev) => prev.filter((f) => f !== uniqueId))
    }
  }

  const handleSelectAll = () => {
    const filteredUniqueIds = filteredFiles.map((f) => f.unique_id)
    if (
      selectedFiles.length === filteredUniqueIds.length &&
      filteredUniqueIds.every((id) => selectedFiles.includes(id))
    ) {
      setSelectedFiles([])
    } else {
      setSelectedFiles(filteredUniqueIds)
    }
  }

  const deleteSelectedFiles = async () => {
    if (selectedFiles.length === 0) return

    setDeleting(true)
    setMessage(null)

    try {
      const supabase = getSupabaseClient()
      let totalDeleted = 0

      for (const uniqueId of selectedFiles) {
        const fileInfo = uploadedFiles.find((f) => f.unique_id === uniqueId)
        if (!fileInfo) continue

        if (dataType === "dissolution") {
          // Delete from both dissolution tables
          const { error: methodError } = await supabase
            .from("dissolution_method")
            .delete()
            .eq("file_name", fileInfo.file_name)
            .eq("project_id", fileInfo.project_id)

          if (methodError) throw methodError

          const { error: sampleError } = await supabase
            .from("dissolution_sample")
            .delete()
            .eq("file_name", fileInfo.file_name)
            .eq("project_id", fileInfo.project_id)

          if (sampleError) throw sampleError
        } else {
          // Delete from both particle size tables
          const { error: metadataError } = await supabase
            .from("particle_metadata")
            .delete()
            .eq("file_name", fileInfo.file_name)
            .eq("project_id", fileInfo.project_id)

          if (metadataError) throw metadataError

          const { error: sizeClassError } = await supabase
            .from("particle_size_class")
            .delete()
            .eq("file_name", fileInfo.file_name)
            .eq("project_id", fileInfo.project_id)

          if (sizeClassError) throw sizeClassError
        }

        totalDeleted++
      }

      setMessage({
        type: "success",
        text: `Successfully deleted ${totalDeleted} file(s) and all associated records`,
      })

      // Refresh the file list
      if (dataType) {
        await fetchUploadedFiles(dataType)
      }
      setSelectedFiles([])
    } catch (error) {
      console.error("Error deleting files:", error)
      setMessage({
        type: "error",
        text: `Failed to delete files: ${error instanceof Error ? error.message : String(error)}`,
      })
    } finally {
      setDeleting(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Database className="h-5 w-5" />
          Database Search & Management
        </CardTitle>
        <CardDescription>
          Search and manage uploaded files in the database. Filter by data type to see which files have been uploaded
          and delete selected files if needed.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Data Type Filter */}
        <div className="flex items-center gap-4">
          <label className="text-sm font-medium">Data Type:</label>
          <Select value={dataType} onValueChange={handleDataTypeChange}>
            <SelectTrigger className="w-48">
              <SelectValue placeholder="Select data type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="dissolution">Dissolution</SelectItem>
              <SelectItem value="particle_size">Particle Size</SelectItem>
            </SelectContent>
          </Select>
          {dataType && (
            <Button variant="outline" size="sm" onClick={() => fetchUploadedFiles(dataType)} disabled={loading}>
              <Search className="h-4 w-4 mr-2" />
              Refresh
            </Button>
          )}
        </div>

        {dataType && uploadedFiles.length > 0 && (
          <div className="flex items-center gap-4">
            <label className="text-sm font-medium">Search:</label>
            <Input
              placeholder="Search by file name or project ID..."
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              className="max-w-md"
            />
          </div>
        )}

        {/* Message Display */}
        {message && (
          <Alert variant={message.type === "error" ? "destructive" : "default"}>
            <AlertDescription>{message.text}</AlertDescription>
          </Alert>
        )}

        {/* Loading State */}
        {loading && (
          <div className="text-center py-4">
            <p className="text-sm text-muted-foreground">Loading uploaded files...</p>
          </div>
        )}

        {/* File List */}
        {!loading && filteredFiles.length > 0 && (
          <div className="space-y-4">
            {/* Selection Controls */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <Button variant="outline" size="sm" onClick={handleSelectAll}>
                  {selectedFiles.length === filteredFiles.length &&
                  filteredFiles.every((f) => selectedFiles.includes(f.unique_id))
                    ? "Deselect All"
                    : "Select All"}
                </Button>
                <span className="text-sm text-muted-foreground">
                  {selectedFiles.length} of {filteredFiles.length} files selected
                  {searchText && ` (${uploadedFiles.length} total)`}
                </span>
              </div>
              {selectedFiles.length > 0 && (
                <Button variant="destructive" size="sm" onClick={deleteSelectedFiles} disabled={deleting}>
                  <Trash2 className="h-4 w-4 mr-2" />
                  {deleting ? "Deleting..." : `Delete Selected (${selectedFiles.length})`}
                </Button>
              )}
            </div>

            {/* File List */}
            <div className="border rounded-lg">
              <div className="grid grid-cols-12 gap-4 p-3 border-b bg-muted/50 text-sm font-medium">
                <div className="col-span-1">Select</div>
                <div className="col-span-5">File Name</div>
                <div className="col-span-3">Project ID</div>
                <div className="col-span-2">Records</div>
                <div className="col-span-1">Type</div>
              </div>
              {filteredFiles.map((file) => (
                <div
                  key={file.unique_id}
                  className="grid grid-cols-12 gap-4 p-3 border-b last:border-b-0 hover:bg-muted/25"
                >
                  <div className="col-span-1">
                    <Checkbox
                      checked={selectedFiles.includes(file.unique_id)}
                      onCheckedChange={(checked) => handleFileSelection(file.unique_id, checked as boolean)}
                    />
                  </div>
                  <div className="col-span-5 font-mono text-sm truncate" title={file.file_name}>
                    {file.file_name}
                  </div>
                  <div className="col-span-3 text-sm text-muted-foreground">{file.project_id}</div>
                  <div className="col-span-2 text-sm">{file.record_count.toLocaleString()}</div>
                  <div className="col-span-1">
                    <Badge variant={file.data_type === "dissolution" ? "default" : "secondary"}>
                      {file.data_type === "dissolution" ? "Diss" : "Part"}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {!loading && dataType && uploadedFiles.length > 0 && filteredFiles.length === 0 && (
          <div className="text-center py-8">
            <Search className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-sm text-muted-foreground">No files found matching "{searchText}"</p>
            <Button variant="outline" size="sm" className="mt-2 bg-transparent" onClick={() => setSearchText("")}>
              Clear Search
            </Button>
          </div>
        )}

        {/* Empty State */}
        {!loading && dataType && uploadedFiles.length === 0 && (
          <div className="text-center py-8">
            <Database className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-sm text-muted-foreground">
              No {dataType === "dissolution" ? "dissolution" : "particle size"} files found in the database
            </p>
          </div>
        )}

        {/* Initial State */}
        {!dataType && (
          <div className="text-center py-8">
            <Search className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-sm text-muted-foreground">Select a data type to search for uploaded files</p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
