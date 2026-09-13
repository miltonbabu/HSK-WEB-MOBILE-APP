import { adaptToNext } from '@/lib/vercel-adapter'
import handler from '@/../api/ai/chat'

export const POST = (req: Request) => adaptToNext(handler, req)
export const GET = (req: Request) => adaptToNext(handler, req)
export const OPTIONS = (req: Request) => adaptToNext(handler, req)
