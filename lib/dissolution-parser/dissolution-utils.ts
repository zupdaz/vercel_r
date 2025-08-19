// Helper functions
export function strToDateTime(dateVal: any): Date | null {
  if (dateVal instanceof Date) {
    return dateVal
  }

  const dateStr = String(dateVal)

  try {
    // Try to parse the date
    const date = new Date(dateStr)
    if (!isNaN(date.getTime())) {
      return date
    }
  } catch (e) {
    // Ignore parsing errors
  }

  // Try specific formats
  const formats = ["DD.MM.YYYY", "DD.MM.YYYY HH:mm:ss"]
  for (const fmt of formats) {
    try {
      const parsedDate = new Date(dateStr)
      if (!isNaN(parsedDate.getTime())) {
        return parsedDate
      }
    } catch (e) {
      // Continue to next format
    }
  }

  return null
}

export function extractNumericValue(s: any): number | null {
  if (s === null || s === undefined || s === "") {
    return null
  }

  const str = String(s)
  const match = str.match(/\d+/)
  return match ? Number.parseInt(match[0], 10) : null
}

export function extractAPxValue(s: any): string {
  if (typeof s !== "string") {
    return s
  }

  const match = s.match(/Ap\.?\s*(I{1,4})/i)
  if (match) {
    const romanNumeral = match[1].toUpperCase()
    const romanToInt: Record<string, string> = {
      I: "1",
      II: "2",
      III: "3",
      IIII: "4",
      IV: "4",
    }
    return "AP" + (romanToInt[romanNumeral] || romanNumeral)
  }

  return s
}

export function isNotNa(value: any): boolean {
  return value !== null && value !== undefined && value !== ""
}

export function extractTrial(s: string): [string, string | undefined] {
  if (!s) return [s, undefined]

  const pattern = /([A-Z][A-Z0-9][A-Z]\d{2}-[A-Z\d][A-Z]\d+[A-Z]?)\s*,?\s*(.*)/i
  const match = s.match(pattern)
  if (match) {
    return [match[1], match[2]?.trim() || undefined]
  }
  return [s, undefined]
}

// Combine field helpers
export function combineAparaturaValues(row: Record<string, any>): string | null {
  const mixingElement = row["mixing_element"]
  const basketType = row["basket_type"]
  const basketSet = row["basket_set"]
  const sinker = row["sinker"]

  let result = ""
  if (isNotNa(mixingElement) && String(mixingElement).toLowerCase() !== "brez") {
    result += String(mixingElement)

    if (["Ap. I - košarice", "Ap. II + stranska košarica", "Ap. II - stranska košarica"].includes(mixingElement)) {
      if (isNotNa(basketType) && String(basketType).toLowerCase() !== "brez") {
        result += `, ${basketType}`
        if (isNotNa(basketSet) && String(basketSet).toLowerCase() !== "brez") {
          result += ` (${basketSet})`
        }
      }
    }
  }

  if (isNotNa(sinker) && String(sinker).toLowerCase() !== "brez") {
    if (result) {
      result += ", "
    }
    result += String(sinker)
  }

  return result || null
}

export function combineAparatura2Values(row: Record<string, any>): string | null {
  const mixingElement = row["mixing_element"]
  const basketType = row["basket_type"]
  const sinker = row["sinker"]

  let result = ""
  if (isNotNa(mixingElement)) {
    result += String(mixingElement)
    if (["Ap. I - košarice", "Ap. II + stranska košarica", "Ap. II - stranska košarica"].includes(mixingElement)) {
      if (isNotNa(basketType)) {
        result += `, ${basketType}`
      }
    }
  }

  if (isNotNa(sinker) && String(sinker).toLowerCase() !== "brez") {
    if (result) {
      result += ", "
    }
    result += String(sinker)
  }

  return result || null
}

export function combineDissAparaturaValues(row: Record<string, any>): string | null {
  const dissolutionApparatus = row["dissolution_apparatus"]
  const dissApparatusInternalCode = row["diss_apparatus_internal_code"]

  if (isNotNa(dissolutionApparatus) && isNotNa(dissApparatusInternalCode)) {
    return `${dissolutionApparatus}, ${dissApparatusInternalCode}`
  } else if (isNotNa(dissolutionApparatus)) {
    return dissolutionApparatus
  } else if (isNotNa(dissApparatusInternalCode)) {
    return dissApparatusInternalCode
  } else {
    return null
  }
}

export function combineMedijValues(row: Record<string, any>): string | null {
  const mediaShortCode = row["media_short_code"]
  const mediaPh = row["media_ph"]
  const mediaSurfactant = row["media_surfactant"]
  const mediaSurfactantPercentage = row["media_surfactant_percentage"]
  const mediaTemperature = row["media_temperature"]

  const isValid = (value: any) => {
    return isNotNa(value) && String(value) !== "/" && String(value).toLowerCase() !== "brez"
  }

  let result = ""
  if (isValid(mediaShortCode)) {
    result += String(mediaShortCode)
  }

  if (isValid(mediaShortCode) && isValid(mediaPh)) {
    result += `, pH ${mediaPh}`
  }

  if (isValid(mediaShortCode) && isValid(mediaTemperature)) {
    result += `, ${mediaTemperature}°C`
  }

  if (isValid(mediaShortCode) && isValid(mediaSurfactant) && isValid(mediaSurfactantPercentage)) {
    result += ` + ${mediaSurfactantPercentage}% ${mediaSurfactant}`
  }

  return result || null
}

export function combineObratiValues(row: Record<string, any>): string | null {
  const increasedRpm = row["increased_rpm"]
  let increasedRpmSpeed = row["increased_rpm_speed"]
  let increasedRpmStartTime = row["increased_rpm_start_time"]
  let increasedRpmDuration = row["increased_rpm_duration"]

  if (typeof increasedRpmSpeed === "string" && increasedRpmSpeed.toLowerCase() === "brez") {
    increasedRpmSpeed = null
  }
  if (typeof increasedRpmStartTime === "string" && increasedRpmStartTime.toLowerCase() === "brez") {
    increasedRpmStartTime = null
  }
  if (typeof increasedRpmDuration === "string" && increasedRpmDuration.toLowerCase() === "brez") {
    increasedRpmDuration = null
  }

  let result = ""
  if (
    String(increasedRpm || "")
      .trim()
      .toLowerCase() === "da" &&
    increasedRpmSpeed !== null
  ) {
    result += `${Number.parseInt(String(increasedRpmSpeed), 10)} obr./min`
    if (increasedRpmStartTime !== null && increasedRpmDuration !== null) {
      const startMin = Number.parseInt(String(increasedRpmStartTime), 10)
      const endMin =
        Number.parseInt(String(increasedRpmStartTime), 10) + Number.parseInt(String(increasedRpmDuration), 10)
      result += ` (${startMin} → ${endMin}min)`
    }
  }

  return result || null
}

export function combineVrednotenjeValues(row: Record<string, any>): string | null {
  const evaluation = row["evaluation"]
  const hplc = row["hplc"]
  const hplcInternalCode = row["hplc_internal_code"]
  const uvCuvette = row["uv_cuvette"]

  const parts = []
  if (isNotNa(evaluation)) {
    parts.push(String(evaluation))
  }

  if (isNotNa(hplc)) {
    parts.push(String(hplc))
  }

  if (isNotNa(hplcInternalCode)) {
    parts.push(String(hplcInternalCode))
  }

  if (
    isNotNa(uvCuvette) &&
    String(evaluation || "")
      .trim()
      .toLowerCase() === "uv"
  ) {
    parts.push(`kiveta: ${uvCuvette}`)
  }

  return parts.length > 0 ? parts.join(", ") : null
}
