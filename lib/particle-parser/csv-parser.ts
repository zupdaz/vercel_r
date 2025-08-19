import { Logger } from "../parser-utils"
import { extractMethodShort, extractTrial, extractTrialWithoutLetter } from "./particle-utils"
// Update the import for saveSampleMetadata
import { saveSampleMetadata } from "../services/mra-sample-service"

/**
 * Parse the CSV file into:
 *   1) dataTable (metadata, "Table 2")
 *   2) sizeClassTable (size-class data, "Table 3")
 */
export async function parseCSVFile(
  file: File,
  logCallback: (log: string) => void,
): Promise<{
  dataTable: any[]
  sizeClassTable: any[]
}> {
  const logger = new Logger(logCallback)
  logger.info(`Starting parse of ${file.name} (${file.size} bytes)`)

  // Column mapping for exact database column names
  const columnMapping: Record<string, string> = {
    "x(Q3=10.0 %) [µm]": "x_q3_10",
    "x(Q3=50.0 %) [µm]": "x_q3_50",
    "x(Q3=90.0 %) [µm]": "x_q3_90",
    "Mv3(x) [µm]": "mv3_x",
    "Sigma3(x) [µm]": "sigma3_x",
    SPAN3: "span3",
    "Sv [1/mm]": "sv",
    "Mean value SPHT3": "mean_value_spht3",
    "Mean value Symm3": "mean_value_symm3",
    "Mean value b/l3": "mean_value_b_l3",
  }

  // Columns to exclude from METADATA (Table 2), not from Table 3
  const excludedColumns = [
    "Q3 (SPHT=0.900) [%]",
    "p3 (SPHT=80.0 %) [%]",
    "SPHT (Q3=10.0 %)",
    "SPHT (Q3=50.0 %)",
    "SPHT (Q3=90.0 %)",
    "Q3(20.0 µm) [%]",
    "Q3(30.0 µm) [%]",
    "Q3(40.0 µm) [%]",
    "Q3(500.0 µm) [%]",
    "Q3(710.0 µm) [%]",
    "Q3(1000.0 µm) [%]",
    "Q3(1250.0 µm) [%]",
    "Q3(100.0 µm) [%]",
    "Q3(200.0 µm) [%]",
    "Q3(50.0 µm) [%]",
    "p3(50 µm, 150 µm) [%]",
    "p3(150 µm, 250 µm) [%]",
    "p3(250 µm, 350 µm) [%]",
  ]

  try {
    // 1) Read file as UTF-16 text
    const fileContent = await readFileAsText(file)

    // 2) Split lines
    const lines = fileContent.split(/\r?\n/)

    // 3) Find the two blank lines (these separate Table 2 from Table 3)
    const blankRows: number[] = []
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]
      // If a line is empty or starts with a tab => treat it as "blank"
      if (!line.trim() || line.startsWith("\t")) {
        blankRows.push(i + 1) // 1-based
        if (blankRows.length === 2) break
      }
    }
    if (blankRows.length < 2) {
      const msg = "Could not locate two blank rows—check file format."
      logger.error(msg)
      throw new Error(msg)
    }
    const [blankRow1, blankRow2] = blankRows
    const numRowsBetween = blankRow2 - blankRow1 - 2
    logger.info(`Blank rows at lines ${blankRow1} & ${blankRow2}; rows between: ${numRowsBetween}`)

    // The actual filename (used later for "file_name_file_no")
    const fileName = file.name

    // ------------------------------------------------------------------
    // TABLE 2 (Metadata)
    // ------------------------------------------------------------------
    const table2Lines = lines.slice(blankRow1, blankRow1 + numRowsBetween + 1)
    if (!table2Lines.length) {
      const msg = "No data in Table2 section."
      logger.error(msg)
      throw new Error(msg)
    }

    const table2Headers = table2Lines[0].split("\t")
    const table2Data = table2Lines.slice(1).map((line) => {
      const vals = line.split("\t")
      const row: Record<string, any> = {}
      row["index"] = vals[0]
      for (let i = 1; i < vals.length; i++) {
        if (i < table2Headers.length) {
          row[table2Headers[i]] = vals[i]
        }
      }
      return row
    })

    // Transpose: row -> columns
    const transposed: Array<Record<string, any>> = []
    const dataCols = table2Headers.slice(1) // skip "index"
    table2Data.forEach((rowObj) => {
      dataCols.forEach((col) => {
        let tRow = transposed.find((r) => r.index === col)
        if (!tRow) {
          tRow = { index: col }
          transposed.push(tRow)
        }
        tRow[rowObj["index"]] = rowObj[col]
      })
    })

    // Filter out excluded columns, rename columns according to database schema
    const metadataTable = transposed
      .filter((row) => {
        const idxTrim = (row.index || "").trim()
        const isExcluded = excludedColumns.includes(idxTrim)
        return !isExcluded
      })
      .map((row) => {
        // Create a new object with exact database column names
        const cleanedRow: Record<string, any> = {
          index: row.index,
          file_name: fileName,
        }

        // Remove excluded columns from each row
        for (const exCol of excludedColumns) {
          if (exCol in row) {
            delete row[exCol]
          }
        }

        // Map columns according to database schema
        Object.entries(row).forEach(([key, value]) => {
          if (key in columnMapping) {
            cleanedRow[columnMapping[key]] = value
          }
        })

        // rename "Comment 1" -> "mra_no", "Comment 2" -> "label_ou_sr"
        if (row["Comment 1"]) {
          cleanedRow["mra_no"] = row["Comment 1"]
        }

        if (row["Comment 2"]) {
          cleanedRow["label_ou_sr"] = row["Comment 2"]
        }

        // Convert numeric fields
        Object.keys(cleanedRow).forEach((k) => {
          if (
            ![
              "index",
              "mra_no",
              "label_ou_sr",
              "file_name",
              "file_name_file_no",
              "method_short",
              "trial",
              "intermediate_form",
              "batch_cam",
            ].includes(k)
          ) {
            const numVal = Number.parseFloat(String(cleanedRow[k] || "").replace(",", "."))
            if (!isNaN(numVal)) {
              cleanedRow[k] = numVal
            }
          }
        })

        // Add file_name_file_no
        cleanedRow["file_name_file_no"] = `${fileName}_${cleanedRow.index}`

        // If "label_ou_sr" is present, parse it
        if (cleanedRow["label_ou_sr"]) {
          const [methodShort, newLabel] = extractMethodShort(String(cleanedRow["label_ou_sr"]))
          cleanedRow["method_short"] = methodShort || ""
          cleanedRow["label_ou_sr"] = newLabel
          const [trial, intermediate] = extractTrial(newLabel)
          cleanedRow["trial"] = trial
          cleanedRow["intermediate_form"] = intermediate
          cleanedRow["batch_cam"] = extractTrialWithoutLetter(trial)
        }

        // Log the cleaned row for debugging
        logger.debug(`Cleaned metadata row: ${JSON.stringify(cleanedRow)}`)

        return cleanedRow
      })

    // ------------------------------------------------------------------
    // TABLE 3 (Size‐Class)
    // ------------------------------------------------------------------
    // Rest of the code remains the same as it's not affected by the column mapping
    // ... (previous size class table code)

    logger.info("Parsing completed successfully.")

    // Extract unique MRA numbers and batch_cam information from the metadata table
    const mraDataMap = new Map<string, { mra_no: string; batch_cam?: string }>()

    metadataTable.forEach((row) => {
      if (row.mra_no) {
        mraDataMap.set(row.mra_no, {
          mra_no: row.mra_no,
          batch_cam: row.batch_cam || undefined, // Use batch_cam as batch_cam
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

    const rawTable3 = lines.slice(blankRow2 + 2, blankRow2 + 2 + 103)
    if (!rawTable3.length) {
      const msg = "No data in Table3 section."
      logger.error(msg)
      throw new Error(msg)
    }

    const headerLineIndex = 0
    const dataStartIndex = 1

    if (rawTable3.length <= headerLineIndex) {
      const msg = "Not enough lines for the Table3 header row."
      logger.error(msg)
      throw new Error(msg)
    }
    if (rawTable3.length < dataStartIndex + 1) {
      const msg = "Not enough lines to parse Table3 header + data."
      logger.error(msg)
      throw new Error(msg)
    }

    // 1) Grab the raw header line
    const rawHeader = rawTable3[headerLineIndex]
    const splitHeader = rawHeader.split("\t").map((x) => x.trim())

    // Stop at the first repeated column name
    const seenFileCols = new Set<string>()
    const finalHeaderCols: string[] = []
    for (let i = 2; i < splitHeader.length; i++) {
      const colName = splitHeader[i]
      if (!colName) continue
      if (seenFileCols.has(colName)) {
        break
      }
      seenFileCols.add(colName)
      finalHeaderCols.push(colName)
    }

    // 2) The data lines
    const dataLines = rawTable3.slice(dataStartIndex)

    // We'll build an array of { file_no, size_class, size_value } with numeric conversions
    const melted: Array<{
      file_no: string
      size_class: number
      size_value: number
    }> = []

    dataLines.forEach((lineStr) => {
      if (!lineStr.trim()) {
        return
      }
      const cols = lineStr.split("\t").map((c) => c.trim())
      if (cols.length < 3) {
        return
      }
      const scFloat = Number.parseFloat(cols[1].replace(",", "."))
      if (isNaN(scFloat)) {
        return
      }
      finalHeaderCols.forEach((fileNo, i) => {
        const rawVal = cols[i + 2] || ""
        const valFloat = Number.parseFloat(rawVal.replace(",", "."))
        const finalVal = isNaN(valFloat) ? 0 : valFloat
        melted.push({
          file_no: fileNo,
          size_class: scFloat,
          size_value: finalVal,
        })
      })
    })

    // 3) Insert a row for each file_no with size_class=0.1 => size_value=0
    const uniqueFileNos = Array.from(new Set(melted.map((r) => r.file_no)))
    const defaultRows: typeof melted = uniqueFileNos.map((fn) => ({
      file_no: fn,
      size_class: 0.1,
      size_value: 0,
    }))

    // 4) Combine & sort
    const combined = [...defaultRows, ...melted]
    combined.sort((a, b) => {
      const fComp = a.file_no.localeCompare(b.file_no)
      if (fComp !== 0) return fComp
      return a.size_class - b.size_class
    })

    // 5) Map to final shape (stringifying size_class, size_value if desired)
    const finalSizeClass = combined.map((row) => ({
      file_no: row.file_no,
      size_class: row.size_class.toString(),
      size_value: row.size_value.toString(),
      file_name: fileName,
      file_name_file_no: `${fileName}_${row.file_no}`,
    }))

    return {
      dataTable: metadataTable,
      sizeClassTable: finalSizeClass,
    }
  } catch (error) {
    const errMsg = `Parsing failed: ${(error as Error).message}`
    console.error(errMsg, error)
    throw error
  }
}

/**
 * Helper to read a File as UTF-16 text, returning a Promise of the text
 */
function readFileAsText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      resolve((e.target?.result as string) || "")
    }
    reader.onerror = (err) => {
      reject(err)
    }
    reader.readAsText(file, "utf-16")
  })
}
