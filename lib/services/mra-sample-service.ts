import { getSupabaseClient } from "./supabase-service"
import type { SampleMetadata, MaterialiRAResult } from "../types"
import { FEATURES } from "../settings"

// Save unique MRA numbers from parsed files
export async function saveSampleMetadata(
  fileName: string,
  mraData: Array<{ mra_no: string; batch_diss?: string; batch_cam?: string }>,
): Promise<{ success: boolean; message: string }> {
  try {
    const supabase = getSupabaseClient()

    // Filter out empty or null MRA numbers
    const validMraData = mraData.filter((item) => item.mra_no && item.mra_no.trim().length > 0)

    if (validMraData.length === 0) {
      return {
        success: true,
        message: "No valid MRA numbers found to save",
      }
    }

    // Extract unique MRA numbers
    const uniqueMraNumbers = [...new Set(validMraData.map((item) => item.mra_no))]

    // Check which MRA numbers already exist in the database
    const { data: existingMraData } = await supabase
      .from("sample_metadata")
      .select("mra_no")
      .in("mra_no", uniqueMraNumbers)

    const existingMraNumbers = existingMraData?.map((item) => item.mra_no) || []

    // Filter out MRA numbers that already exist for insertion
    const newMraNumbers = uniqueMraNumbers.filter((mra) => !existingMraNumbers.includes(mra))

    // Create entries for new MRA numbers
    const newEntries = newMraNumbers.map((mra_no) => {
      const matchingData = validMraData.find((item) => item.mra_no === mra_no)
      return {
        file_name: fileName,
        mra_no,
        batch_diss: matchingData?.batch_diss || null,
        batch_cam: matchingData?.batch_cam || null,
        created_at: new Date(),
      }
    })

    // Insert new entries
    if (newEntries.length > 0) {
      const { error: insertError } = await supabase.from("sample_metadata").insert(newEntries)

      if (insertError) throw insertError
    }

    // Update existing entries with new batch information
    for (const existingMra of existingMraNumbers) {
      const matchingData = validMraData.find((item) => item.mra_no === existingMra)

      // Only update if we have batch information
      if (matchingData?.batch_diss || matchingData?.batch_cam) {
        const updateData: any = {
          file_name: fileName, // Update the file name to the most recent file
          updated_at: new Date(),
        }

        // Only include fields that have values
        if (matchingData.batch_diss) {
          updateData.batch_diss = matchingData.batch_diss
        }

        if (matchingData.batch_cam) {
          updateData.batch_cam = matchingData.batch_cam
        }

        const { error: updateError } = await supabase
          .from("sample_metadata")
          .update(updateData)
          .eq("mra_no", existingMra)

        if (updateError) throw updateError
      }
    }

    // If MaterialiRA connection is enabled, fetch additional data for new MRA numbers
    if (FEATURES.ENABLE_MATERIALIA_RA_CONNECTION) {
      await updateSamplesWithMaterialiRAData(newMraNumbers)
    }

    return {
      success: true,
      message: `Saved ${newMraNumbers.length} new MRA numbers and updated ${existingMraNumbers.length} existing records`,
    }
  } catch (error) {
    console.error("Error saving sample metadata:", error)
    return {
      success: false,
      message: `Failed to save sample metadata: ${error instanceof Error ? error.message : String(error)}`,
    }
  }
}

// Query MaterialiRA database and update samples
async function updateSamplesWithMaterialiRAData(mraNumbers: string[]): Promise<void> {
  try {
    // For each MRA number, query the MaterialiRA database
    for (const mraNo of mraNumbers) {
      // Query MaterialiRA database
      const materialiraData = await queryMaterialiRADatabase(mraNo)

      if (materialiraData) {
        // Update the sample entry with the MaterialiRA data
        const supabase = getSupabaseClient()
        await supabase
          .from("sample_metadata")
          .update({
            batch_ra: materialiraData.batch_ra,
            intermediate_form_ra: materialiraData.intermediate_form_ra,
            name_ra: materialiraData.name_ra,
            api_strength_ra: materialiraData.api_strength_ra,
            marocilnica_ra: materialiraData.marocilnica_ra,
            ra_link: materialiraData.ra_link,
            updated_at: new Date(),
          })
          .eq("mra_no", mraNo)
      }
    }
  } catch (error) {
    console.error("Error updating samples with MaterialiRA data:", error)
  }
}

// Query the MaterialiRA database
async function queryMaterialiRADatabase(mraNo: string): Promise<MaterialiRAResult | null> {
  try {
    // This is a placeholder for the actual implementation
    // In a real implementation, you would use a server-side API to query the SQL Server database

    // For now, we'll just return a mock result
    console.log(`Querying MaterialiRA database for MRA number: ${mraNo}`)

    // Mock implementation - in production, this would be a real API call
    return {
      marocilnica_ra: "MOCK_MAROCILNICA",
      mra_no: mraNo,
      batch_ra: "MOCK_BATCH",
      intermediate_form_ra: "tableta",
      name_ra: "MOCK_NAME",
      api_strength_ra: "10 mg",
      ra_link: `https://vms-nt2241/MaterialiRA/Common/Document/List?typeid=19&linkid=MOCK_ID`,
    }

    // In a real implementation, you would make an API call to a server-side endpoint
    // that would execute the SQL query against the MaterialiRA database
    /*
    const response = await fetch('/api/query-materialia', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ mraNo }),
    });
    
    if (!response.ok) {
      throw new Error(`Failed to query MaterialiRA database: ${response.statusText}`);
    }
    
    return await response.json();
    */
  } catch (error) {
    console.error("Error querying MaterialiRA database:", error)
    return null
  }
}

// Get all samples
export async function getSampleMetadata(): Promise<SampleMetadata[]> {
  try {
    const supabase = getSupabaseClient()

    const { data, error } = await supabase.from("sample_metadata").select("*").order("created_at", { ascending: false })

    if (error) throw error

    return data || []
  } catch (error) {
    console.error("Error fetching sample metadata:", error)
    return []
  }
}
