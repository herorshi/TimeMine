// LINE Messaging API push to admins. Credentials come from env only; never log them.
const PUSH_URL = 'https://api.line.me/v2/bot/message/push'
const TIMEOUT_MS = 5000

async function push(token, to, text) {
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS)
  try {
    const res = await fetch(PUSH_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ to, messages: [{ type: 'text', text }] }),
      signal: ctrl.signal,
    })
    if (!res.ok) console.error('[line] push failed', res.status)
  } catch (e) {
    // log the error name only: error messages may echo the Authorization header
    console.error('[line] push failed', e?.name)
  } finally {
    clearTimeout(timer)
  }
}

/** sends text to every id in LINE_ADMIN_USER_IDS; never rejects */
export async function notifyAdmins(text) {
  const token = process.env.LINE_CHANNEL_ACCESS_TOKEN
  const ids = (process.env.LINE_ADMIN_USER_IDS || '').split(',').map((s) => s.trim()).filter(Boolean)
  if (!token || !ids.length) {
    console.warn('[line] not configured, notification skipped')
    return
  }
  await Promise.all(ids.map((to) => push(token, to, text)))
}
