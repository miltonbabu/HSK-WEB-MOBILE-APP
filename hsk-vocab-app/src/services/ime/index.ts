import { wordService } from '@/services/sqlite-api'
import { createImeDictionary, ImeDictionary } from './imeDictionary'

export type { ImeDictionary } from './imeDictionary'

let cache: ImeDictionary | null = null
let pending: Promise<ImeDictionary> | null = null

/**
 * Lazily build (and memoise) the IME dictionary from the vocabulary table.
 * The dictionary is small enough to construct on demand and reused for the
 * lifetime of the page.
 */
export async function getImeDictionary(): Promise<ImeDictionary> {
  if (cache) return cache
  if (pending) return pending

  pending = (async () => {
    const words = await wordService.getAll()
    const dictionary = createImeDictionary(words)
    cache = dictionary
    pending = null
    return dictionary
  })()

  return pending
}

export function resetImeDictionary(): void {
  cache = null
  pending = null
}