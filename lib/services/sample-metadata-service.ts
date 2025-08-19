import { getSupabaseClient } from "./supabase-service"

// Save unique MRA numbers from parsed files
export async function saveSampleMetadata(
  projectId: string,
  fileName: string,
  mraNumbers: string[],
): Promise<{ success: boolean; message: string }> {
  try {
    const supabase = getSupabaseClient()

    // Filter out empty or null MRA numbers
    const validMraNumbers = mraNumbers.filter((mra) => mra && mra.trim().length > 0)

    if (validMraNumbers.length === 0) {
      return {
        success: true,
        message: "No valid MRA numbers found to save",
      }
    }

    // Check for existing entries
    const { data: existingEntries } = await supabase
      .from("sample_metadata")
      .select("id, mra_no")
      .eq("project_id", projectId)
      .eq("file_name", fileName)

    // Delete existing entries for this file if they exist
    if (existingEntries && existingEntries.length > 0) {
      await supabase.from("sample_metadata").delete().eq("file_name", fileName).eq("project_id", projectId)
    }

    // Create new entries for each unique MRA number
    const uniqueMraNumbers = [...new Set(validMraNumbers)]
    const entries = uniqueMraNumbers.map((mra_no) => ({
      project_id: projectId,
      file_name: fileName,
      mra_no,
      created_at: new Date(),
    }))

    // Insert the entries
    const { error } = await supabase.from("sample_metadata").insert(entries)

    if (error) throw error

    return {
      success: true,
      message: `Saved ${uniqueMraNumbers.length} unique MRA numbers`,
    }
  } catch (error) {
    console.error("Error saving sample metadata:", error)
    return {
      success: false,
      message: `Failed to save sample metadata: ${error instanceof Error ? error.message : String(error)}`,
    }
  }
}
