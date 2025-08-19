import { createClient } from "@supabase/supabase-js"
import type { SupabaseClient } from "@supabase/supabase-js"

// Initialize Supabase client
let supabaseClient: SupabaseClient | null = null

function getSupabaseClient() {
  if (supabaseClient) return supabaseClient

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!supabaseUrl || !supabaseKey) {
    throw new Error("Supabase credentials not found in environment variables")
  }

  supabaseClient = createClient(supabaseUrl, supabaseKey)
  return supabaseClient
}

// Add this export at the top of the file, after the getSupabaseClient function definition
export { getSupabaseClient }

// Add this function to handle field renaming during data saving
function renameFields(data: any[]): any[] {
  return data.map((item) => {
    const newItem = { ...item }

    // If the item has a 'replicate' field, rename it to 'vessel_no'
    if ("replicate" in newItem) {
      newItem.vessel_no = newItem.replicate
      delete newItem.replicate
    }

    return newItem
  })
}

// Update the sanitizeData function to properly handle empty strings for numeric fields
function sanitizeData(data: any[]): any[] {
  return data.map((item) => {
    const sanitizedItem = { ...item }

    // Remove any problematic columns that should have been renamed
    delete sanitizedItem["Comment 1"]
    delete sanitizedItem["Comment 2"]

    // Ensure all column names are lowercase to match database schema
    const result: Record<string, any> = {}
    Object.keys(sanitizedItem).forEach((key) => {
      // Convert camelCase or PascalCase to snake_case for database compatibility
      const snakeCaseKey = key.replace(/([A-Z])/g, "_$1").toLowerCase()

      // Get the value
      const value = sanitizedItem[key]

      // Special handling for mra_no to ensure it's preserved as a string
      if (key === "mra_no" && value !== null && value !== undefined) {
        result[snakeCaseKey] = String(value).trim()
      }
      // Handle empty strings for numeric fields by converting them to null
      else if (value === "" || value === undefined) {
        result[snakeCaseKey] = null
      } else if (typeof value === "string" && !isNaN(Number(value.replace(",", ".")))) {
        // Convert numeric strings to actual numbers
        result[snakeCaseKey] = Number(value.replace(",", "."))
      } else {
        result[snakeCaseKey] = value
      }
    })

    return result
  })
}

// Save CSV data (particle size analysis)
export async function saveCSVData(
  fileName: string,
  projectId: string,
  dataTable: any[],
  sizeClassTable: any[],
): Promise<{ success: boolean; message: string }> {
  try {
    const supabase = getSupabaseClient()

    // First, check if data for this file already exists
    const { data: existingMetadata } = await supabase
      .from("particle_metadata")
      .select("id")
      .eq("file_name", fileName)
      .eq("project_id", projectId)

    const { data: existingSizeClass } = await supabase
      .from("particle_size_class")
      .select("id")
      .eq("file_name", fileName)
      .eq("project_id", projectId)

    // If data exists, delete it first
    if (existingMetadata && existingMetadata.length > 0) {
      await supabase.from("particle_metadata").delete().eq("file_name", fileName).eq("project_id", projectId)
    }

    if (existingSizeClass && existingSizeClass.length > 0) {
      await supabase.from("particle_size_class").delete().eq("file_name", fileName).eq("project_id", projectId)
    }

    // Sanitize and prepare data with project_id
    const sanitizedDataTable = sanitizeData(dataTable)
    const sanitizedSizeClassTable = sanitizeData(sizeClassTable)

    const metadataWithProject = sanitizedDataTable.map((item) => ({
      ...item,
      project_id: projectId,
      file_name: fileName,
    }))

    const sizeClassWithProject = sanitizedSizeClassTable.map((item) => ({
      ...item,
      project_id: projectId,
      file_name: fileName,
    }))

    // Log the first item to help with debugging
    console.log("First metadata item:", JSON.stringify(metadataWithProject[0] || {}))
    console.log("First size class item:", JSON.stringify(sizeClassWithProject[0] || {}))

    // Insert data in batches (Supabase has limits on payload size)
    const BATCH_SIZE = 500

    // Insert metadata in batches
    for (let i = 0; i < metadataWithProject.length; i += BATCH_SIZE) {
      const batch = metadataWithProject.slice(i, i + BATCH_SIZE)
      const { error: metadataError } = await supabase.from("particle_metadata").insert(batch)

      if (metadataError) throw metadataError
    }

    // Insert size class data in batches
    for (let i = 0; i < sizeClassWithProject.length; i += BATCH_SIZE) {
      const batch = sizeClassWithProject.slice(i, i + BATCH_SIZE)
      const { error: sizeClassError } = await supabase.from("particle_size_class").insert(batch)

      if (sizeClassError) throw sizeClassError
    }

    return {
      success: true,
      message: existingMetadata?.length ? "Data updated successfully" : "Data saved successfully",
    }
  } catch (error) {
    console.error("Error saving CSV data to Supabase:", error)
    // Add more detailed error information
    const errorMessage =
      error instanceof Error ? `${error.message}${error.stack ? `\nStack: ${error.stack}` : ""}` : String(error)

    return {
      success: false,
      message: `Failed to save particle size data: ${errorMessage}`,
    }
  }
}

// Save Excel data (dissolution testing)
export async function saveExcelData(
  fileName: string,
  projectId: string,
  methodData: any[],
  sampleData: any[],
): Promise<{ success: boolean; message: string }> {
  try {
    const supabase = getSupabaseClient()

    // Check if data for this file already exists
    const { data: existingMethod } = await supabase
      .from("dissolution_method")
      .select("id")
      .eq("file_name", fileName)
      .eq("project_id", projectId)

    const { data: existingSample } = await supabase
      .from("dissolution_sample")
      .select("id")
      .eq("file_name", fileName)
      .eq("project_id", projectId)

    // If data exists, delete it first
    if (existingMethod && existingMethod.length > 0) {
      await supabase.from("dissolution_method").delete().eq("file_name", fileName).eq("project_id", projectId)
    }

    if (existingSample && existingSample.length > 0) {
      await supabase.from("dissolution_sample").delete().eq("file_name", fileName).eq("project_id", projectId)
    }

    // Sanitize and prepare data with project_id
    const sanitizedMethodData = sanitizeData(methodData)
    const sanitizedSampleData = sanitizeData(sampleData)

    // Rename 'replicate' to 'vessel_no' in sample data
    const renamedSampleData = renameFields(sanitizedSampleData)

    // Add project_id, file_name, and needs_recalculation flag to each record
    const methodWithProject = sanitizedMethodData.map((item) => ({
      ...item,
      project_id: projectId,
      file_name: fileName,
      needs_recalculation: true, // Set the flag to true for new records
    }))

    const sampleWithProject = renamedSampleData.map((item) => ({
      ...item,
      project_id: projectId,
      file_name: fileName,
      needs_recalculation: true, // Set the flag to true for new records
    }))

    // Insert data in batches
    const BATCH_SIZE = 500

    // Insert method data in batches
    for (let i = 0; i < methodWithProject.length; i += BATCH_SIZE) {
      const batch = methodWithProject.slice(i, i + BATCH_SIZE)
      const { error: methodError } = await supabase.from("dissolution_method").insert(batch)

      if (methodError) throw methodError
    }

    // Insert sample data in batches
    for (let i = 0; i < sampleWithProject.length; i += BATCH_SIZE) {
      const batch = sampleWithProject.slice(i, i + BATCH_SIZE)

      // Log a sample of the data being inserted
      if (i === 0) {
        console.log(
          "Sample data first batch sample:",
          batch.slice(0, 3).map((item) => ({
            mra_no: item.mra_no,
            sample_diss: item.sample_diss,
            batch_diss: item.batch_diss,
          })),
        )
      }

      const { error: sampleError } = await supabase.from("dissolution_sample").insert(batch)

      if (sampleError) throw sampleError
    }

    return {
      success: true,
      message: existingMethod?.length ? "Data updated successfully" : "Data saved successfully",
    }
  } catch (error) {
    console.error("Error saving Excel data to Supabase:", error)
    return {
      success: false,
      message: `Failed to save data: ${error instanceof Error ? error.message : String(error)}`,
    }
  }
}

// Save legacy CSV data
export async function saveLegacyData(
  fileName: string,
  projectId: string,
  data: any[],
): Promise<{ success: boolean; message: string }> {
  try {
    // This is a placeholder function. Replace with actual implementation if needed.
    console.log(`Saving legacy data for ${fileName} to project ${projectId}`)
    console.log("Data:", data)
    return { success: true, message: "Legacy data saved successfully (placeholder)" }
  } catch (error) {
    console.error("Error saving legacy data:", error)
    return {
      success: false,
      message: `Failed to save legacy data: ${error instanceof Error ? error.message : String(error)}`,
    }
  }
}
