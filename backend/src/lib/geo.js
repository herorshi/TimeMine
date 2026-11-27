// Geofence helpers: haversine distance + safe parsing of the client-sent location.
const R = 6371000 // earth radius, metres

const rad = (d) => (d * Math.PI) / 180

export function distanceMeters(lat1, lng1, lat2, lng2) {
  const dLat = rad(lat2 - lat1)
  const dLng = rad(lng2 - lng1)
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(a)))
}

// body.location = {lat, lng, accuracy?} → {lat, lng, accuracy} | null when missing/invalid
export function readLocation(body) {
  const loc = body?.location
  if (!loc || typeof loc !== 'object') return null
  const lat = typeof loc.lat === 'number' ? loc.lat : (typeof loc.lat === 'string' && loc.lat.trim() !== '' ? Number(loc.lat) : NaN)
  const lng = typeof loc.lng === 'number' ? loc.lng : (typeof loc.lng === 'string' && loc.lng.trim() !== '' ? Number(loc.lng) : NaN)
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) return null
  const acc = typeof loc.accuracy === 'number' ? loc.accuracy : NaN
  return { lat, lng, accuracy: Number.isFinite(acc) && acc >= 0 ? acc : null }
}
