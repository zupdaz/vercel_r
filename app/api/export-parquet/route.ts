import { type NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

function convertToCSV(data: any[]): string {
  if (!data || data.length === 0) {
    return "No data available"
  }

  const headers = Object.keys(data[0])
  const csvContent = [
    headers.join(","),
    ...data.map((row) =>
      headers
        .map((header) => {
          const value = row[header]
          // Escape commas and quotes in CSV
          if (typeof value === "string" && (value.includes(",") || value.includes('"'))) {
            return `"${value.replace(/"/g, '""')}"`
          }
          return value ?? ""
        })
        .join(","),
    ),
  ].join("\n")

  return csvContent
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const type = searchParams.get("type")

    if (!type || !["dissolution", "particle"].includes(type)) {
      return NextResponse.json(
        { error: 'Invalid type parameter. Must be "dissolution" or "particle"' },
        { status: 400 },
      )
    }

    let files: { name: string; content: string }[] = []

    if (type === "dissolution") {
      const { data: methodData, error: methodError } = await supabase.from("dissolution_method").select("*")
      const { data: sampleData, error: sampleError } = await supabase.from("dissolution_sample").select("*")

      if (methodError) {
        console.error("Error fetching dissolution_method:", methodError)
        return NextResponse.json({ error: "Failed to fetch dissolution method data" }, { status: 500 })
      }

      if (sampleError) {
        console.error("Error fetching dissolution_sample:", sampleError)
        return NextResponse.json({ error: "Failed to fetch dissolution sample data" }, { status: 500 })
      }

      files = [
        {
          name: `dissolution_method_${new Date().toISOString().split("T")[0]}.csv`,
          content: convertToCSV(methodData || []),
        },
        {
          name: `dissolution_sample_${new Date().toISOString().split("T")[0]}.csv`,
          content: convertToCSV(sampleData || []),
        },
      ]
    } else if (type === "particle") {
      const { data: classData, error: classError } = await supabase.from("particle_size_class").select("*")
      const { data: metadataData, error: metadataError } = await supabase.from("particle_metadata").select("*")

      if (classError) {
        console.error("Error fetching particle_size_class:", classError)
        return NextResponse.json({ error: "Failed to fetch particle size class data" }, { status: 500 })
      }

      if (metadataError) {
        console.error("Error fetching particle_metadata:", metadataError)
        return NextResponse.json({ error: "Failed to fetch particle metadata data" }, { status: 500 })
      }

      files = [
        {
          name: `particle_size_class_${new Date().toISOString().split("T")[0]}.csv`,
          content: convertToCSV(classData || []),
        },
        {
          name: `particle_metadata_${new Date().toISOString().split("T")[0]}.csv`,
          content: convertToCSV(metadataData || []),
        },
      ]
    }

    return NextResponse.json({ files })
  } catch (error) {
    console.error("Error in export-parquet API:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
