import { useEffect, useRef, useState } from 'react'
import { useQuarantineBackup } from '../state/useQuarantineBackup'
import { useTaskStore } from '../state/useTaskStore'
import { Button } from './Button'
import { ConfirmDialog } from './ConfirmDialog'
import { NoticeBlock } from './NoticeBlock'

/**
 * Mirrors the `animate-notice-out` keyframe duration in `styles/base.css`.
 * jsdom has no `AnimationEvent`, so unmounting is driven by this timeout
 * instead of `onAnimationEnd` (same gotcha as `TOAST_EXIT_MS`).
 */
const NOTICE_EXIT_MS = 160

function ArchiveIcon() {
  return (
    <svg viewBox="0 0 20 20" width="20" height="20" fill="none" aria-hidden="true">
      <path d="M1.5 4.5h17v3h-17v-3Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
      <path d="M2.5 7.5h15v8a1.5 1.5 0 0 1-1.5 1.5h-12a1.5 1.5 0 0 1-1.5-1.5v-8Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
      <path d="M8 10.5h4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  )
}

/**
 * design-quarantine-surface §4B/§3.21a — постоянная поверхность карантина,
 * которая живёт ровно столько, сколько байты в `CORRUPTED_BACKUP_KEY`
 * ([FELA-79](/FELA/issues/FELA-79)). Тот же слот над списком, где стоит
 * `ErrorBanner`; оба условия взаимоисключающие по `storageError`
 * (`null` здесь, не `null` у баннера), так что рендерить оба рядом безопасно
 * — лишний `storageError === 'quota' | 'blocked'` сам подавляет этот блок.
 *
 * Крестик прячет блок **на сессию**: `hidden` — обычный React state, который
 * не переживает ни размонтирование, ни перезагрузку страницы, а байты он не
 * трогает вовсе — это и даёт «вернётся при следующем запуске» из §4B без
 * какого-либо хранения состояния видимости.
 */
export function QuarantineNotice() {
  const { storageError } = useTaskStore()
  const { backup, exportToFile, remove } = useQuarantineBackup()
  const [closing, setClosing] = useState(false)
  const [hidden, setHidden] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const exitTimeoutRef = useRef<number | null>(null)

  useEffect(
    () => () => {
      if (exitTimeoutRef.current !== null) window.clearTimeout(exitTimeoutRef.current)
    },
    [],
  )

  if (storageError !== null || backup === null || hidden) return null

  const handleHide = () => {
    setClosing(true)
    exitTimeoutRef.current = window.setTimeout(() => setHidden(true), NOTICE_EXIT_MS)
  }

  return (
    <>
      <NoticeBlock
        role="status"
        tone="neutral"
        icon={<span className="text-tertiary"><ArchiveIcon /></span>}
        title="Осталась повреждённая копия задач"
        body="Эту копию сохранили, когда список не удалось прочитать. Выгрузите её в файл или удалите — на текущий список это не повлияет."
        onHide={handleHide}
        className={closing ? 'animate-notice-out' : undefined}
      >
        <Button variant="secondary" size="sm" onClick={exportToFile}>
          Выгрузить в файл
        </Button>
        <Button variant="ghost" size="sm" onClick={() => setConfirmOpen(true)}>
          Удалить копию
        </Button>
      </NoticeBlock>

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
    </>
  )
}
