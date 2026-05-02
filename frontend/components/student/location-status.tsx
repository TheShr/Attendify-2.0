"use client"

import { useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { useGeofencing } from "@/hooks/use-geofencing"
import { MapPin, CheckCircle, XCircle, RefreshCw } from "lucide-react"

export function LocationStatus() {
  const { location, isInsideGeofence, distance, error, startTracking, stopTracking } = useGeofencing()

  useEffect(() => {
    // Auto-start location tracking for students
    startTracking()

    return () => {
      stopTracking()
    }
  }, [startTracking, stopTracking])

  const getLocationStatus = () => {
    if (error) return "error"
    if (!location) return "loading"
    return isInsideGeofence ? "inside" : "outside"
  }

  const getStatusIcon = () => {
    const status = getLocationStatus()
    switch (status) {
      case "inside":
        return <CheckCircle className="h-4 w-4 text-green-500" />
      case "outside":
        return <XCircle className="h-4 w-4 text-red-500" />
      case "error":
        return <XCircle className="h-4 w-4 text-red-500" />
      default:
        return <RefreshCw className="h-4 w-4 text-gray-500 animate-spin" />
    }
  }

  const getStatusBadge = () => {
    const status = getLocationStatus()
    switch (status) {
      case "inside":
        return <Badge className="bg-green-100 text-green-800 hover:bg-green-100">On Campus</Badge>
      case "outside":
        return <Badge className="bg-red-100 text-red-800 hover:bg-red-100">Off Campus</Badge>
      case "error":
        return <Badge className="bg-red-100 text-red-800 hover:bg-red-100">Location Error</Badge>
      default:
        return <Badge variant="outline">Checking...</Badge>
    }
  }

  const getStatusMessage = () => {
    const status = getLocationStatus()
    switch (status) {
      case "inside":
        return "You are within the campus area. Attendance can be marked."
      case "outside":
        return "You are outside the campus area. Please move closer to mark attendance."
      case "error":
        return error || "Unable to determine location"
      default:
        return "Checking your location..."
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <MapPin className="h-5 w-5" />
          Location Status
        </CardTitle>
        <CardDescription>Your current location relative to campus</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {getStatusIcon()}
            <span className="font-medium">Campus Location</span>
          </div>
          {getStatusBadge()}
        </div>

        <p className="text-sm text-muted-foreground">{getStatusMessage()}</p>

        {location && !error && (
          <div className="space-y-2 text-sm">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <span className="text-muted-foreground">Distance from campus:</span>
                <div className="font-medium">{distance ? `${Math.round(distance)}m` : "Calculating..."}</div>
              </div>
              <div>
                <span className="text-muted-foreground">Accuracy:</span>
                <div className="font-medium">±{Math.round(location.accuracy)}m</div>
              </div>
            </div>
            <div>
              <span className="text-muted-foreground">Last updated:</span>
              <span className="ml-2">{location.timestamp.toLocaleTimeString()}</span>
            </div>
          </div>
        )}

        {error && (
          <div className="flex items-center gap-2">
            <Button size="sm" onClick={() => startTracking()} variant="outline">
              <RefreshCw className="h-4 w-4 mr-2" />
              Retry Location
            </Button>
          </div>
        )}

        <div className="text-xs text-muted-foreground bg-blue-50 p-3 rounded-md">
          <strong>Note:</strong> Location services must be enabled for attendance marking. Your location is only used
          for campus verification and is not stored permanently.
        </div>
      </CardContent>
    </Card>
  )
}
