import nodemailer from 'nodemailer'

// SMTP from env; without SMTP_HOST we fall back to an Ethereal test inbox (dev only, mail is never delivered).
export const APP_URL = (process.env.APP_URL || 'http://localhost:3000').replace(/\/+$/, '')
export const usingEthereal = () => !process.env.SMTP_HOST

let ready // created once, shared by all messages

async function createMailer() {
  if (usingEthereal()) {
    const account = await nodemailer.createTestAccount()
    return {
      from: process.env.MAIL_FROM || `TimeMint <${account.user}>`,
      transport: nodemailer.createTransport({ ...account.smtp, auth: { user: account.user, pass: account.pass } }),
    }
  }
  const { SMTP_HOST, SMTP_PORT, SMTP_SECURE, SMTP_USER, SMTP_PASS, MAIL_FROM } = process.env
  return {
    from: MAIL_FROM || SMTP_USER,
    transport: nodemailer.createTransport({
      host: SMTP_HOST,
      port: Number(SMTP_PORT || 587),
      secure: SMTP_SECURE === 'true' || SMTP_SECURE === '1',
      auth: SMTP_USER ? { user: SMTP_USER, pass: SMTP_PASS } : undefined,
    }),
  }
}

/** sends one message; resolves { previewUrl } (null unless Ethereal) */
export async function sendMail({ to, subject, html, text }) {
  ready ??= createMailer().catch((err) => { ready = undefined; throw err })
  const { from, transport } = await ready
  const info = await transport.sendMail({ from, to, subject, html, text })
  const previewUrl = usingEthereal() ? nodemailer.getTestMessageUrl(info) || null : null
  if (previewUrl) console.log(`[mail] preview: ${previewUrl}`)
  return { previewUrl }
}
