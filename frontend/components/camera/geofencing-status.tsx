"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { MapPin, CheckCircle, XCircle, AlertTriangle } from "lucide-react"

interface GeofencingStatusProps {
  isActive: boolean
}

interface LocationData {
  latitude: number
  longitude: number
  accuracy: number
  timestamp: Date
}

type LocationStatus = "checking" | "inside" | "outside" | "error"

export function GeofencingStatus({ isActive }: GeofencingStatusProps) {
  const [location, setLocation] = useState<LocationData | null>(null)
  const [locationStatus, setLocationStatus] = useState<LocationStatus>("checking")
  const [error, setError] = useState<string>("")
  const watchIdRef = useRef<number | null>(null)

  const campusBoundaries = useMemo(
    () => ({
      center: { lat: 40.7128, lng: -74.006 },
      radius: 500,
    }),
    [],
  )

  const checkLocationBoundaries = useCallback(
    (loc: LocationData): boolean => {
      const earthRadiusMeters = 6_371_000
      const toRadians = (degrees: number) => (degrees * Math.PI) / 180

      const lat1 = toRadians(campusBoundaries.center.lat)
      const lat2 = toRadians(loc.latitude)
      const deltaLat = toRadians(loc.latitude - campusBoundaries.center.lat)
      const deltaLng = toRadians(loc.longitude - campusBoundaries.center.lng)

      const a =
        Math.sin(deltaLat / 2) ** 2 +
        Math.cos(lat1) * Math.cos(lat2) * Math.sin(deltaLng / 2) ** 2
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
      const distance = earthRadiusMeters * c

      return distance <= campusBoundaries.radius
    },
    [campusBoundaries],
  )

  const stopLocationTracking = useCallback(() => {
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current)
      watchIdRef.current = null
    }
    setLocation(null)
    setLocationStatus("checking")
  }, [])

  const startLocationTracking = useCallback(() => {
    if (!navigator.geolocation) {
      setError("Geolocation is not supported by this browser")
      setLocationStatus("error")
      return
    }

    const watchId = navigator.geolocation.watchPosition(
      (position) => {
        const newLocation: LocationData = {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy,
          timestamp: new Date(),
        }

        setLocation(newLocation)
        setError("")

        const isWithinBoundaries = checkLocationBoundaries(newLocation)
        setLocationStatus(isWithinBoundaries ? "inside" : "outside")
      },
      (geoError) => {
        console.error("Geolocation error:", geoError)
        setError("Unable to get location. Please enable location services.")
        setLocationStatus("error")
      },
      {
        enableHighAccuracy: true,
        timeout: 10_000,
        maximumAge: 60_000,
      },
    )

    watchIdRef.current = watchId
  }, [checkLocationBoundaries])

  useEffect(() => {
    if (isActive) {
      startLocationTracking()
    } else {
      stopLocationTracking()
    }

    return () => {
      stopLocationTracking()
    }
  }, [isActive, startLocationTracking, stopLocationTracking])

  const getStatusIcon = () => {
    switch (locationStatus) {
      case "inside":
        return <CheckCircle className="h-4 w-4 text-green-500" />
      case "outside":
        return <XCircle className="h-4 w-4 text-red-500" />
      case "error":
        return <AlertTriangle className="h-4 w-4 text-red-500" />
      default:
        return <MapPin className="h-4 w-4 text-gray-500" />
    }
  }

  const getStatusBadge = () => {
    switch (locationStatus) {
      case "inside":
        return <Badge className="bg-green-100 text-green-800 hover:bg-green-100">Inside Campus</Badge>
      case "outside":
        return <Badge className="bg-red-100 text-red-800 hover:bg-red-100">Outside Campus</Badge>
      case "error":
        return <Badge className="bg-red-100 text-red-800 hover:bg-red-100">Location Error</Badge>
      default:
        return <Badge variant="outline">Checking...</Badge>
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <MapPin className="h-5 w-5" />
          Geofencing Status
        </CardTitle>
        <CardDescription>Location-based attendance validation</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {getStatusIcon()}
            <span className="font-medium">Location Status</span>
          </div>
          {getStatusBadge()}
        </div>

        {error && (
          <div className="rounded-md border border-red-200 bg-red-50 p-3">
            <p className="text-sm text-red-700">{error}</p>
          </div>
        )}

        {location && !error && (
          <div className="space-y-2 text-sm">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <span className="text-muted-foreground">Latitude:</span>
                <div className="font-mono">{location.latitude.toFixed(6)}</div>
              </div>
              <div>
                <span className="text-muted-foreground">Longitude:</span>
                <div className="font-mono">{location.longitude.toFixed(6)}</div>
              </div>
            </div>
            <div>
              <span className="text-muted-foreground">Accuracy:</span>
              <span className="ml-2">+/-{Math.round(location.accuracy)}m</span>
            </div>
            <div>
              <span className="text-muted-foreground">Last Updated:</span>
              <span className="ml-2">{location.timestamp.toLocaleTimeString()}</span>
            </div>
          </div>
        )}

        {!isActive && (
          <div className="py-4 text-center">
            <MapPin className="mx-auto mb-2 h-8 w-8 text-gray-400" />
            <p className="text-sm text-muted-foreground">Geofencing is inactive</p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
