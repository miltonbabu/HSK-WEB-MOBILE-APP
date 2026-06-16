// Tiny class-name combiner. Falsy values are dropped.
export function cn(...classes: Array<string | number | false | null | undefined>): string {
  return classes.filter(Boolean).join(' ')
}
