import { useEffect, useRef } from 'react'
import type { RefObject } from 'react'
import { registerDismissable } from './dismissStack'

export interface UseDismissableOptions {
  /** Закрыть слой. Вызывается только когда Esc пришёл именно в этот слой. */
  onDismiss: () => void
  /**
   * Куда вернуть фокус после Esc. Возврат остаётся за слоем: попап указывает
   * на свой чип, редактор — на строку задачи. Если ссылки нет, фокус не
   * трогаем (так ведёт себя закрытие без клавиатуры).
   */
  returnFocusTo?: RefObject<HTMLElement | null>
}

/**
 * Подключает компонент к стеку Esc (`dismissStack`). Монтировать только пока
 * слой открыт: закрытие размонтирует компонент, и слой снимается со стека сам
 * — отдельного флага `open` прокидывать не нужно.
 *
 * В вызывающем коде не остаётся ни `addEventListener`, ни рассуждений о
 * порядке слушателей: стек гарантирует, что Esc уйдёт только верхнему слою.
 *
 * Единственное ограничение порядка: вложенный слой не должен открываться в том
 * же коммите, что и родительский. Эффекты детей в React выполняются раньше
 * родительских, поэтому такой слой лёг бы под родителя. На практике слои
 * открываются последовательно (сначала редактор, потом попап в нём).
 */
export function useDismissable({ onDismiss, returnFocusTo }: UseDismissableOptions): void {
  const latest = useRef({ onDismiss, returnFocusTo })

  useEffect(() => {
    latest.current = { onDismiss, returnFocusTo }
  })

  // Пустые зависимости намеренно: слой встаёт в стек один раз при монтировании.
  // Перерегистрация на смену идентичности `onDismiss` поднимала бы слой на
  // вершину стека при каждом ререндере родителя.
  useEffect(
    () =>
      registerDismissable({
        onDismiss: () => {
          latest.current.onDismiss()
          latest.current.returnFocusTo?.current?.focus()
        },
      }),
    [],
  )
}
