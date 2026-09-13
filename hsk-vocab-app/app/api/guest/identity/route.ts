import { adaptToNext } from '@/lib/vercel-adapter'
import handler from '@/../api/guest/identity'

export const GET = (req: Request) => adaptToNext(handler, req)
export const OPTIONS = (req: Request) => adaptToNext(handler, req)