import fs from "fs"
import path from "path"
import { FEATURES, STORAGE } from "../settings"

/**
 * Saves an uploaded file to the local filesystem
 * @param file The file to save
 * @param projectName The name of the project (used for folder structure)
 * @returns Object with success status and file path or error message
 */
export async function saveUploadedFile(
  file: File,
  projectName: string,
): Promise<{ success: boolean; filePath?: string; message: string }> {
  // Skip if local file storage is disabled
  if (!FEATURES.ENABLE_LOCAL_FILE_STORAGE) {
    return {
      success: true,
      message: "Local file storage is disabled, file not saved locally",
    }
  }

  try {
    // Create base uploads directory if it doesn't exist
    const baseDir = STORAGE.UPLOAD_BASE_DIR
    if (!fs.existsSync(baseDir)) {
      fs.mkdirSync(baseDir, { recursive: true })
    }

    // Create project directory if it doesn't exist
    // Sanitize project name for use as a directory name
    const sanitizedProjectName = projectName.replace(/[^a-z0-9]/gi, "_").toLowerCase()
    const projectDir = path.join(baseDir, sanitizedProjectName)

    if (!fs.existsSync(projectDir)) {
      fs.mkdirSync(projectDir, { recursive: true })
    }

    // Generate file path
    const fileName = file.name
    const filePath = path.join(projectDir, fileName)

    // Check if file already exists, append timestamp if it does
    let finalFilePath = filePath
    if (fs.existsSync(filePath)) {
      const timestamp = new Date().toISOString().replace(/[:.]/g, "-")
      const fileExt = path.extname(fileName)
      const fileBase = path.basename(fileName, fileExt)
      finalFilePath = path.join(projectDir, `${fileBase}_${timestamp}${fileExt}`)
    }

    // Convert File object to Buffer and save to filesystem
    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)
    fs.writeFileSync(finalFilePath, buffer)

    return {
      success: true,
      filePath: finalFilePath,
      message: `File saved to ${finalFilePath}`,
    }
  } catch (error) {
    console.error("Error saving file:", error)
    return {
      success: false,
      message: `Failed to save file: ${error instanceof Error ? error.message : String(error)}`,
    }
  }
}
