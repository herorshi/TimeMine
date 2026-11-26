import { getSettings } from './settings.js'

export const euclidean = (a, b) => Math.sqrt(a.reduce((s, v, i) => s + (v - b[i]) ** 2, 0))
export const isDescriptor = (d) => Array.isArray(d) && d.length === 128 && d.every((v) => typeof v === 'number')

/** compare a live descriptor (128 floats from face-api.js) with the user's enrolled one */
export function verifyFace(user, descriptor) {
  if (!user.face_descriptor) return { enrolled: false, match: false, distance: null }
  if (!isDescriptor(descriptor)) return { enrolled: true, match: false, distance: null }
  const distance = euclidean(JSON.parse(user.face_descriptor), descriptor)
  return { enrolled: true, match: distance <= Number(getSettings().face_threshold), distance: Math.round(distance * 1000) / 1000 }
}
