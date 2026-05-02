"""
Geofencing utilities.

Improvements over original:
  - accuracy_meters: if device reports GPS accuracy worse than the geofence
    radius, we apply a grace margin instead of hard-failing
  - distance_meters is exposed for callers that want the raw value
  - within_geofence returns a named tuple so callers get rich info
"""
from dataclasses import dataclass
from math import radians, sin, cos, sqrt, atan2
from typing import Optional
from config import Config


@dataclass
class GeofenceResult:
    inside: bool
    distance_meters: float
    radius_meters: float
    accuracy_adjusted: bool  # True if we relaxed the boundary due to GPS accuracy


def distance_meters(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Haversine formula — returns distance in metres."""
    R = 6_371_000.0
    dlat = radians(lat2 - lat1)
    dlon = radians(lon2 - lon1)
    a = sin(dlat / 2) ** 2 + cos(radians(lat1)) * cos(radians(lat2)) * sin(dlon / 2) ** 2
    c = 2 * atan2(sqrt(a), sqrt(1 - a))
    return R * c


def within_geofence(
    session_lat: Optional[float],
    session_lon: Optional[float],
    user_lat: Optional[float],
    user_lon: Optional[float],
    radius_meters: Optional[float] = None,
    user_accuracy_meters: Optional[float] = None,
) -> GeofenceResult:
    """
    Check whether a user coordinate is inside a circular geofence.

    Parameters
    ----------
    session_lat/lon  : anchor coordinates set by the teacher
    user_lat/lon     : student's reported coordinates
    radius_meters    : override geofence radius (otherwise uses Config)
    user_accuracy_meters : GPS accuracy from navigator.geolocation; if provided
                           and larger than radius, we add a 30 % grace margin

    Returns
    -------
    GeofenceResult with inside, distance_meters, radius_meters, accuracy_adjusted
    """
    if any(v is None for v in (session_lat, session_lon, user_lat, user_lon)):
        return GeofenceResult(
            inside=False,
            distance_meters=float("inf"),
            radius_meters=radius_meters or Config.GEOFENCE_RADIUS_METERS,
            accuracy_adjusted=False,
        )

    effective_radius = float(radius_meters or Config.GEOFENCE_RADIUS_METERS)
    accuracy_adjusted = False

    # If GPS accuracy is worse than our radius, give a 30 % grace margin
    if user_accuracy_meters and float(user_accuracy_meters) > effective_radius:
        effective_radius = effective_radius + float(user_accuracy_meters) * 0.30
        accuracy_adjusted = True

    dist = distance_meters(
        float(session_lat), float(session_lon),
        float(user_lat),    float(user_lon),
    )

    return GeofenceResult(
        inside=dist <= effective_radius,
        distance_meters=dist,
        radius_meters=effective_radius,
        accuracy_adjusted=accuracy_adjusted,
    )


def simple_check(session_lat, session_lon, user_lat, user_lon, radius=None) -> bool:
    """Convenience wrapper returning just a bool — for backward compat."""
    return within_geofence(session_lat, session_lon, user_lat, user_lon, radius).inside
