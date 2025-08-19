/**
 * Application settings and feature flags
 * These settings control various features of the application
 */

// Feature flags
export const FEATURES = {
  // Enable connection to MaterialiRA database
  ENABLE_MATERIALIA_RA_CONNECTION: false,

  // Enable local file storage for uploads
  ENABLE_LOCAL_FILE_STORAGE: false,

  // Enable parquet file generation trigger
  ENABLE_PARQUET_TRIGGER: false,
}

// File storage settings
export const STORAGE = {
  // Base directory for file uploads
  UPLOAD_BASE_DIR: "uploads",

  // Maximum file size in bytes (10MB)
  MAX_FILE_SIZE: 10 * 1024 * 1024,
}
