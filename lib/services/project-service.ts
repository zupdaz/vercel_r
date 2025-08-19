import type { Project } from "../types"
import { getSupabaseClient } from "./supabase-service"

// Replace the dummy data with a function that fetches from Supabase
export async function getProjects(): Promise<Project[]> {
  try {
    const supabase = getSupabaseClient()

    const { data, error } = await supabase.from("active_projects").select("concept, active_project")

    if (error) {
      console.error("Error fetching projects:", error)
      throw error
    }

    // Map the data to match the Project type
    return data.map((item) => ({
      id: item.concept.toString(),
      name: item.active_project,
      description: `Project: ${item.active_project}`,
    }))
  } catch (error) {
    console.error("Failed to fetch projects:", error)
    // Return empty array in case of error to prevent UI from breaking
    return []
  }
}

export async function getProjectById(id: string): Promise<Project | undefined> {
  try {
    const supabase = getSupabaseClient()

    const { data, error } = await supabase
      .from("active_projects")
      .select("concept, active_project")
      .eq("concept", id)
      .single()

    if (error) {
      console.error("Error fetching project by ID:", error)
      return undefined
    }

    if (!data) return undefined

    return {
      id: data.concept.toString(),
      name: data.active_project,
      description: `Project: ${data.active_project}`,
    }
  } catch (error) {
    console.error("Failed to fetch project by ID:", error)
    return undefined
  }
}
