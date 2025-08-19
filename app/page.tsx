"use client"

import { useState, useCallback } from "react"
import { parseFile } from "@/lib/parser"
import LogViewer from "@/components/log-viewer"
import ProjectSelector from "@/components/project-selector"
import MultiFileUploader from "@/components/multi-file-uploader"
import QueueStatus from "@/components/queue-status"
import { addToQueue, updateQueueItem } from "@/lib/services/queue-service"
import ProcessedFileResults from "@/components/processed-file-results"
import { saveCSVData, saveExcelData } from "@/lib/services/supabase-service"
import { saveSampleMetadata } from "@/lib/services/mra-sample-service"
// import SampleMetadataViewer from "@/components/sample-metadata-viewer"
import AppHeader from "@/components/app-header"
import { registerProcessedFile } from "@/lib/services/batch-processor"
import { saveUploadedFile } from "@/lib/services/file-storage-service"
import { getProjectById } from "@/lib/services/project-service"
import DatabaseSearch from "@/components/database-search"
import ParquetExport from "@/components/parquet-export"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

export default function ParserPage() {
  const [logs, setLogs] = useState<string[]>([])
  const [parsedData, setParsedData] = useState<any>(null)
  const [methodData, setMethodData] = useState<any>(null)
  const [sampleData, setSampleData] = useState<any>(null)
  const [dataTable, setDataTable] = useState<any>(null)
  const [sizeClassTable, setSizeClassTable] = useState<any>(null)
  const [activeTab, setActiveTab] = useState("method")
  const [selectedProjectId, setSelectedProjectId] = useState<string>()
  const [processedFiles, setProcessedFiles] = useState<
    Array<{
      fileName: string
      result: any
    }>
  >([])

  const addLog = useCallback((log: string) => {
    setLogs((prevLogs) => [...prevLogs, log])
  }, [])

  const handleFileUpload = async (file: File) => {
    if (!selectedProjectId) return

    // Create a queue item
    const queueItem = addToQueue({
      fileName: file.name,
      fileSize: file.size,
      fileType: file.type,
      projectId: selectedProjectId,
    })

    try {
      // Update queue item status
      updateQueueItem(queueItem.id, { status: "processing", startTime: new Date() })
      addLog(`INFO: Processing file: ${file.name}`)

      // Get project name for folder structure
      const project = await getProjectById(selectedProjectId)
      if (project) {
        // Save the file to local storage
        const saveResult = await saveUploadedFile(file, project.name)
        if (saveResult.success && saveResult.filePath) {
          addLog(`INFO: ${saveResult.message}`)
        } else {
          addLog(`WARN: ${saveResult.message}`)
        }
      }

      // Use the unified parser
      const result = await parseFile(file, addLog)

      // Debug log to see what the parser returned
      addLog(`DEBUG: Parser returned result structure: ${JSON.stringify(Object.keys(result))}`)

      let fileResult: any = null

      if (result.methodData && result.sampleData) {
        // Excel result
        addLog(`DEBUG: Detected Excel format (methodData + sampleData)`)
        setMethodData(result.methodData)
        setSampleData(result.sampleData)
        fileResult = { type: "excel", methodData: result.methodData, sampleData: result.sampleData }
        updateQueueItem(queueItem.id, {
          status: "completed",
          endTime: new Date(),
          result: {
            methodRows: result.methodData.length,
            sampleRows: result.sampleData.length,
          },
        })
        addLog(`INFO: Successfully processed ${file.name} (Excel format)`)
      } else if (result.dataTable && result.sizeClassTable) {
        // New CSV result
        addLog(`DEBUG: Detected CSV format (dataTable + sizeClassTable)`)
        setDataTable(result.dataTable)
        setSizeClassTable(result.sizeClassTable)
        fileResult = { type: "csv", dataTable: result.dataTable, sizeClassTable: result.sizeClassTable }
        updateQueueItem(queueItem.id, {
          status: "completed",
          endTime: new Date(),
          result: {
            dataTableRows: result.dataTable.length,
            sizeClassTableRows: result.sizeClassTable.length,
          },
        })
        addLog(`INFO: Successfully processed ${file.name} (CSV format)`)
      } else {
        // Unknown format - log the structure
        addLog(`ERROR: Unknown result format. Result keys: ${Object.keys(result).join(", ")}`)
        throw new Error(`Unknown result format from parser. Result keys: ${Object.keys(result).join(", ")}`)
      }

      // Extract and save MRA numbers with the correct project ID
      if (result.methodData && result.sampleData) {
        // For Excel files (dissolution)
        const mraDataMap = new Map<string, { mra_no: string; batch_diss?: string }>()

        result.sampleData.forEach((row: any) => {
          if (row.mra_no) {
            mraDataMap.set(row.mra_no, {
              mra_no: row.mra_no,
              batch_diss: row.batch_diss || undefined,
            })
          }
        })

        const mraData = Array.from(mraDataMap.values())

        if (mraData.length > 0) {
          addLog(`INFO: Found ${mraData.length} unique MRA numbers in dissolution data`)
          try {
            const saveResult = await saveSampleMetadata(file.name, mraData)
            addLog(`INFO: ${saveResult.message}`)
          } catch (error) {
            addLog(`WARN: Failed to save MRA numbers: ${error instanceof Error ? error.message : String(error)}`)
          }
        }
      } else if (result.dataTable && result.sizeClassTable) {
        // For CSV files (particle size)
        const mraDataMap = new Map<string, { mra_no: string; batch_diss?: string; batch_cam?: string }>()

        result.dataTable.forEach((row: any) => {
          if (row.mra_no) {
            mraDataMap.set(row.mra_no, {
              mra_no: row.mra_no,
              batch_cam: row.batch_cam || undefined, // Use batch_cam from the data
            })
          }
        })

        const mraData = Array.from(mraDataMap.values())

        if (mraData.length > 0) {
          addLog(`INFO: Found ${mraData.length} unique MRA numbers in particle size data`)
          try {
            const saveResult = await saveSampleMetadata(file.name, mraData)
            addLog(`INFO: ${saveResult.message}`)
          } catch (error) {
            addLog(`WARN: Failed to save MRA numbers: ${error instanceof Error ? error.message : String(error)}`)
          }
        }
      }

      // Add to processed files
      if (fileResult) {
        setProcessedFiles((prev) => [...prev, { fileName: file.name, result: fileResult }])
      }

      // Save data to Supabase
      addLog(`INFO: Saving data to database for ${file.name}...`)
      addLog(`DEBUG: File result type: ${fileResult?.type}`)

      try {
        let saveResult

        if (fileResult.type === "excel") {
          addLog(`DEBUG: Using saveExcelData for ${file.name}`)
          saveResult = await saveExcelData(file.name, selectedProjectId, fileResult.methodData, fileResult.sampleData)
        } else if (fileResult.type === "csv") {
          addLog(`DEBUG: Using saveCSVData for ${file.name}`)
          saveResult = await saveCSVData(file.name, selectedProjectId, fileResult.dataTable, fileResult.sizeClassTable)
        } else {
          const errorMsg = `Unknown file result type: ${fileResult?.type}`
          addLog(`ERROR: ${errorMsg}`)
          throw new Error(errorMsg)
        }

        if (saveResult?.success) {
          addLog(`INFO: ${saveResult.message} for ${file.name}`)
          // Update queue item with save status
          updateQueueItem(queueItem.id, {
            result: {
              ...queueItem.result,
              savedToDatabase: true,
              saveMessage: saveResult.message,
            },
          })

          // Register the processed file for post-processing
          if (fileResult.type === "excel") {
            try {
              await registerProcessedFile(
                fileResult.type as "excel" | "csv" | "legacy",
                selectedProjectId,
                true, // Run immediately for single files
              )
              addLog(`INFO: Updated dissolution method short codes for ${file.name}`)
            } catch (error) {
              addLog(
                `WARN: Failed to update dissolution method short codes: ${error instanceof Error ? error.message : String(error)}`,
              )
            }
          }

          // Also update the processed files list with the save status
          setProcessedFiles((prev) =>
            prev.map((pf) =>
              pf.fileName === file.name
                ? {
                    ...pf,
                    result: {
                      ...pf.result,
                      savedToDatabase: true,
                      saveMessage: saveResult.message,
                    },
                  }
                : pf,
            ),
          )
        } else {
          addLog(`WARN: ${saveResult?.message || "Unknown error saving data"} for ${file.name}`)
          // Update queue item with save status
          updateQueueItem(queueItem.id, {
            result: {
              ...queueItem.result,
              savedToDatabase: false,
              saveMessage: saveResult?.message,
            },
          })

          // Also update the processed files list with the save status
          setProcessedFiles((prev) =>
            prev.map((pf) =>
              pf.fileName === file.name
                ? {
                    ...pf,
                    result: {
                      ...pf.result,
                      savedToDatabase: false,
                      saveMessage: saveResult?.message,
                    },
                  }
                : pf,
            ),
          )
        }
      } catch (saveError) {
        const errorMsg = saveError instanceof Error ? saveError.message : String(saveError)
        addLog(`ERROR: Failed to save data to database: ${errorMsg}`)

        // Add stack trace if available
        if (saveError instanceof Error && saveError.stack) {
          addLog(`DEBUG: Error stack trace: ${saveError.stack}`)
        }

        // Don't fail the whole process if saving fails
        updateQueueItem(queueItem.id, {
          result: {
            ...queueItem.result,
            savedToDatabase: false,
            saveMessage: `Save error: ${errorMsg}`,
          },
        })

        // Update processed files list
        setProcessedFiles((prev) =>
          prev.map((pf) =>
            pf.fileName === file.name
              ? {
                  ...pf,
                  result: {
                    ...pf.result,
                    savedToDatabase: false,
                    saveMessage: `Save error: ${errorMsg}`,
                  },
                }
              : pf,
          ),
        )
      }

      return result // Return the result for further processing
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error)
      addLog(`ERROR: Failed to process ${file.name}: ${errorMsg}`)

      // Add stack trace if available
      if (error instanceof Error && error.stack) {
        addLog(`DEBUG: Error stack trace: ${error.stack}`)
      }

      // Mark as failed and ensure it stays failed
      updateQueueItem(queueItem.id, {
        status: "failed",
        endTime: new Date(),
        error: errorMsg,
        result: {
          savedToDatabase: false,
          parseSuccess: false,
          errorMessage: errorMsg,
        },
      })

      // Add to processed files list as failed
      setProcessedFiles((prev) => [
        ...prev,
        {
          fileName: file.name,
          result: {
            type: "error",
            error: errorMsg,
            savedToDatabase: false,
          },
        },
      ])

      throw error // Re-throw to be handled by the uploader component
    }
  }

  const clearProcessedFiles = useCallback(() => {
    setProcessedFiles([])
    setParsedData(null)
    setMethodData(null)
    setSampleData(null)
    setDataTable(null)
    setSizeClassTable(null)
  }, [])

  return (
    <>
      <AppHeader />
      <div className="container mx-auto py-10 space-y-8">
        <Tabs defaultValue="upload" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="upload">File Upload</TabsTrigger>
            <TabsTrigger value="database">Database Management</TabsTrigger>
          </TabsList>

          <TabsContent value="upload" className="space-y-8">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="md:col-span-1 space-y-6">
                <ProjectSelector onProjectSelect={setSelectedProjectId} selectedProjectId={selectedProjectId} />
              </div>
              <div className="md:col-span-2">
                <MultiFileUploader projectId={selectedProjectId} onFileUpload={handleFileUpload} />
              </div>
            </div>

            <QueueStatus />

            {processedFiles.length > 0 && (
              <ProcessedFileResults processedFiles={processedFiles} onClear={clearProcessedFiles} />
            )}

            {/* <SampleMetadataViewer /> */}

            {logs.length > 0 && (
              <div className="mt-8">
                <LogViewer logs={logs} />
              </div>
            )}
          </TabsContent>

          <TabsContent value="database" className="space-y-8">
            <DatabaseSearch />
            <ParquetExport />
          </TabsContent>
        </Tabs>
      </div>
    </>
  )
}
