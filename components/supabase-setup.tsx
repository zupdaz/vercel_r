"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { AlertCircle, CheckCircle } from "lucide-react"

export default function SupabaseSetup() {
  const [supabaseUrl, setSupabaseUrl] = useState("")
  const [supabaseKey, setSupabaseKey] = useState("")
  const [isConfigured, setIsConfigured] = useState(false)
  const [showConfig, setShowConfig] = useState(false)
  const [errorMessage, setErrorMessage] = useState("")

  useEffect(() => {
    // Check if Supabase is configured
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

    if (url && key) {
      setSupabaseUrl(url)
      setSupabaseKey(key)
      setIsConfigured(true)
    }
  }, [])

  const saveConfig = () => {
    // In a real app, this would save to .env.local or similar
    // For this demo, we'll just use localStorage
    localStorage.setItem("SUPABASE_URL", supabaseUrl)
    localStorage.setItem("SUPABASE_KEY", supabaseKey)

    // Set environment variables for the current session
    // Note: This is just for demo purposes and won't persist across page refreshes
    // In a real app, you'd need to save these server-side
    if (typeof window !== "undefined") {
      // @ts-ignore - This is just for demo purposes
      window.process = window.process || {}
      // @ts-ignore
      window.process.env = window.process.env || {}
      // @ts-ignore
      window.process.env.NEXT_PUBLIC_SUPABASE_URL = supabaseUrl
      // @ts-ignore
      window.process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = supabaseKey
    }

    setIsConfigured(true)
    setShowConfig(false)
  }

  if (isConfigured && !showConfig) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium">Database Connection</CardTitle>
          <CardDescription>Supabase connection is configured</CardDescription>
        </CardHeader>
        <CardContent className="flex justify-between items-center pt-0">
          <div className="flex items-center">
            <CheckCircle className="h-5 w-5 text-green-500 mr-2" />
            <span className="text-sm">Connected to Supabase</span>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => setShowConfig(true)}>
              Configure
            </Button>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Configure Supabase Connection</CardTitle>
        <CardDescription>Enter your Supabase URL and anonymous key to enable database storage</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="supabaseUrl">Supabase URL</Label>
          <Input
            id="supabaseUrl"
            placeholder="https://your-project.supabase.co"
            value={supabaseUrl}
            onChange={(e) => setSupabaseUrl(e.target.value)}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="supabaseKey">Supabase Anon Key</Label>
          <Input
            id="supabaseKey"
            type="password"
            placeholder="your-supabase-anon-key"
            value={supabaseKey}
            onChange={(e) => setSupabaseKey(e.target.value)}
          />
        </div>

        <div className="flex justify-end space-x-2">
          {isConfigured && (
            <Button variant="outline" onClick={() => setShowConfig(false)}>
              Cancel
            </Button>
          )}
          <Button onClick={saveConfig} disabled={!supabaseUrl || !supabaseKey}>
            Save Configuration
          </Button>
        </div>

        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Important</AlertTitle>
          <AlertDescription>
            For production use, these values should be set in your environment variables. This configuration is for
            demonstration purposes only.
          </AlertDescription>
        </Alert>
      </CardContent>
    </Card>
  )
}
