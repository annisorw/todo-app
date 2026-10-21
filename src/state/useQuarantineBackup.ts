import { useCallback, useState } from 'react'
import { downloadJson } from '../lib/downloadJson'
import { readCorruptedBackup, removeCorruptedBackup } from '../storage/taskStorage'
import { useToast } from './useToast'

export interface QuarantineBackup {
  /** `null` — карантин пуст, кнопки у вызывающих компонентов не рисуются. */
  backup: string | null
  exportToFile: () => void
  remove: () => void
}

/**
 * Единственный источник правды по карантинной копии для `ErrorBanner`
 * (состояние A) и `QuarantineNotice` (состояние B) — [FELA-79](/FELA/issues/FELA-79).
 *
 * Читает `CORRUPTED_BACKUP_KEY` один раз при монтировании, а не на каждый
 * клик: обе кнопки рисуются только пока карантин непуст, значит к моменту
 * клика значение уже доказано существующим, и ветки «нажал, а читать нечего»
 * не существует.
 *
 * Успешное удаление тоже отвечает тостом отсюда, а не из вызывающих
 * компонентов — это второй вызывающий (следующий за `ErrorBanner`), ради
 * которого объявление стоит держать в одном месте.
 */
export function useQuarantineBackup(): QuarantineBackup {
  const { pushToast } = useToast()
  const [backup, setBackup] = useState<string | null>(() => {
    const result = readCorruptedBackup()
    return result.ok ? result.value : null
  })

  const exportToFile = useCallback(() => {
    if (backup === null) return
    downloadJson('aurora-tasks-backup.json', backup)
  }, [backup])

  const remove = useCallback(() => {
    const error = removeCorruptedBackup()
    if (error !== null) return
    setBackup(null)
    pushToast({ variant: 'success', message: 'Повреждённая копия удалена.' })
  }, [pushToast])

  return { backup, exportToFile, remove }
}
