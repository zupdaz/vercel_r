import { getSupabaseClient } from "./supabase-service"
import Fuse from "fuse.js"

// Cache for active ingredients to avoid repeated fetches
let activeIngredientsCache: string[] | null = null

/**
 * Fetches active ingredients from the Supabase table
 */
export async function fetchActiveIngredients(): Promise<string[]> {
  // Return cached data if available
  if (activeIngredientsCache) {
    return activeIngredientsCache
  }

  try {
    const supabase = getSupabaseClient()

    // Fetch active ingredients from the active_ingredient table
    const { data, error } = await supabase.from("active_ingredient").select("api0, api1")

    if (error) {
      console.error("Error fetching active ingredients:", error)
      return []
    }

    // Combine api0 and api1 columns into a single list, filtering out nulls
    const ingredients: string[] = []
    data.forEach((row) => {
      if (row.api0) ingredients.push(row.api0)
      if (row.api1) ingredients.push(row.api1)
    })

    // Cache the results
    activeIngredientsCache = ingredients

    return ingredients
  } catch (error) {
    console.error("Failed to fetch active ingredients:", error)
    return []
  }
}

// Modify the findClosestActiveIngredient function to improve matching
export async function findClosestActiveIngredient(inputString: string, threshold = 80): Promise<string> {
  if (!inputString) return inputString

  try {
    const ingredients = await fetchActiveIngredients()

    if (ingredients.length === 0) {
      return inputString
    }

    // Normalize input string for better matching
    const normalizedInput = inputString.toLowerCase().replace(/\s+/g, " ").trim()

    // Check for exact match first (case insensitive)
    const exactMatch = ingredients.find((ing) => ing.toLowerCase() === normalizedInput)

    if (exactMatch) {
      return exactMatch
    }

    // Configure Fuse.js with better options for pharmaceutical names
    const options = {
      includeScore: true,
      threshold: 1.0 - threshold / 100, // Convert threshold to Fuse.js format (0-1)
      keys: ["name"],
      // Add these options for better matching
      ignoreLocation: true, // Ignore location for better matching of rearranged words
      findAllMatches: true, // Find all matches in the string
      useExtendedSearch: true, // Use extended search for better partial matching
    }

    // Prepare data for Fuse.js
    const fuseData = ingredients.map((name) => ({ name }))
    const fuse = new Fuse(fuseData, options)

    // Search for the closest match
    const result = fuse.search(normalizedInput)

    // Return the best match if found, otherwise return the original string
    if (result.length > 0 && result[0].score !== undefined && result[0].score <= 1.0 - threshold / 100) {
      return result[0].item.name
    }

    // If no match found with the current threshold, try with a lower threshold
    // This helps with pharmaceutical names that might have different spellings
    if (result.length > 0 && result[0].score !== undefined) {
      // Use a more lenient threshold for pharmaceutical names
      const lenientThreshold = 60 // Lower threshold for pharmaceutical names
      if (result[0].score <= 1.0 - lenientThreshold / 100) {
        return result[0].item.name
      }
    }

    return inputString
  } catch (error) {
    console.error("Error in fuzzy matching:", error)
    return inputString
  }
}
