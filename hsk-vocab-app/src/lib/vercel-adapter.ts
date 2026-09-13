import type { VercelRequest, VercelResponse } from '@vercel/node'


type VercelHandler = (req: VercelRequest, res: VercelResponse) => Promise<void | VercelResponse> | void | VercelResponse

export async function adaptToNext(handler: VercelHandler, req: Request): Promise<Response> {
  const url = new URL(req.url)
  const headers: Record<string, string | string[]> = {}
  req.headers.forEach((value, key) => {
    headers[key] = value
  })

  const body = req.method !== 'GET' && req.method !== 'HEAD' ? await req.text() : ''

  const vercelReq = {
    method: req.method,
    url: url.pathname + url.search,
    headers,
    query: Object.fromEntries(url.searchParams),
    body: body || undefined,
    socket: { remoteAddress: headers['x-vercel-ip'] || headers['x-forwarded-for']?.toString().split(',')[0] || '0.0.0.0' },
  } as unknown as VercelRequest

  const responseHeaders: Record<string, string | string[]> = {}
  let statusCode = 200
  let responseBody: unknown = ''


  const vercelRes = {
    statusCode,
    status(code: number) {
      statusCode = code
      return this
    },
    setHeader(name: string, value: string | string[]) {
      responseHeaders[name] = value
      return this
    },
    getHeader(name: string) {
      return responseHeaders[name]
    },
    removeHeader(name: string) {
      delete responseHeaders[name]
    },
    end(data?: unknown) {
      if (data !== undefined) responseBody = data

      return this
    },
    json(data: unknown) {
      responseBody = JSON.stringify(data)
      responseHeaders['content-type'] = 'application/json'
      return this
    },
    send(data: unknown) {
      responseBody = data
      return this
    },
    write(data: unknown) {
      responseBody = (responseBody || '') + (typeof data === 'string' ? data : String(data))
      return true
    },
  } as unknown as VercelResponse

  await handler(vercelReq, vercelRes)

  const resHeaders = new Headers()
  for (const [key, value] of Object.entries(responseHeaders)) {
    if (Array.isArray(value)) {
      for (const v of value) resHeaders.append(key, v)
    } else {
      resHeaders.set(key, value)
    }
  }

  const bodyStr = typeof responseBody === 'string' ? responseBody : JSON.stringify(responseBody)
  return new Response(bodyStr || null, { status: statusCode, headers: resHeaders })
}