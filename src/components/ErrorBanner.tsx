import type { StorageError } from '../storage/localStorageDriver'
import { isUnreadableError, readCorruptedBackup } from '../storage/taskStorage'
import { useTaskStore } from '../state/useTaskStore'
import { useToast } from '../state/useToast'
import { Button } from './Button'
import { cn } from '../lib/cn'

export interface ErrorBannerProps {
  className?: string
}

interface Copy {
  title: string
  body: string
}

/**
 * Texts for `blocked` are verbatim from design-spec S9. `quota` and
 * `corrupted` aren't given literal copy there (only "scenario exists"), so
 * these two are written in the same voice — plain language, says what
 * happened and what to do, no blame (spec section 7, "Язык и текст"). Flagged
 * to Designer for sign-off in the FELA-18 task comment; not blocking on it.
 */
const COPY: Record<StorageError, Copy> = {
  blocked: {
    title: 'Не удаётся сохранить изменения',
    body: 'Браузер заблокировал локальное хранилище — скорее всего, включён приватный режим. Задачи в этой вкладке работают, но после закрытия пропадут.',
  },
  quota: {
    title: 'Не удаётся сохранить изменения',
    body: 'Место в хранилище браузера закончилось. Задачи в этой вкладке продолжают работать, но новые изменения не сохранятся, пока место не освободится.',
  },
  corrupted: {
    title: 'Не удаётся прочитать сохранённые задачи',
    body: 'Сохранённые данные повреждены и не читаются. Список сейчас пуст, но исходные байты сохранены — их можно выгрузить и попробовать восстановить вручную.',
  },
}

function downloadJson(filename: string, content: string): void {
  const blob = new Blob([content], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  link.remove()
  // Revoking in the same tick as the click can abort the download in Firefox.
  window.setTimeout(() => URL.revokeObjectURL(url), 0)
}

function WarningIcon() {
  return (
    <svg viewBox="0 0 20 20" width="20" height="20" fill="none" aria-hidden="true">
      <path
        d="M10 2 18 17H2L10 2Z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <path d="M10 8v4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M10 14.5h.01" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  )
}

/**
 * design-spec 3.21 / S9. Reads `storageError` straight from the store — the
 * one deliberate exception to "components/ doesn't know about the store"
 * (architecture doc section 2): the export button needs the live task list,
 * and the corrupted-data export needs the quarantined raw bytes that only
 * `storage/taskStorage.ts` keeps (its own comments point straight at this
 * ticket, [FELA-18](/FELA/issues/FELA-18)).
 *
 * "Повторить" really retries: `retryPersist` writes the current list right
 * away and the banner closes only if that write succeeded. For `blocked` the
 * retry just fails with the same code, which is the honest answer, and for
 * `quota` it is the whole point ([FELA-64](/FELA/issues/FELA-64)).
 *
 * For `corrupted` that button is **not rendered at all**
 * ([FELA-70](/FELA/issues/FELA-70)): the read is what failed, writing works, so
 * a retry would succeed, clear `storageError` and take the banner away — along
 * with the only control in the whole interface that hands back the quarantined
 * bytes. A person reading "Повторить" would lose their own backup by pressing
 * it. There is nothing to retry here, so there is no button; the store refuses
 * the same thing from its side.
 */
export function ErrorBanner({ className }: ErrorBannerProps) {
  const { storageError, tasks, retryPersist } = useTaskStore()
  const { pushToast } = useToast()

  if (storageError === null) return null

  const copy = COPY[storageError]
  const isUnreadable = isUnreadableError(storageError)

  const handleExport = () => {
    if (isUnreadable) {
      const backup = readCorruptedBackup()
      // No quarantined bytes (or the quarantine read itself failed) means
      // there is nothing to restore — downloading an empty envelope here
      // would read as "your data is safe" when it is actually gone.
      if (!backup.ok || backup.value === null) {
        pushToast({ variant: 'danger', message: 'Выгружать нечего: повреждённые данные не сохранились.' })
        return
      }
      downloadJson('aurora-tasks-backup.json', backup.value)
      return
    }
    downloadJson('aurora-tasks.json', JSON.stringify({ version: 1, tasks }))
  }

  return (
    <div
      role="alert"
      className={cn(
        'flex flex-col gap-(--space-4) rounded-(--radius-lg) border border-danger/30 bg-surface-2 p-(--space-4) sm:flex-row sm:items-start sm:justify-between',
        className,
      )}
    >
      <div className="flex gap-(--space-3)">
        <span className="shrink-0 text-danger">
          <WarningIcon />
        </span>
        <div>
          <p className="text-body-strong text-primary">{copy.title}</p>
          <p className="text-body text-secondary">{copy.body}</p>
        </div>
      </div>

      <div className="flex shrink-0 gap-(--space-2)">
        {!isUnreadable && (
          <Button variant="secondary" size="sm" onClick={retryPersist}>
            Повторить
          </Button>
        )}
        <Button variant="ghost" size="sm" onClick={handleExport}>
          Выгрузить в файл
        </Button>
      </div>
    </div>
  )
}
