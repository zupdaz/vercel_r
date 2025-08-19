import * as XLSX from "xlsx"
import { Logger } from "../parser-utils"
import {
  strToDateTime,
  extractNumericValue,
  extractAPxValue,
  combineAparaturaValues,
  combineAparatura2Values,
  combineDissAparaturaValues,
  combineMedijValues,
  combineObratiValues,
  combineVrednotenjeValues,
} from "./dissolution-utils"
// Import the fuzzy matching function at the top of the file
import { findClosestActiveIngredient } from "../services/active-ingredient-service"

export async function parseMethodData(file: File, logCallback: (log: string) => void): Promise<any[]> {
  const logger = new Logger(logCallback)
  logger.info(`Starting to parse method data from file: ${file.name}`)

  const methodRecords: Record<string, any>[] = []
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

      const lowerName = sheetName.toLowerCase()

      // Process only sheets that include 'izračun' or 'izracun' but skip 'formule'
      if ((lowerName.includes("izračun") || lowerName.includes("izracun")) && !lowerName.includes("formule")) {
        logger.info(`Processing method sheet: ${sheetName}`)

        try {
          // Convert the sheet into a 2D array of rows
          const sheetData = XLSX.utils.sheet_to_json<any[]>(workbook.Sheets[sheetName], {
            header: 1,
            defval: null,
            range: 0, // read from the top
          })

          // Skip empty or invalid sheets
          if (sheetData.length < 5) {
            logger.warn(`Sheet ${sheetName} skipped: insufficient rows.`)
            continue
          }

          // Attempt to retrieve active ingredient and API strength
          const activeIngredientDiss = sheetData[4]?.[2] || null

          // Add this code to apply fuzzy matching with better logging:
          let matchedActiveIngredient = activeIngredientDiss
          if (activeIngredientDiss && typeof activeIngredientDiss === "string") {
            logger.info(`Attempting to match active ingredient: "${activeIngredientDiss}"`)
            matchedActiveIngredient = await findClosestActiveIngredient(activeIngredientDiss)
            if (matchedActiveIngredient !== activeIngredientDiss) {
              logger.info(
                `Successfully matched active ingredient "${activeIngredientDiss}" to "${matchedActiveIngredient}" from reference list`,
              )
            } else {
              logger.warn(`No match found for active ingredient "${activeIngredientDiss}" in reference list`)
            }
          }

          const apiStrengthDiss = sheetData[5]?.[2] || null

          const rec: Record<string, any> = {
            file_name: fileName,
            sheet_name: sheetName,
            active_ingredient_diss: matchedActiveIngredient,
            api_strength_diss: apiStrengthDiss,
            file_name_active_ing: `${fileName}_${matchedActiveIngredient}`,
          }

          // Apparatus data from row 19
          try {
            const row19 = sheetData[20] || []
            rec.mixing_element = row19[0]
            rec.rotation_speed = extractNumericValue(row19[1])
            rec.basket_type = row19[2]
            rec.basket_set = row19[3]
            rec.sinker = row19[7]
            rec.dissolution_apparatus = row19[9]
            rec.diss_apparatus_internal_code = row19[10]
          } catch (e) {
            logger.error(`Missing apparatus data in sheet ${sheetName}: ${e.message}`)
          }

          // Increased parameters (rows 19-22)
          try {
            const row19 = sheetData[20] || []
            const row20 = sheetData[21] || []
            const row21 = sheetData[22] || []
            const row22 = sheetData[23] || []

            rec.increased_rpm = row19[4]
            rec.increased_rpm_speed = extractNumericValue(row20[4])
            rec.increased_rpm_start_time = extractNumericValue(row21[4])
            rec.increased_rpm_duration = extractNumericValue(row22[4])
          } catch (e) {
            logger.error(`Missing increased parameters in sheet ${sheetName}: ${e.message}`)
          }

          // Medium information (row 25)
          try {
            const row25 = sheetData[26] || []
            rec.media_short_code = row25[0]
            rec.media_ph = row25[1]
            rec.media_temperature = row25[2]
            rec.media_bath_temperature = row25[3]
            rec.media_surfactant = row25[4]
            rec.media_surfactant_percentage = row25[5]
            rec.media_heating = row25[7]
          } catch (e) {
            logger.error(`Missing medium information in sheet ${sheetName}: ${e.message}`)
          }

          // Dilution information (rows 61-62)
          try {
            const row61 = sheetData[62] || []
            const row62 = sheetData[63] || []
            rec.dilution_counter = row61[3]
            rec.dilution_denominator = row62[3]
            rec.dilution_note = row61[5]
          } catch (e) {
            logger.error(`Missing dilution info in sheet ${sheetName}: ${e.message}`)
          }

          // Additional method fields
          try {
            const row19 = sheetData[20] || []
            const row27 = sheetData[28] || []
            const row29 = sheetData[30] || []

            rec.vessel_type = row19[5]
            rec.volume = row27[1]
            rec.aliquot = row29[1]
            rec.filters = row29[3]
            rec.sampling = row29[5]
            rec.media_return = sheetData[1]?.[1]
          } catch (e) {
            logger.error(`Missing additional method fields in sheet ${sheetName}: ${e.message}`)
          }

          // Instrumentation / analysis fields
          try {
            const row29 = sheetData[30] || []
            const row30 = sheetData[31] || []

            rec.evaluation = row29[7]
            rec.hplc = row29[8]
            rec.hplc_internal_code = row29[9]
            rec.hplc_wavelength = row30[9]
            rec.uv_cuvette = row29[10]
          } catch (e) {
            logger.error(`Missing instrumentation fields in sheet ${sheetName}: ${e.message}`)
          }

          // People, logs, and date info
          try {
            const row65 = sheetData[66] || []
            const row66 = sheetData[67] || []
            const row67 = sheetData[68] || []
            const row68 = sheetData[69] || []
            const row69 = sheetData[70] || []
            const row3 = sheetData[4] || []

            rec.diss_operator = row65[1]
            rec.hplc_operator = row66[1]
            rec.analytical_procedure = row67[1]
            rec.diss_log = row68[1]
            rec.hplc_log = row69[1]
            rec.analysis_date = row3[10]
            if (rec.analysis_date) {
              rec.analysis_date = strToDateTime(rec.analysis_date)
            }
          } catch (e) {
            logger.error(`Missing people or date info in sheet ${sheetName}: ${e.message}`)
          }

          // Combined/derived fields
          rec.apparatus_short = extractAPxValue(rec.mixing_element)
          rec.combined_apparatus = combineAparaturaValues(rec)
          rec.combined_apparatus_without_baskets = combineAparatura2Values(rec)
          rec.combined_diss_apparatus = combineDissAparaturaValues(rec)
          rec.combined_evaluation = combineVrednotenjeValues(rec)
          rec.combined_media = combineMedijValues(rec)
          rec.combined_increased_rpm = combineObratiValues(rec)

          methodRecords.push(rec)
          logger.info(`Successfully processed method sheet: ${sheetName}`)
        } catch (e) {
          logger.error(`Error processing method sheet ${sheetName}: ${e.message}`)
          logger.error(`Stack trace: ${e.stack}`)
        }
      }
    }

    logger.info(`Finished processing method sheets. Parsed ${methodRecords.length} record(s)`)
    return methodRecords
  } catch (error) {
    const errMsg = `Parsing failed: ${error.message}`
    logger.error(errMsg, error)
    throw error
  }
}
