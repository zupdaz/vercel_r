import * as XLSX from "xlsx"
import { Logger } from "../parser-utils"
import { extractTrial } from "../parser-utils"
// Update the import for saveSampleMetadata
import { saveSampleMetadata } from "../services/mra-sample-service"
// Import the fuzzy matching function at the top of the file
import { findClosestActiveIngredient } from "../services/active-ingredient-service"

export interface SampleOutputRow {
  file_name: string
  sample_diss: any
  active_ingredient_diss: any
  api_strength_diss: any
  batch_diss: any
  mra_no?: any
  vessel_no: number // Changed from replicate to vessel_no
  time: any
  dissolved_value: any
  file_name_active_ing: string
  batch_diss_short?: string
  batch_diss_description?: string
}

export async function parseSampleData(file: File, logCallback: (log: string) => void): Promise<SampleOutputRow[]> {
  const logger = new Logger(logCallback)
  logger.info(`Starting to parse sample and result data from file: ${file.name}`)

  const outputRows: SampleOutputRow[] = []
  const fileName = file.name

  try {
    // Read the file content
    const arrayBuffer = await file.arrayBuffer()
    const workbook = XLSX.read(arrayBuffer, { type: "array", cellDates: true })

    logger.info(`Workbook loaded with ${workbook.SheetNames.length} sheets`)

    for (const sheetName of workbook.SheetNames) {
      // Check if the sheet is hidden by looking up its metadata
      const sheetMeta = workbook.Workbook?.Sheets?.find((meta) => meta.name === sheetName)
      if (sheetMeta && sheetMeta.Hidden) {
        continue
      }

      if (
        sheetName.toLowerCase().includes("izvid") &&
        !sheetName.toLowerCase().includes("izvid_kc") &&
        !sheetName.toLowerCase().includes("izvid_profil") &&
        !sheetName.toLowerCase().includes("izvid_kč")
      ) {
        logger.info(`Processing sample sheet: ${sheetName}`)

        try {
          // Table 1: read header/calculation data (skiprows=2, nrows=19)
          // Increment row indices by 1 (from r: 2 to r: 3)
          const table1 = XLSX.utils.sheet_to_json<any[]>(workbook.Sheets[sheetName], {
            header: 1,
            defval: null,
            range: { s: { r: 3, c: 0 }, e: { r: 22, c: 12 } },
          })

          if (table1.length < 19) {
            logger.warn(`Sheet ${sheetName} skipped: insufficient rows in Table 1.`)
            continue
          }

          // Find starting row (t2) for table 2 by scanning for a row where column B equals 1
          let t2 = -1
          const worksheet = workbook.Sheets[sheetName]

          for (let r = 0; r < 100; r++) {
            // Safety limit
            const cellRef = XLSX.utils.encode_cell({ r, c: 1 }) // Column B
            const cell = worksheet[cellRef]
            if (cell && (cell.v === 1 || cell.v === "1")) {
              t2 = r
              break
            }
          }

          if (t2 === -1) {
            logger.warn(`Could not find starting row for Table 2 in sheet: ${sheetName}`)
            continue
          }

          // Table 2: read sample data (skiprows=t2, nrows=11)
          const table2 = XLSX.utils.sheet_to_json<any[]>(workbook.Sheets[sheetName], {
            header: 1,
            defval: null,
            range: { s: { r: t2, c: 0 }, e: { r: t2 + 11, c: 9 } },
          })

          // Filter out empty rows
          const filteredTable2 = table2.filter((row: any[]) => row.some((cell) => cell !== null))

          if (filteredTable2.length === 0) {
            logger.warn(`No data found in Table 2 for sheet: ${sheetName}`)
            continue
          }

          // Extract sample counts from table 1
          // For s1: row 3, col 12; s2: row 7, col 12; s3: row 11, col 12; s4: row 15, col 12
          // Increment all row indices by 1
          const getCell = (rowIndex: number, colIndex: number) => {
            if (table1[rowIndex] && table1[rowIndex][colIndex]) {
              return table1[rowIndex][colIndex]
            }
            return 0
          }

          // Increment indices by 1 (from [3, 7, 11, 15] to [4, 8, 12, 16])
          const indices = [3, 7, 11, 15]
          const sampleCounts = indices.map((r) => {
            const val = getCell(r, 12)
            return val && !isNaN(Number(val)) && Number(val) > 0 ? Number(val) : 0
          })

          // Update the sampleDetails object to include mra_no
          // Define sample details for each group
          // Increment all row indices by 1
          const sampleDetails = [
            {
              Sample_DISS: table1[2]?.[2],
              Batch_DISS: table1[3]?.[2],
              MRA_NO: table1[4]?.[2] ? String(table1[4]?.[2]).trim().substring(0, 8) : null,
            },
            {
              Sample_DISS: table1[6]?.[2],
              Batch_DISS: table1[7]?.[2],
              MRA_NO: table1[8]?.[2] ? String(table1[8]?.[2]).trim().substring(0, 8) : null,
            },
            {
              Sample_DISS: table1[10]?.[2],
              Batch_DISS: table1[11]?.[2],
              MRA_NO: table1[12]?.[2] ? String(table1[12]?.[2]).trim().substring(0, 8) : null,
            },
            {
              Sample_DISS: table1[14]?.[2],
              Batch_DISS: table1[15]?.[2],
              MRA_NO: table1[16]?.[2] ? String(table1[16]?.[2]).trim().substring(0, 8) : null,
            },
          ]

          // Extract active ingredient and strength
          // Extract active ingredient from column header (similar to Python's data.columns[2])
          let activeIng = "UNKNOWN_ACTIVE"
          try {
            // Get the worksheet
            const ws = workbook.Sheets[sheetName]
            // Get the cell at column C (index 2) in the header row (row 3, which is index 2)
            const headerCellRef = XLSX.utils.encode_cell({ r: 2, c: 2 })
            const headerCell = ws[headerCellRef]
            if (headerCell && headerCell.v) {
              const extractedActiveIng = String(headerCell.v)
              // Use fuzzy matching to find the closest match in the active_ingredient table
              logger.info(`Attempting to match active ingredient: "${extractedActiveIng}"`)
              activeIng = await findClosestActiveIngredient(extractedActiveIng)
              if (activeIng !== extractedActiveIng) {
                logger.info(
                  `Successfully matched active ingredient "${extractedActiveIng}" to "${activeIng}" from reference list`,
                )
              } else {
                logger.warn(`No match found for active ingredient "${extractedActiveIng}" in reference list`)
              }
            } else {
              logger.warn(`Could not extract active ingredient from column header, using default value`)
            }
          } catch (e) {
            logger.warn(`Error extracting active ingredient from column header: ${e.message}`)
          }
          const strength = table1[0]?.[2]
          const fileNameActiveIng = `${fileName}_${activeIng}`

          let cumulativeOffset = 0
          for (let groupIndex = 0; groupIndex < sampleCounts.length; groupIndex++) {
            const count = sampleCounts[groupIndex]
            if (count <= 0) {
              continue
            }

            const details = sampleDetails[groupIndex]
            logger.info(`Processing group ${groupIndex + 1} with ${count} vessel(s) in sheet ${sheetName}.`)

            for (let i = 0; i < count; i++) {
              const vesselIndex = i + 1 + cumulativeOffset // Changed from replicateIndex to vesselIndex

              // We'll gather time and dissolved_value from table2
              for (const row of filteredTable2) {
                const timeVal = row[0]
                // Skip rows with invalid time values (matching Python behavior)
                if (timeVal === null || timeVal === undefined || timeVal === "") {
                  continue
                }

                // vesselIndex is the column we read for the dissolved value
                const dissolvedValue = row[vesselIndex] ?? null

                outputRows.push({
                  file_name: fileName,
                  sample_diss: details.Sample_DISS,
                  active_ingredient_diss: activeIng,
                  api_strength_diss: strength,
                  batch_diss: details.Batch_DISS,
                  mra_no: details.MRA_NO,
                  vessel_no: vesselIndex, // Changed from replicate to vessel_no
                  time: timeVal,
                  dissolved_value: dissolvedValue,
                  file_name_active_ing: fileNameActiveIng,
                })
              }
            }
            cumulativeOffset += count
          }
        } catch (e) {
          logger.error(`Error processing sample sheet ${sheetName}: ${e.message}`)
          logger.error(`Stack trace: ${e.stack}`)
        }
      }
    }

    // Process batch_diss fields
    const processedRows = outputRows.map((row) => {
      const newRow = { ...row }

      if (newRow.batch_diss && typeof newRow.batch_diss === "string") {
        try {
          const [shortCode, desc] = extractTrial(newRow.batch_diss)
          newRow.batch_diss_short = shortCode
          newRow.batch_diss_description = desc || undefined
        } catch (e) {
          logger.error(`Error extracting trial from batch_diss: ${e.message}`)
        }
      }

      return newRow
    })

    logger.info(`Finished processing sample sheets. Total rows parsed: ${processedRows.length}`)

    // Extract unique MRA numbers and their batch_diss from the processed rows
    const mraDataMap = new Map<string, { mra_no: string; batch_diss?: string }>()

    processedRows.forEach((row) => {
      if (row.mra_no) {
        mraDataMap.set(row.mra_no, {
          mra_no: row.mra_no,
          batch_diss: row.batch_diss || undefined,
        })
      }
    })

    const mraData = Array.from(mraDataMap.values())

    // Log the unique MRA numbers
    if (mraData.length > 0) {
      logger.info(`Found ${mraData.length} unique MRA numbers: ${mraData.map((item) => item.mra_no).join(", ")}`)

      // Save the MRA numbers to the sample_metadata table
      try {
        await saveSampleMetadata(fileName, mraData)
        logger.info(`Successfully saved MRA numbers to sample_metadata table`)
      } catch (error) {
        logger.error(`Failed to save MRA numbers: ${error instanceof Error ? error.message : String(error)}`)
      }
    }

    if (processedRows.length === 0) {
      logger.warn("No sample data rows were generated. Check sheet names and data structure.")
    }

    return processedRows
  } catch (error) {
    const errMsg = `Parsing failed: ${error.message}`
    logger.error(errMsg, error)
    throw error
  }
}
