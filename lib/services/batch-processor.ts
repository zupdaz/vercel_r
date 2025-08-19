import { updateDissolutionMethodShortCodes } from "./dissolution-service"

// Track if we're currently in a batch upload
let batchUploadInProgress = false
// Count of Excel files processed in the current batch
let excelFilesProcessed = 0

/**
 * Start a new batch upload session
 */
export function startBatchUpload() {
  batchUploadInProgress = true
  excelFilesProcessed = 0
}

/**
 * End the current batch upload session and process any pending operations
 * @param projectId The project ID for the batch
 */
export async function endBatchUpload(projectId: string) {
  if (batchUploadInProgress && excelFilesProcessed > 0) {
    // Update dissolution method short codes and analysis_no/replicate values
    // The function now only processes records that need recalculation
    const result = await updateDissolutionMethodShortCodes(projectId)
    console.log(`Batch processing completed: ${result.message}`)
  }

  batchUploadInProgress = false
  excelFilesProcessed = 0
}

/**
 * Register a file as processed in the current batch
 * @param fileType The type of file processed
 * @param projectId The project ID
 * @param runImmediately Whether to run post-processing immediately
 */
export async function registerProcessedFile(
  fileType: "excel" | "csv" | "legacy",
  projectId: string,
  runImmediately = false,
) {
  if (fileType === "excel") {
    excelFilesProcessed++

    // If not in a batch or immediate processing is requested, run the update
    if (!batchUploadInProgress || runImmediately) {
      const result = await updateDissolutionMethodShortCodes(projectId)
      console.log(`Immediate processing completed: ${result.message}`)
      excelFilesProcessed = 0
    }
  }
}
