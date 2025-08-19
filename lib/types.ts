// Define types for the application
export interface Project {
  id: string
  name: string
  description?: string
}

export interface QueueItem {
  id: string
  fileName: string
  fileSize: number
  fileType: string
  status: "queued" | "processing" | "completed" | "failed"
  projectId: string
  error?: string
  startTime?: Date
  endTime?: Date
  result?: any
}

export interface ErrorReport {
  id: string
  fileName: string
  errorMessage: string
  stackTrace?: string
  userName?: string
  userComments?: string
  timestamp: Date
  browserInfo?: string
  projectId: string
}

// New interface for the samples table
export interface SampleMetadata {
  id?: string
  file_name: string
  mra_no: string
  batch_diss?: string
  batch_cam?: string // Added batch_cam field
  batch_ra?: string
  intermediate_form_ra?: string
  name_ra?: string
  api_strength_ra?: string
  marocilnica_ra?: string
  ra_link?: string
  created_at?: Date
  updated_at?: Date
}

// Interface for MaterialiRA query results
export interface MaterialiRAResult {
  marocilnica_ra: string | null
  mra_no: string | null
  batch_ra: string | null
  intermediate_form_ra: string | null
  name_ra: string | null
  api_strength_ra: string | null
  ra_link: string | null
}
