"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { submitErrorReport } from "@/lib/services/error-service"
import { AlertCircle, CheckCircle } from "lucide-react"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"

interface ErrorReportDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  failedFiles: Array<{ fileName: string; error: string }>
  projectId: string
}

export default function ErrorReportDialog({ open, onOpenChange, failedFiles, projectId }: ErrorReportDialogProps) {
  const [name, setName] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitSuccess, setSubmitSuccess] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)

  const handleSubmit = async () => {
    setIsSubmitting(true)
    setSubmitError(null)

    try {
      const errorMessage = failedFiles
        .map(
          (file) => `File: ${file.fileName}
Error: ${file.error}`,
        )
        .join("\n\n")

      await submitErrorReport({
        fileName: failedFiles.map((f) => f.fileName).join(", "),
        errorMessage,
        userName: name,
        userComments: "", // Empty string instead of user comments
        projectId,
        browserInfo: navigator.userAgent,
      })

      setSubmitSuccess(true)
      setTimeout(() => {
        onOpenChange(false)
        setSubmitSuccess(false)
        setName("")
      }, 2000)
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : "Failed to submit error report")
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Report Parsing Error</DialogTitle>
          <DialogDescription>
            Submit this report to help us improve the parser. The error logs will be automatically included.
          </DialogDescription>
        </DialogHeader>

        {submitSuccess ? (
          <Alert className="bg-green-50 border-green-200">
            <CheckCircle className="h-4 w-4 text-green-600" />
            <AlertTitle>Success</AlertTitle>
            <AlertDescription>Your error report has been submitted. Thank you!</AlertDescription>
          </Alert>
        ) : (
          <>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="name">Your Name (optional)</Label>
                <Input
                  id="name"
                  type="text"
                  placeholder="Your name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="files">Failed Files</Label>
                <div className="bg-muted p-2 rounded-md text-sm max-h-[100px] overflow-y-auto">
                  {failedFiles.map((file, index) => (
                    <div key={index} className="mb-1">
                      {file.fileName}
                    </div>
                  ))}
                </div>
              </div>

              {/* Removed the Additional Comments field */}
            </div>

            {submitError && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Error</AlertTitle>
                <AlertDescription>{submitError}</AlertDescription>
              </Alert>
            )}

            <DialogFooter>
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button onClick={handleSubmit} disabled={isSubmitting}>
                {isSubmitting ? "Submitting..." : "Submit Report"}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
