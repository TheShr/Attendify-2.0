"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { apiJson } from "@/lib/api";

export interface GeofenceZone {
  id: number;
  name: string;
  latitude: number;
  longitude: number;
  radius_meters: number;
  active: boolean;
}

export interface LocationData {
  latitude: number;
  longitude: number;
  accuracy: number;
  timestamp: Date;
}

export interface GeofenceCheckResult {
  inside: boolean;
  distance_meters: number;
  radius_meters: number;
  accuracy_adjusted: boolean;
  zone?: GeofenceZone;
}

interface UseGeofencingReturn {
  isActive: boolean;
  location: LocationData | null;
  isInsideGeofence: boolean;
  distance: number | null;
  accuracy: number | null;
  error: string | null;
  zones: GeofenceZone[];
  activeZone: GeofenceZone | null;
  checkResult: GeofenceCheckResult | null;
  startTracking: (zoneId?: number) => void;
  stopTracking: () => void;
  refreshZones: () => Promise<void>;
  checkAgainstServer: (lat: number, lon: number, zoneId: number) => Promise<GeofenceCheckResult | null>;
}

/**
 * Improved geofencing hook:
 *  - Loads zones from the backend (not hardcoded)
 *  - Optionally validates against server for authoritative check
 *  - Exposes GPS accuracy for UI feedback
 *  - Properly cleans up watchPosition on unmount
 */
export function useGeofencing(initialZoneId?: number): UseGeofencingReturn {
  const [isActive, setIsActive]             = useState(false);
  const [location, setLocation]             = useState<LocationData | null>(null);
  const [isInsideGeofence, setIsInside]     = useState(false);
  const [distance, setDistance]             = useState<number | null>(null);
  const [accuracy, setAccuracy]             = useState<number | null>(null);
  const [error, setError]                   = useState<string | null>(null);
  const [zones, setZones]                   = useState<GeofenceZone[]>([]);
  const [activeZone, setActiveZone]         = useState<GeofenceZone | null>(null);
  const [checkResult, setCheckResult]       = useState<GeofenceCheckResult | null>(null);

  const watchIdRef = useRef<number | null>(null);

  // ── Haversine (client-side preview; server is authoritative) ──
  function haversineMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R   = 6_371_000;
    const φ1  = (lat1 * Math.PI) / 180;
    const φ2  = (lat2 * Math.PI) / 180;
    const Δφ  = ((lat2 - lat1) * Math.PI) / 180;
    const Δλ  = ((lon2 - lon1) * Math.PI) / 180;
    const a   = Math.sin(Δφ / 2) ** 2 + Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }

  const refreshZones = useCallback(async () => {
    try {
      const data = await apiJson<{ zones: GeofenceZone[] }>("/api/geofences");
      setZones(data.zones || []);
    } catch (e) {
      console.error("Failed to load geofence zones:", e);
    }
  }, []);

  // Load zones on mount
  useEffect(() => { refreshZones(); }, [refreshZones]);

  // Set active zone when zones load or initialZoneId changes
  useEffect(() => {
    if (initialZoneId && zones.length > 0) {
      const z = zones.find((z) => z.id === initialZoneId) || null;
      setActiveZone(z);
    } else if (zones.length === 1) {
      setActiveZone(zones[0]);
    }
  }, [zones, initialZoneId]);

  const updateLocation = useCallback(
    (position: GeolocationPosition) => {
      const loc: LocationData = {
        latitude:  position.coords.latitude,
        longitude: position.coords.longitude,
        accuracy:  position.coords.accuracy,
        timestamp: new Date(),
      };
      setLocation(loc);
      setError(null);
      setAccuracy(loc.accuracy);

      if (activeZone) {
        const dist = haversineMeters(
          activeZone.latitude, activeZone.longitude,
          loc.latitude, loc.longitude,
        );
        setDistance(dist);
        // Client-side check (with accuracy grace margin — mirrors server logic)
        const effectiveRadius =
          loc.accuracy > activeZone.radius_meters
            ? activeZone.radius_meters + loc.accuracy * 0.3
            : activeZone.radius_meters;
        setIsInside(dist <= effectiveRadius);
      }
    },
    [activeZone],
  );

  const handleError = useCallback((err: GeolocationPositionError) => {
    const msgs: Record<number, string> = {
      1: "Location access denied. Please enable location services.",
      2: "Location unavailable. Check GPS signal.",
      3: "Location request timed out.",
    };
    setError(msgs[err.code] || "Unable to get location.");
    setIsInside(false);
  }, []);

  const startTracking = useCallback((zoneId?: number) => {
    if (!navigator.geolocation) {
      setError("Geolocation is not supported by this browser.");
      return;
    }
    if (zoneId && zones.length > 0) {
      const z = zones.find((z) => z.id === zoneId);
      if (z) setActiveZone(z);
    }
    setIsActive(true);
    setError(null);

    watchIdRef.current = navigator.geolocation.watchPosition(
      updateLocation,
      handleError,
      { enableHighAccuracy: true, timeout: 15_000, maximumAge: 10_000 },
    );
  }, [updateLocation, handleError, zones]);

  const stopTracking = useCallback(() => {
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
    setIsActive(false);
    setLocation(null);
    setDistance(null);
    setIsInside(false);
    setAccuracy(null);
  }, []);

  /** Server-side authoritative geofence check. */
  const checkAgainstServer = useCallback(
    async (lat: number, lon: number, zoneId: number): Promise<GeofenceCheckResult | null> => {
      try {
        const result = await apiJson<GeofenceCheckResult>("/api/geofences/check", {
          method: "POST",
          body: JSON.stringify({ zone_id: zoneId, lat, lon, accuracy: accuracy ?? undefined }),
        });
        setCheckResult(result);
        setIsInside(result.inside);
        return result;
      } catch (e) {
        console.error("Server geofence check failed:", e);
        return null;
      }
    },
    [accuracy],
  );

  // Cleanup
  useEffect(() => () => stopTracking(), [stopTracking]);

  return {
    isActive,
    location,
    isInsideGeofence,
    distance,
    accuracy,
    error,
    zones,
    activeZone,
    checkResult,
    startTracking,
    stopTracking,
    refreshZones,
    checkAgainstServer,
  };
}
