export class HttpError extends Error {
  constructor(status, message) { super(message); this.status = status }
}
export const httpError = (status, message) => new HttpError(status, message)
// Express 5 forwards rejected promises to the error handler, so handlers can just `throw httpError(...)`.
