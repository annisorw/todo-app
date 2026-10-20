/** Joins class names, dropping falsy values. No merging/dedup — components here don't need it. */
export function cn(...classes: Array<string | false | null | undefined>): string {
  return classes.filter(Boolean).join(' ')
}
