/**
 * Every hard limit in the product, declared exactly once.
 *
 * Source: threat model (FELA-4, sections 3-4), short form in `docs/CODE-RULES.md`
 * section 3. The storage parser and writer, the composer input `maxLength` and the
 * search field all import from here. A second copy of one of these numbers will
 * drift away from this one, so there is no second copy.
 */

/** Characters in a task title, after trimming the edges. */
export const MAX_TITLE_LENGTH = 500

/** Where the title character counter starts showing (design-spec 3.7, 3.11a: from the 450th of 500). */
export const TITLE_COUNTER_THRESHOLD = MAX_TITLE_LENGTH - 50

/** Tasks held in the list at once. Caps what a hostile `localStorage` payload can grow to. */
export const MAX_TASKS = 1000

/** Characters of a search query that are actually used for matching. */
export const MAX_QUERY_LENGTH = 100
