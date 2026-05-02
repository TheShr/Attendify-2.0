"""
Geofence zone management — CRUD for campus/classroom zones.
Zones are now persisted in PostgreSQL (not in-memory).
"""
from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt, get_jwt_identity

from extensions import db
from models import GeofenceZone

geofence_bp = Blueprint("geofences", __name__)


def _admin_or_teacher(claims):
    return claims.get("role") in ("admin", "teacher")


@geofence_bp.route("", methods=["GET"])
@jwt_required()
def list_zones():
    zones = GeofenceZone.query.filter_by(active=True).order_by(GeofenceZone.created_at.desc()).all()
    return jsonify({"zones": [z.to_dict() for z in zones]})


@geofence_bp.route("", methods=["POST"])
@jwt_required()
def create_zone():
    claims = get_jwt()
    if not _admin_or_teacher(claims):
        return jsonify({"error": "admin or teacher required"}), 403

    data = request.get_json() or {}
    name          = data.get("name")
    latitude      = data.get("latitude") or data.get("lat")
    longitude     = data.get("longitude") or data.get("lon")
    radius_meters = data.get("radius_meters", 100)

    if not (name and latitude and longitude):
        return jsonify({"error": "name, latitude, longitude required"}), 400

    zone = GeofenceZone(
        name=name,
        latitude=latitude,
        longitude=longitude,
        radius_meters=radius_meters,
        created_by=int(get_jwt_identity()),
    )
    db.session.add(zone)
    db.session.commit()
    return jsonify(zone.to_dict()), 201


@geofence_bp.route("/<int:zone_id>", methods=["GET"])
@jwt_required()
def get_zone(zone_id):
    zone = GeofenceZone.query.get_or_404(zone_id)
    return jsonify(zone.to_dict())


@geofence_bp.route("/<int:zone_id>", methods=["PUT", "PATCH"])
@jwt_required()
def update_zone(zone_id):
    claims = get_jwt()
    if not _admin_or_teacher(claims):
        return jsonify({"error": "admin or teacher required"}), 403

    zone = GeofenceZone.query.get_or_404(zone_id)
    data = request.get_json() or {}

    if "name"          in data: zone.name          = data["name"]
    if "latitude"      in data: zone.latitude       = data["latitude"]
    if "longitude"     in data: zone.longitude      = data["longitude"]
    if "radius_meters" in data: zone.radius_meters  = data["radius_meters"]
    if "active"        in data: zone.active         = data["active"]

    db.session.commit()
    return jsonify(zone.to_dict())


@geofence_bp.route("/<int:zone_id>", methods=["DELETE"])
@jwt_required()
def delete_zone(zone_id):
    claims = get_jwt()
    if not _admin_or_teacher(claims):
        return jsonify({"error": "admin or teacher required"}), 403

    zone = GeofenceZone.query.get_or_404(zone_id)
    zone.active = False   # soft delete
    db.session.commit()
    return jsonify({"message": "zone deactivated", "id": zone_id})


@geofence_bp.route("/check", methods=["POST"])
@jwt_required()
def check_location():
    """
    Quick check: is (lat, lon) inside zone?
    Body: { zone_id, lat, lon, accuracy? }
    """
    from services.geofence import within_geofence
    data     = request.get_json() or {}
    zone_id  = data.get("zone_id")
    lat      = data.get("lat")
    lon      = data.get("lon")
    accuracy = data.get("accuracy")

    if not (zone_id and lat and lon):
        return jsonify({"error": "zone_id, lat, lon required"}), 400

    zone = GeofenceZone.query.get_or_404(zone_id)
    result = within_geofence(
        float(zone.latitude), float(zone.longitude),
        float(lat), float(lon),
        radius_meters=float(zone.radius_meters),
        user_accuracy_meters=float(accuracy) if accuracy else None,
    )
    return jsonify({
        "inside":            result.inside,
        "distance_meters":   round(result.distance_meters, 2),
        "radius_meters":     round(result.radius_meters, 2),
        "accuracy_adjusted": result.accuracy_adjusted,
        "zone":              zone.to_dict(),
    })
