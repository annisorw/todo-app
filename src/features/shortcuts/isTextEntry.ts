/**
 * Input types that hold text the user is editing. `checkbox`, `radio` and the
 * button-ish types are deliberately absent: the task row's roving focus anchor
 * *is* a native checkbox (design-spec 3.10), so treating every `<input>` as a
 * text field would mute every shortcut on a focused row.
 */
const TEXT_INPUT_TYPES = new Set([
  'text',
  'search',
  'email',
  'url',
  'tel',
  'password',
  'number',
  'date',
  'datetime-local',
  'month',
  'time',
  'week',
])

/**
 * Is the user typing into something? Both shortcut hooks gate on this, so the
 * answer is defined once — «клавиши не срабатывают при вводе в поле, в
 * `textarea`» (issue point 2) has to mean the same thing in both.
 */
export function isTextEntry(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  if (target.isContentEditable) return true

  if (target instanceof HTMLTextAreaElement) return true
  if (target instanceof HTMLSelectElement) return true
  if (target instanceof HTMLInputElement) return TEXT_INPUT_TYPES.has(target.type)

  return false
}
