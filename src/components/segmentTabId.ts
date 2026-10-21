/** Predictable `SegmentedControl` tab id, shared with callers that need to point `aria-labelledby` at it. */
export function segmentTabId(idPrefix: string, optionId: string): string {
  return `${idPrefix}-tab-${optionId}`
}
