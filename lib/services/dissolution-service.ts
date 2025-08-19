import { getSupabaseClient } from "./supabase-service"

/**
 * Updates method_diss_short and method_diss_combined fields in the dissolution_method table
 * using a direct SQL query with CTEs and window functions.
 * Only processes records where needs_recalculation = TRUE.
 *
 * @param projectId Optional project ID to limit the update to a specific project
 * @returns Object indicating success/failure and a message
 */
export async function updateDissolutionMethodShortCodes(
  projectId?: string,
): Promise<{ success: boolean; message: string; recordsUpdated?: number }> {
  try {
    const supabase = getSupabaseClient()

    // First, check if there are any records that need recalculation
    const { count, error: countError } = await supabase
      .from("dissolution_method")
      .select("id", { count: "exact", head: true })
      .eq("needs_recalculation", true)
      .eq(projectId ? "project_id" : "needs_recalculation", projectId || true)

    if (countError) {
      throw countError
    }

    // If no records need recalculation, return early
    if (count === 0) {
      return {
        success: true,
        message: "No dissolution method records need recalculation",
        recordsUpdated: 0,
      }
    }

    // Get all project IDs that have records needing recalculation
    // This is necessary because we need to recalculate all records in affected projects
    // to maintain consistent rankings
    const { data: projectsToUpdate, error: projectsError } = await supabase
      .from("dissolution_method")
      .select("project_id", { count: "exact" })
      .eq("needs_recalculation", true)

    // If a specific project ID was provided, filter to just that project
    const filteredProjects = projectId ? projectsToUpdate.filter((p) => p.project_id === projectId) : projectsToUpdate

    // Get unique project IDs
    const projectIds = [...new Set(filteredProjects.map((p) => p.project_id))]

    // For each affected project, recalculate all records in that project
    // This ensures consistent rankings within each project
    let totalUpdated = 0

    for (const pid of projectIds) {
      // The SQL query uses CTEs and window functions to calculate method_diss_short and method_diss_combined
      // We process all records in the project, but only update those that need recalculation
      const query = `
        WITH FirstCTE AS (
          SELECT 
            id, 
            project_id, 
            apparatus_short, 
            DENSE_RANK() OVER (
              PARTITION BY project_id 
              ORDER BY combined_apparatus_without_baskets, combined_media, volume, rotation_speed, vessel_type
            ) AS rank_value 
          FROM dissolution_method
          WHERE project_id = '${pid}'
        ),
        SecondCTE AS (
          SELECT 
            dm.id, 
            dm.project_id, 
            (f.apparatus_short || '-' || CAST(f.rank_value AS VARCHAR)) AS new_method_diss_short,
            DENSE_RANK() OVER (
              PARTITION BY dm.project_id, (f.apparatus_short || '-' || CAST(f.rank_value AS VARCHAR))
              ORDER BY dm.aliquot, dm.combined_increased_rpm, dm.evaluation, dm.basket_set, dm.media_heating, dm.media_return, dm.sampling, dm.filters, dm.combined_apparatus
            ) AS method_diss_second
          FROM dissolution_method dm
          JOIN FirstCTE f ON dm.id = f.id
        ),
        UpdatedRecords AS (
          UPDATE dissolution_method dm
          SET 
            method_diss_short = TRIM(dm.project_id) || '_' || s.new_method_diss_short,
            method_diss_combined = TRIM(dm.project_id) || '_' || s.new_method_diss_short || '.' || CAST(s.method_diss_second AS VARCHAR),
            needs_recalculation = FALSE
          FROM SecondCTE s
          WHERE dm.id = s.id AND dm.needs_recalculation = TRUE
          RETURNING dm.id
        )
        SELECT COUNT(*) FROM UpdatedRecords
      `

      // Execute the raw SQL query
      const { data, error } = await supabase.rpc(
        "exec_sql",
        {
          sql: query,
        },
        { count: "exact" },
      )

      if (error) {
        console.error(`Error executing dissolution method update query for project ${pid}:`, error)
        throw error
      }

      // Add the count of updated records for this project
      if (data && data[0] && data[0].count) {
        totalUpdated += Number.parseInt(data[0].count)
      }
    }

    // After updating method short codes, update analysis_no and replicate in dissolution_sample
    const updateResult = await updateDissolutionSampleAnalysisAndReplicate(projectId)

    if (!updateResult.success) {
      console.warn("Warning: Failed to update analysis_no and replicate values:", updateResult.message)
    }

    return {
      success: true,
      message: `Successfully updated ${totalUpdated} dissolution method records and their related sample records`,
      recordsUpdated: totalUpdated,
    }
  } catch (error) {
    console.error("Failed to update dissolution method short codes:", error)
    return {
      success: false,
      message: `Failed to update dissolution method short codes: ${error instanceof Error ? error.message : String(error)}`,
    }
  }
}

/**
 * Updates analysis_no and replicate columns in the dissolution_sample table
 * based on the method_diss_short values in the dissolution_method table.
 * Only processes records where needs_recalculation = TRUE.
 *
 * @param projectId Optional project ID to limit the update to a specific project
 * @returns Object indicating success/failure and a message
 */
export async function updateDissolutionSampleAnalysisAndReplicate(
  projectId?: string,
): Promise<{ success: boolean; message: string; recordsUpdated?: number }> {
  try {
    const supabase = getSupabaseClient()

    // First, check if there are any records that need recalculation
    const { count, error: countError } = await supabase
      .from("dissolution_sample")
      .select("id", { count: "exact", head: true })
      .eq("needs_recalculation", true)
      .eq(projectId ? "project_id" : "needs_recalculation", projectId || true)

    if (countError) {
      throw countError
    }

    // If no records need recalculation, return early
    if (count === 0) {
      return {
        success: true,
        message: "No dissolution sample records need recalculation",
        recordsUpdated: 0,
      }
    }

    // Get all unique combinations of mra_no, method_diss_short, and active_ingredient_diss
    // that have records needing recalculation
    let query = supabase
      .from("dissolution_sample")
      .select(`
        mra_no,
        file_name_active_ing
      `)
      .eq("needs_recalculation", true)

    // If a project ID was provided, add that filter
    if (projectId) {
      query = query.eq("project_id", projectId)
    }

    const { data: groupsToUpdate, error: groupsError } = await query

    if (groupsError) {
      throw groupsError
    }

    // For each affected group, recalculate all records in that group
    let totalUpdated = 0

    // Execute the SQL query using RPC (Remote Procedure Call)
    // We'll use the exec_sql function created in the migration
    const sql = `
    WITH AnalysisCTE AS (
      SELECT
        s.id,
        s.mra_no,
        m.method_diss_short,
        m.active_ingredient_diss,
        s.file_name,
        s.vessel_no,
        DENSE_RANK() OVER (
          PARTITION BY s.mra_no, m.method_diss_short, m.active_ingredient_diss
          ORDER BY s.file_name
        ) AS analysis_no_rank
      FROM dissolution_sample s
      INNER JOIN dissolution_method m 
        ON s.file_name_active_ing = m.file_name_active_ing
      WHERE 
        (s.needs_recalculation = TRUE OR 
         EXISTS (
           SELECT 1 FROM dissolution_sample s2 
           WHERE s2.mra_no = s.mra_no 
           AND s2.needs_recalculation = TRUE
         ))
        ${projectId ? `AND s.project_id = '${projectId}'` : ""}
    ),
    FinalCTE AS (
      SELECT
        id,
        analysis_no_rank,
        DENSE_RANK() OVER (
          PARTITION BY mra_no, method_diss_short, active_ingredient_diss
          ORDER BY analysis_no_rank, vessel_no
        ) AS replicate_rank
      FROM AnalysisCTE
    ),
    UpdatedRecords AS (
      UPDATE dissolution_sample s
      SET 
        analysis_no = f.analysis_no_rank,
        replicate = f.replicate_rank,
        needs_recalculation = FALSE
      FROM FinalCTE f
      WHERE s.id = f.id AND s.needs_recalculation = TRUE
      RETURNING s.id
    )
    SELECT COUNT(*) FROM UpdatedRecords
    `

    // Execute the SQL using the exec_sql function
    const { data, error } = await supabase.rpc(
      "exec_sql",
      {
        sql,
      },
      { count: "exact" },
    )

    if (error) {
      throw error
    }

    // Get the count of updated records
    if (data && data[0] && data[0].count) {
      totalUpdated = Number.parseInt(data[0].count)
    }

    return {
      success: true,
      message: `Successfully updated ${totalUpdated} dissolution sample records`,
      recordsUpdated: totalUpdated,
    }
  } catch (error) {
    console.error("Failed to update analysis_no and replicate values:", error)
    return {
      success: false,
      message: `Failed to update analysis_no and replicate values: ${error instanceof Error ? error.message : String(error)}`,
    }
  }
}
