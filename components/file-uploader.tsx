"use client"

import type React from "react"

import { useState, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Upload, AlertCircle } from "lucide-react"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"

interface FileUploaderProps {
  onFileUpload: (file: File) => Promise<void>
  isProcessing: boolean
}

export default function FileUploader({ onFileUpload, isProcessing }: FileUploaderProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [error, setError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    setError(null)
    const files = e.target.files
    if (files && files.length > 0) {
      const file = files[0]
      if (isValidFileType(file)) {
        setSelectedFile(file)
      } else {
        setError("Invalid file type. Please upload a CSV or Excel file.")
      }
    }
    // Reset the input value so the same file can be selected again
    if (fileInputRef.current) {
      fileInputRef.current.value = ""
    }
  }

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setError(null)

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const file = e.dataTransfer.files[0]
      if (isValidFileType(file)) {
        setSelectedFile(file)
      } else {
        setError("Invalid file type. Please upload a CSV or Excel file.")
      }
    }
  }

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
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

  const handleUpload = async () => {
    if (!selectedFile) return

    try {
      setError(null)
      await onFileUpload(selectedFile)
      setSelectedFile(null)
    } catch (error) {
      setError(error instanceof Error ? error.message : "An error occurred during upload")
    }
  }

  const openFileSelector = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click()
    }
  }

  return (
    <div className="space-y-4">
      <div
        className="border-2 border-dashed rounded-lg p-8 text-center border-primary/20 hover:border-primary/50 transition-colors"
        onDrop={handleDrop}
        onDragOver={handleDragOver}
      >
        <input
          type="file"
          accept=".csv,.xlsx,.xlsm,.xls"
          onChange={handleFileSelect}
          ref={fileInputRef}
          className="hidden"
          disabled={isProcessing}
        />
        <Upload className="mx-auto h-12 w-12 text-gray-400" />
        <h3 className="mt-2 text-lg font-semibold">Drag file here or click to upload</h3>
        <p className="mt-1 text-sm text-gray-500">
          Supports CSV files for particle size analysis and Excel files for dissolution testing
        </p>
        <div className="flex justify-center mt-4 space-x-4">
          <Button onClick={openFileSelector} disabled={isProcessing} variant="outline">
            Select File
          </Button>
        </div>
      </div>

      {selectedFile && (
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="font-medium">{selectedFile.name}</div>
                <div className="text-sm text-muted-foreground">{(selectedFile.size / 1024).toFixed(2)} KB</div>
              </div>
              <Button onClick={handleUpload} disabled={isProcessing}>
                {isProcessing ? "Processing..." : "Process File"}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
    </div>
  )
}
