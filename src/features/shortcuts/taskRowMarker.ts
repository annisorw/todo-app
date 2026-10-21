/**
 * The DOM marker that tells the keyboard layer «this element is a task row».
 *
 * `useGlobalShortcuts` needs it because `Esc` on an empty dismiss stack drops
 * focus out of a row, and a `document`-level listener cannot learn that from
 * the React tree. Written out as a bare attribute in two unrelated files it
 * was a contract nothing checked — a typo on either side would have failed
 * silently, so both sides spell it once, here.
 */
const TASK_ROW_ATTRIBUTE = 'data-task-row'

/** Spread onto the row element: `<motion.li {...taskRowMarker}>`. */
export const taskRowMarker = { [TASK_ROW_ATTRIBUTE]: '' } as const

/** For `closest()` from anything focused inside a row. */
export const TASK_ROW_SELECTOR = `[${TASK_ROW_ATTRIBUTE}]`
