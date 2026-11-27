// Announcement images: Vercel Blob when BLOB_READ_WRITE_TOKEN is set, otherwise a data: URL (local dev).
import { randomUUID } from 'node:crypto'
import { put, del } from '@vercel/blob'

const EXT = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/gif': 'gif' }

/** true only for announcement images in our own blob store (the store id is part of the token) */
export function isBlobUrl(url) {
  const store = String(process.env.BLOB_READ_WRITE_TOKEN || '').split('_')[3]?.toLowerCase()
  if (!store) return false
  try {
    const u = new URL(url)
    return u.protocol === 'https:' && u.host === `${store}.public.blob.vercel-storage.com` && (u.pathname.startsWith('/announcements/') || u.pathname.startsWith('/faces/'))
  } catch { return false }
}

export async function saveImage(buffer, contentType, name = randomUUID()) {
  if (!process.env.BLOB_READ_WRITE_TOKEN) return `data:${contentType};base64,${buffer.toString('base64')}`
  const path = name.includes('/') ? name : `announcements/${name}` // 'faces/...' names keep their own folder
  const { url } = await put(`${path}.${EXT[contentType]}`, buffer, { access: 'public', contentType })
  return url
}

/** best effort: a failed cleanup must not fail the request. Data URLs and foreign URLs are ignored. */
export async function deleteImage(url) {
  if (!url || !isBlobUrl(url)) return
  try { await del(url) } catch (e) { console.error('blob delete failed:', e.message) }
}
