"use client"

import { useEffect, useState } from "react"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { getProjects } from "@/lib/services/project-service"
import type { Project } from "@/lib/types"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

interface ProjectSelectorProps {
  onProjectSelect: (projectId: string) => void
  selectedProjectId?: string
}

export default function ProjectSelector({ onProjectSelect, selectedProjectId }: ProjectSelectorProps) {
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function loadProjects() {
      try {
        setLoading(true)
        const projectData = await getProjects()
        setProjects(projectData)
        setError(null)
      } catch (err) {
        setError("Failed to load projects. Please try again.")
        console.error("Error loading projects:", err)
      } finally {
        setLoading(false)
      }
    }

    loadProjects()
  }, [])

  return (
    <Card>
      <CardHeader>
        <CardTitle>Select Project</CardTitle>
        <CardDescription>Choose a project before uploading files</CardDescription>
      </CardHeader>
      <CardContent>
        <Select disabled={loading || projects.length === 0} value={selectedProjectId} onValueChange={onProjectSelect}>
          <SelectTrigger className="w-full">
            <SelectValue placeholder={loading ? "Loading projects..." : "Select a project"} />
          </SelectTrigger>
          <SelectContent>
            {projects.map((project) => (
              <SelectItem key={project.id} value={project.id}>
                {project.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {error && <p className="text-sm text-red-500 mt-2">{error}</p>}
      </CardContent>
    </Card>
  )
}
