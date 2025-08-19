"use client"

import type React from "react"

import { useState, useRef, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Upload, X, AlertCircle } from "lucide-react"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import ErrorReportDialog from "./error-report-dialog"
import { startBatchUpload, endBatchUpload } from "@/lib/services/batch-processor"

interface MultiFileUploaderProps {
  projectId?: string
  onFileUpload: (file: File) => Promise<void>
}

export default function MultiFileUploader({ projectId, onFileUpload }: MultiFileUploaderProps) {
  const [selectedFiles, setSelectedFiles] = useState<File[]>([])
  const [isUploading, setIsUploading] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [failedFiles, setFailedFiles] = useState<Array<{ fileName: string; error: string }>>([])
  const [isErrorReportOpen, setIsErrorReportOpen] = useState(false)
  const [processingQueue, setProcessingQueue] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (files) {
      const fileArray = Array.from(files)
      setSelectedFiles((prev) => [...prev, ...fileArray])
    }
    // Reset the input value so the same file can be selected again
    if (fileInputRef.current) {
      fileInputRef.current.value = ""
    }
  }

  const removeFile = (index: number) => {
    setSelectedFiles((prev) => prev.filter((_, i) => i !== index))
  }

  const processNextFile = async () => {
    if (!projectId || selectedFiles.length === 0 || isUploading) return false

    setIsUploading(true)
    setUploadError(null)

    const currentFile = selectedFiles[0]

    try {
      // Process the file
      await onFileUpload(currentFile)

      // Remove the processed file
      setSelectedFiles((prev) => prev.slice(1))
      return true
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "An error occurred during upload"
      setUploadError(errorMessage)

      // Add to failed files list
      setFailedFiles((prev) => [...prev, { fileName: currentFile.name, error: errorMessage }])

      // Remove the failed file
      setSelectedFiles((prev) => prev.slice(1))
      return false
    } finally {
      setIsUploading(false)
    }
  }

  const handleUpload = async () => {
    if (!projectId || selectedFiles.length === 0) return

    // Start batch upload if multiple files
    if (selectedFiles.length > 1) {
      startBatchUpload()
    }

    setProcessingQueue(true)
    await processNextFile()
  }

  // Process files in queue when processingQueue is true
  useEffect(() => {
    const processQueue = async () => {
      if (processingQueue && selectedFiles.length > 0 && !isUploading) {
        // Small delay to prevent UI freezing
        await new Promise((resolve) => setTimeout(resolve, 100))
        await processNextFile()
      } else if (processingQueue && selectedFiles.length === 0) {
        setProcessingQueue(false)

        // End batch upload when queue is empty
        if (projectId) {
          try {
            await endBatchUpload(projectId)
          } catch (error) {
            console.error("Error ending batch upload:", error)
          }
        }
      }
    }

    processQueue()
  }, [processingQueue, selectedFiles, isUploading, projectId])

  const openFileSelector = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click()
    }
  }

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.stopPropagation()

    if (e.dataTransfer.files) {
      const fileArray = Array.from(e.dataTransfer.files)
      setSelectedFiles((prev) => [...prev, ...fileArray])
    }
  }

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.stopPropagation()
  }

  const isValidFileType = (file: File) => {
    const validTypes = [
      "text/csv",
      "application/vnd.ms-excel",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "application/vnd.ms-excel.sheet.macroEnabled.12",
    ]
    return (
      validTypes.includes(file.type) ||
      file.name.endsWith(".csv") ||
      file.name.endsWith(".xlsx") ||
      file.name.endsWith(".xlsm") ||
      file.name.endsWith(".xls")
    )
  }

  const clearFailedFiles = () => {
    setFailedFiles([])
    setUploadError(null)
  }

  return (
    <>
      <Card>
        <CardContent className="p-6">
          <div
            className={`border-2 border-dashed rounded-lg p-6 text-center ${
              !projectId ? "bg-gray-50 border-gray-200" : "border-primary/20 hover:border-primary/50"
            } transition-colors`}
            onDrop={projectId ? handleDrop : undefined}
            onDragOver={projectId ? handleDragOver : undefined}
          >
            <input
              type="file"
              accept=".csv,.xlsx,.xlsm,.xls"
              onChange={handleFileSelect}
              ref={fileInputRef}
              className="hidden"
              multiple
              disabled={!projectId || isUploading || processingQueue}
            />
            <Upload className="mx-auto h-12 w-12 text-gray-400" />
            <h3 className="mt-2 text-sm font-semibold">
              {projectId ? "Drag files here or click to upload" : "Select a project first"}
            </h3>
            <p className="mt-1 text-xs text-gray-500">Supports CSV, XLSX, XLSM files up to 10MB</p>
            <Button
              onClick={openFileSelector}
              disabled={!projectId || isUploading || processingQueue}
              variant="outline"
              className="mt-4"
            >
              {isUploading ? "Uploading..." : "Select Files"}
            </Button>
          </div>

          {selectedFiles.length > 0 && (
            <div className="mt-4">
              <h4 className="text-sm font-medium mb-2">Selected Files ({selectedFiles.length})</h4>
              <div className="space-y-2 max-h-[200px] overflow-y-auto">
                {selectedFiles.map((file, index) => (
                  <div
                    key={`${file.name}-${index}`}
                    className={`flex items-center justify-between p-2 border rounded-md ${
                      !isValidFileType(file) ? "border-red-300 bg-red-50" : ""
                    }`}
                  >
                    <div className="flex-1 truncate">
                      <div className="font-medium truncate">{file.name}</div>
                      <div className="text-xs text-gray-500">
                        {(file.size / 1024).toFixed(2)} KB
                        {!isValidFileType(file) && <span className="text-red-500 ml-2">Invalid file type</span>}
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => removeFile(index)}
                      disabled={isUploading || processingQueue}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
              <div className="mt-4 flex justify-end">
                <Button
                  onClick={handleUpload}
                  disabled={
                    !projectId ||
                    isUploading ||
                    processingQueue ||
                    selectedFiles.length === 0 ||
                    !isValidFileType(selectedFiles[0])
                  }
                  className="bg-[#00ab4d] hover:bg-[#009040]"
                >
                  {isUploading ? "Processing..." : processingQueue ? "Processing Queue..." : "Process All Files"}
                </Button>
              </div>
            </div>
          )}

          {uploadError && (
            <Alert variant="destructive" className="mt-4">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Error</AlertTitle>
              <AlertDescription>{uploadError}</AlertDescription>
            </Alert>
          )}

          {failedFiles.length > 0 && (
            <div className="mt-4 p-4 border border-yellow-200 bg-yellow-50 rounded-md">
              <div className="flex justify-between items-center mb-2">
                <h4 className="text-sm font-medium text-yellow-800">Failed Files ({failedFiles.length})</h4>
                <div className="flex space-x-2">
                  <Button variant="outline" size="sm" onClick={() => setIsErrorReportOpen(true)}>
                    Report Issues
                  </Button>
                  <Button variant="ghost" size="sm" onClick={clearFailedFiles}>
                    Clear
                  </Button>
                </div>
              </div>
              <div className="space-y-1 max-h-[100px] overflow-y-auto text-sm">
                {failedFiles.map((file, index) => (
                  <div key={index} className="text-yellow-800">
                    {file.fileName}
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {projectId && (
        <ErrorReportDialog
          open={isErrorReportOpen}
          onOpenChange={setIsErrorReportOpen}
          failedFiles={failedFiles}
          projectId={projectId}
        />
      )}
    </>
  )
}
