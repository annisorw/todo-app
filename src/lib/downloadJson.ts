/**
 * Triggers a browser download of `content` as `filename`.
 *
 * Revoking the object URL in the same tick as the click can abort the
 * download in Firefox, hence the deferred `setTimeout`.
 */
export function downloadJson(filename: string, content: string): void {
  const blob = new Blob([content], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  link.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 0)
}
