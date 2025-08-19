export function extractMethodShort(value: string): [string | null, string] {
  // Remove surrounding quotes (if present) and trim the value.
  const cleanValue = value.replace(/^"(.*)"$/, "$1").trim()
  const pattern = /^(M[0-9][;,:]?)(.*)/
  const match = cleanValue.match(pattern)
  if (match) {
    // Remove any trailing punctuation and return the two parts.
    return [match[1].replace(/[;,:]+$/, ""), match[2].trim()]
  }
  return [null, cleanValue]
}

/**
 * Extracts trial and intermediate form from a string.
 */
export function extractTrial(value: string): [string, string] {
  const pattern = /([^, ]+)[, ]?(.*)/
  const match = value.match(pattern)
  if (match) {
    return [match[1], match[2].trim()]
  }
  return [value, ""]
}

/**
 * Extracts a batch code from a string.
 */
export function extractTrialWithoutLetter(value: string): string {
  const pattern = /([A-Z]{3}\d{2}-\d[A-Z]\d{0,2})/i
  const match = value.match(pattern)
  return match ? match[1] : value
}
