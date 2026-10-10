// _shared/http.ts
// Tiny request wrapper: CORS, method checks, JSON parsing, uniform errors.
import { getCorsHeaders } from './cors.ts'

export class HttpError extends Error {
  constructor(public status: number, message: string, public details?: unknown) {
    super(message)
  }
}

// Widget + public endpoints are called from partner websites (any origin).
// They never use cookies, so a wildcard origin is safe here.
export const widgetCorsHeaders: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type, x-quidly-key',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
}

type Handler = (req: Request, cors: Record<string, string>) => Promise<Response>

export function handle(fn: Handler, opts: { widget?: boolean } = {}) {
  return async (req: Request): Promise<Response> => {
    const cors = opts.widget ? widgetCorsHeaders : getCorsHeaders(req)
    if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
    try {
      return await fn(req, cors)
    } catch (e) {
      if (e instanceof HttpError) {
        return reply(cors, { error: e.message, details: e.details ?? null }, e.status)
      }
      console.error(e)
      return reply(cors, { error: 'Internal server error', details: null }, 500)
    }
  }
}

export function reply(
  cors: Record<string, string>,
  body: unknown,
  status = 200,
  extraHeaders: Record<string, string> = {},
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, ...extraHeaders, 'Content-Type': 'application/json' },
  })
}

export async function readJson(req: Request): Promise<Record<string, any>> {
  try {
    const body = await req.json()
    return body && typeof body === 'object' ? body : {}
  } catch {
    throw new HttpError(400, 'Invalid JSON body')
  }
}

export function requireMethod(req: Request, ...methods: string[]) {
  if (!methods.includes(req.method)) throw new HttpError(405, 'Method not allowed')
}
