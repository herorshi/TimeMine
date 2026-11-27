// Business time zone. Must be the first import of every entry (app.js, seed.js): Vercel runs in UTC,
// and lateMinutes()/toDateStr() use local time.
process.env.TZ = process.env.APP_TZ || 'Asia/Bangkok'
