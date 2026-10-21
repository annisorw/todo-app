import { useState } from 'react'
import { downloadJson } from '../lib/downloadJson'
import type { StorageError } from '../storage/localStorageDriver'
import { isUnreadableError } from '../storage/taskStorage'
import { useQuarantineBackup } from '../state/useQuarantineBackup'
import { useTaskStore } from '../state/useTaskStore'
import { Button } from './Button'
import { ConfirmDialog } from './ConfirmDialog'
import { NoticeBlock } from './NoticeBlock'

export interface ErrorBannerProps {
  className?: string
}

interface Copy {
  title: string
  body: string
}

/**
 * Texts for `blocked` are verbatim from design-spec S9. `quota` is written in
 * the same voice (spec section 7, "Язык и текст"). `corrupted` is verbatim
 * from `design-quarantine-surface` §4A/§9 ([FELA-73](/FELA/issues/FELA-73)),
 * which fixed the tense ("не удалось", not "не удаётся" — the read failed
 * once at startup and won't repeat this session) and dropped the "corrupted
 * and unreadable" repetition plus the "raw bytes" jargon term.
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
    title: 'Не удалось прочитать сохранённые задачи',
    body: 'Сохранённые задачи не читаются, поэтому список начат заново. Повреждённая копия осталась в браузере — её можно выгрузить в файл и попробовать восстановить вручную.',
  },
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
 * design-spec 3.21 / S9, delta `design-quarantine-surface` §4A
 * ([FELA-73](/FELA/issues/FELA-73)). Reads `storageError` straight from the
 * store — the one deliberate exception to "components/ doesn't know about
 * the store" (architecture doc section 2): the export button needs the live
 * task list.
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
 *
 * The quarantine export/delete pair is `useQuarantineBackup` — the same hook
 * `QuarantineNotice` uses, since the surface outlives this banner's session
 * ([FELA-79](/FELA/issues/FELA-79)). Both its buttons render only while
 * `backup !== null`: an empty quarantine leaves nothing to export or delete,
 * so there is no "nothing to export" toast branch here anymore either.
 */
export function ErrorBanner({ className }: ErrorBannerProps) {
  const { storageError, tasks, retryPersist } = useTaskStore()
  const { backup, exportToFile, remove } = useQuarantineBackup()
  const [confirmOpen, setConfirmOpen] = useState(false)

  if (storageError === null) return null

  const copy = COPY[storageError]
  const isUnreadable = isUnreadableError(storageError)

  const handleExportInMemory = () => {
    downloadJson('aurora-tasks.json', JSON.stringify({ version: 1, tasks }))
  }

  return (
    <>
      <NoticeBlock
        role="alert"
        tone="danger"
        icon={
          <span className="text-danger">
            <WarningIcon />
          </span>
        }
        title={copy.title}
        body={copy.body}
        className={className}
      >
        {!isUnreadable && (
          <>
            <Button variant="secondary" size="sm" onClick={retryPersist}>
              Повторить
            </Button>
            <Button variant="ghost" size="sm" onClick={handleExportInMemory}>
              Выгрузить в файл
            </Button>
          </>
        )}
        {isUnreadable && backup !== null && (
          <>
            <Button variant="secondary" size="sm" onClick={exportToFile}>
              Выгрузить в файл
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setConfirmOpen(true)}>
              Удалить копию
            </Button>
          </>
        )}
      </NoticeBlock>

      {isUnreadable && (
        <ConfirmDialog
          open={confirmOpen}
          title="Удалить повреждённую копию?"
          body="Копия удалится из браузера, и восстановить её будет нельзя. Текущий список задач останется на месте."
          confirmLabel="Удалить копию"
          cancelLabel="Отмена"
          confirmVariant="danger"
          onConfirm={() => {
            remove()
            setConfirmOpen(false)
          }}
          onCancel={() => setConfirmOpen(false)}
        />
      )}
    </>
  )
}
