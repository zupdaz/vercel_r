"use client"

import { useState, useEffect, useRef } from "react"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Input } from "@/components/ui/input"
import { ExternalLink, Search, Edit2, Save, X } from "lucide-react"
import { getSupabaseClient } from "@/lib/services/supabase-service"
import type { SampleMetadata } from "@/lib/types"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { toast } from "@/hooks/use-toast"

interface EditableSampleMetadata extends SampleMetadata {
  isEditing?: boolean
  tempBatchDiss?: string
  tempBatchCam?: string
}

export default function SampleMetadataViewer() {
  const [samples, setSamples] = useState<EditableSampleMetadata[]>([])
  const [loading, setLoading] = useState(false)
  const [searchTerm, setSearchTerm] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [hasSearched, setHasSearched] = useState(false)
  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false)
  const [sampleToUpdate, setSampleToUpdate] = useState<EditableSampleMetadata | null>(null)
  const debounceTimeout = useRef<NodeJS.Timeout | null>(null)

  // Debounced search effect
  useEffect(() => {
    // Clear any existing timeout
    if (debounceTimeout.current) {
      clearTimeout(debounceTimeout.current)
    }

    // Don't search if the search term is empty
    if (!searchTerm.trim()) {
      return
    }

    // Set a new timeout
    debounceTimeout.current = setTimeout(() => {
      handleSearch()
    }, 500) // 500ms debounce time

    // Cleanup function
    return () => {
      if (debounceTimeout.current) {
        clearTimeout(debounceTimeout.current)
      }
    }
  }, [searchTerm])

  // Load samples only when search is performed
  const handleSearch = async () => {
    setLoading(true)
    setHasSearched(true)
    setError(null)

    try {
      const supabase = getSupabaseClient()

      // Search across multiple fields
      const { data, error } = await supabase
        .from("sample_metadata")
        .select("*")
        .or(
          `mra_no.ilike.%${searchTerm}%,batch_diss.ilike.%${searchTerm}%,batch_cam.ilike.%${searchTerm}%,batch_ra.ilike.%${searchTerm}%,file_name.ilike.%${searchTerm}%`,
        )
        .order("created_at", { ascending: false })

      if (error) throw error

      // Add editing properties to each sample
      const samplesWithEditState = (data || []).map((sample) => ({
        ...sample,
        isEditing: false,
        tempBatchDiss: sample.batch_diss || "",
        tempBatchCam: sample.batch_cam || "",
      }))

      setSamples(samplesWithEditState)

      if (data && data.length === 0) {
        setError("No matching samples found")
      }
    } catch (err) {
      setError("Failed to search sample metadata. Please try again.")
      console.error("Error searching sample metadata:", err)
    } finally {
      setLoading(false)
    }
  }

  // Handle Enter key press in search input
  // const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
  //   if (e.key === "Enter") {
  //     handleSearch()
  //   }
  // }

  // Toggle editing state for a sample
  const toggleEditing = (index: number) => {
    setSamples((prevSamples) =>
      prevSamples.map((sample, i) => {
        if (i === index) {
          return {
            ...sample,
            isEditing: !sample.isEditing,
            // Reset temp values if canceling edit
            tempBatchDiss: !sample.isEditing ? sample.batch_diss || "" : sample.tempBatchDiss,
            tempBatchCam: !sample.isEditing ? sample.batch_cam || "" : sample.tempBatchCam,
          }
        }
        return sample
      }),
    )
  }

  // Handle input change for editable fields
  const handleInputChange = (index: number, field: "tempBatchDiss" | "tempBatchCam", value: string) => {
    setSamples((prevSamples) =>
      prevSamples.map((sample, i) => {
        if (i === index) {
          return { ...sample, [field]: value }
        }
        return sample
      }),
    )
  }

  // Open confirmation dialog before saving
  const openConfirmDialog = (sample: EditableSampleMetadata) => {
    setSampleToUpdate(sample)
    setConfirmDialogOpen(true)
  }

  // Save changes to database after confirmation
  const saveChanges = async () => {
    if (!sampleToUpdate || !sampleToUpdate.id) {
      setConfirmDialogOpen(false)
      return
    }

    try {
      const supabase = getSupabaseClient()

      const { error } = await supabase
        .from("sample_metadata")
        .update({
          batch_diss: sampleToUpdate.tempBatchDiss || null,
          batch_cam: sampleToUpdate.tempBatchCam || null,
          updated_at: new Date(),
        })
        .eq("id", sampleToUpdate.id)

      if (error) throw error

      // Update local state
      setSamples((prevSamples) =>
        prevSamples.map((sample) => {
          if (sample.id === sampleToUpdate.id) {
            return {
              ...sample,
              batch_diss: sample.tempBatchDiss || null,
              batch_cam: sample.tempBatchCam || null,
              isEditing: false,
            }
          }
          return sample
        }),
      )

      toast({
        title: "Changes saved",
        description: `Updated batch information for MRA ${sampleToUpdate.mra_no}`,
      })
    } catch (err) {
      console.error("Error updating sample:", err)
      toast({
        title: "Error",
        description: "Failed to save changes. Please try again.",
        variant: "destructive",
      })
    } finally {
      setConfirmDialogOpen(false)
      setSampleToUpdate(null)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Sample Metadata</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <Input
              placeholder="Search by MRA number, batch, or file name..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="max-w-md"
            />
            <Button
              onClick={handleSearch}
              disabled={loading || !searchTerm.trim()}
              className="flex items-center gap-2 bg-[#00ab4d] hover:bg-[#009040]"
            >
              <Search className="h-4 w-4" />
              Search
            </Button>
          </div>

          {loading ? (
            <div className="text-center py-4">Searching sample metadata...</div>
          ) : error ? (
            <div className="text-center py-4 text-red-500">{error}</div>
          ) : hasSearched && samples.length > 0 ? (
            <div className="border rounded-md overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>MRA Number</TableHead>
                    <TableHead>Batch (Dissolution)</TableHead>
                    <TableHead>Batch (CAM)</TableHead>
                    <TableHead>Batch (RA)</TableHead>
                    <TableHead>Intermediate Form</TableHead>
                    <TableHead>API Strength (RA)</TableHead>
                    <TableHead>RA Link</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {samples.map((sample, index) => (
                    <TableRow key={index}>
                      <TableCell>{sample.mra_no}</TableCell>
                      <TableCell>
                        {sample.isEditing ? (
                          <Input
                            value={sample.tempBatchDiss}
                            onChange={(e) => handleInputChange(index, "tempBatchDiss", e.target.value)}
                            className="w-full"
                          />
                        ) : (
                          sample.batch_diss || "-"
                        )}
                      </TableCell>
                      <TableCell>
                        {sample.isEditing ? (
                          <Input
                            value={sample.tempBatchCam}
                            onChange={(e) => handleInputChange(index, "tempBatchCam", e.target.value)}
                            className="w-full"
                          />
                        ) : (
                          sample.batch_cam || "-"
                        )}
                      </TableCell>
                      <TableCell>{sample.batch_ra || "-"}</TableCell>
                      <TableCell>{sample.intermediate_form_ra || "-"}</TableCell>
                      <TableCell>{sample.api_strength_ra || "-"}</TableCell>
                      <TableCell>
                        {sample.ra_link ? (
                          <a
                            href={sample.ra_link}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center text-blue-600 hover:underline"
                          >
                            <ExternalLink className="h-4 w-4 mr-1" />
                            View
                          </a>
                        ) : (
                          "-"
                        )}
                      </TableCell>
                      <TableCell>
                        {sample.isEditing ? (
                          <div className="flex items-center gap-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => openConfirmDialog(sample)}
                              className="h-8 w-8 p-0"
                            >
                              <Save className="h-4 w-4" />
                              <span className="sr-only">Save</span>
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => toggleEditing(index)}
                              className="h-8 w-8 p-0"
                            >
                              <X className="h-4 w-4" />
                              <span className="sr-only">Cancel</span>
                            </Button>
                          </div>
                        ) : (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => toggleEditing(index)}
                            className="h-8 w-8 p-0"
                          >
                            <Edit2 className="h-4 w-4" />
                            <span className="sr-only">Edit</span>
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : hasSearched ? (
            <div className="text-center py-4">No matching samples found</div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">Enter a search term to find sample metadata</div>
          )}
        </div>
      </CardContent>

      {/* Confirmation Dialog */}
      <Dialog open={confirmDialogOpen} onOpenChange={setConfirmDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm Changes</DialogTitle>
            <DialogDescription>
              Are you sure you want to update the batch information for MRA {sampleToUpdate?.mra_no}?
            </DialogDescription>
          </DialogHeader>

          {sampleToUpdate && (
            <div className="py-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm font-medium mb-1">Current Batch (Dissolution)</p>
                  <p className="text-sm">{sampleToUpdate.batch_diss || "-"}</p>
                </div>
                <div>
                  <p className="text-sm font-medium mb-1">New Batch (Dissolution)</p>
                  <p className="text-sm">{sampleToUpdate.tempBatchDiss || "-"}</p>
                </div>
                <div>
                  <p className="text-sm font-medium mb-1">Current Batch (CAM)</p>
                  <p className="text-sm">{sampleToUpdate.batch_cam || "-"}</p>
                </div>
                <div>
                  <p className="text-sm font-medium mb-1">New Batch (CAM)</p>
                  <p className="text-sm">{sampleToUpdate.tempBatchCam || "-"}</p>
                </div>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={saveChanges} className="bg-[#00ab4d] hover:bg-[#009040]">
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  )
}
