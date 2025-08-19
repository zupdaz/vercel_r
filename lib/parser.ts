// Main parser module that handles different file types
import { parseMethodData } from "./dissolution-parser/method-parser"
import { parseSampleData } from "./dissolution-parser/result-parser"

export async function parseFile(file: File, logCallback: (message: string) => void): Promise<any> {
  const fileExtension = file.name.split(".").pop()?.toLowerCase()

  if (!fileExtension) {
    throw new Error("Could not determine file type")
  }

  logCallback(`Detected file type: ${fileExtension}`)

  if (fileExtension === "csv") {
    // For CSV files, we use the particle size analysis parser
    const { parseCSVFile } = await import("./particle-parser/csv-parser")
    const result = await parseCSVFile(file, logCallback)

    // Debug log to see what parseCSVFile returns
    logCallback(`DEBUG: CSV parser returned: ${JSON.stringify(Object.keys(result))}`)

    // Make sure we're returning the correct structure
    return {
      dataTable: result.dataTable,
      sizeClassTable: result.sizeClassTable,
    }
  } else if (["xlsx", "xlsm", "xls"].includes(fileExtension)) {
    // For Excel files, we parse both method and sample data
    logCallback(`DEBUG: Using Excel parser for file extension: ${fileExtension}`)
    return parseExcelFile(file, logCallback)
  } else {
    throw new Error(`Unsupported file type: ${fileExtension}`)
  }
}

// Excel Parser for dissolution testing data
export async function parseExcelFile(
  file: File,
  logCallback: (log: string) => void,
): Promise<{ methodData: any[]; sampleData: any[] }> {
  try {
    logCallback(`INFO: Starting to parse Excel file: ${file.name}`)

    // First, verify that the file contains the required sheets
    const arrayBuffer = await file.arrayBuffer()
    const XLSX = await import("xlsx")
    const workbook = XLSX.read(arrayBuffer, { type: "array" })

    // Check if required sheets exist
    const hasIzracunSheet = workbook.SheetNames.some(
      (name) => name.toLowerCase().includes("izračun") || name.toLowerCase().includes("izracun"),
    )

    const hasIzvidSheet = workbook.SheetNames.some((name) => name.toLowerCase().includes("izvid"))

    if (!hasIzracunSheet || !hasIzvidSheet) {
      const missingSheets = []
      if (!hasIzracunSheet) missingSheets.push("izracun")
      if (!hasIzvidSheet) missingSheets.push("izvid")

      const errorMsg = `Excel file does not contain required sheets: ${missingSheets.join(", ")}`
      logCallback(`ERROR: ${errorMsg}`)
      throw new Error(errorMsg)
    }

    logCallback(`INFO: Verified required sheets are present in Excel file`)

    // Parse method data
    const methodData = await parseMethodData(file, logCallback)
    logCallback(`INFO: Method data parsing complete. Found ${methodData.length} records.`)

    // Parse sample data
    const sampleData = await parseSampleData(file, logCallback)
    logCallback(`INFO: Sample data parsing complete. Found ${sampleData.length} records.`)

    return { methodData, sampleData }
  } catch (error) {
    logCallback(`ERROR: ${error instanceof Error ? error.message : String(error)}`)
    throw error
  }
}
