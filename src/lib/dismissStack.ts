/**
 * Единственный владелец Esc во всём приложении.
 *
 * Один слушатель `keydown` на `document` в фазе перехвата плюс стек открытых
 * слоёв — попапов, меню, модалок, редактора. Esc закрывает **верхний** слой и
 * дальше не идёт: ни к слоям под ним, ни к обработчикам вне стека.
 *
 * Почему не «слушатель на каждый попап + `stopPropagation`»: у `document` нет
 * предков, останавливать нечего, и остальные слушатели на том же `document`
 * всё равно срабатывают на то же нажатие. `stopImmediatePropagation` тоже не
 * лечит — он зависит от порядка регистрации, а редактор монтируется раньше
 * попапа и регистрируется первым. Порядок регистрации — не то, на чём можно
 * строить поведение, поэтому слушатель ровно один, а очередь задаёт стек.
 *
 * В компонентах прямых `document.addEventListener('keydown', ...)` быть не
 * должно: слой подключается хуком `useDismissable`, а глобальные горячие
 * клавиши спрашивают `isDismissableOpen()`.
 */

export interface DismissLayer {
  /** Закрыть этот слой. Вызывается, только когда слой — верхний в стеке. */
  onDismiss: () => void
}

/** Нижний элемент — самый ранний слой, верхний — тот, что закроет следующий Esc. */
let layers: readonly DismissLayer[] = []

let listening = false

function handleKeyDown(event: KeyboardEvent): void {
  if (event.key !== 'Escape') return

  const top = layers.at(-1)
  if (top === undefined) return

  // Esc принадлежит верхнему слою целиком: ни нижние слои, ни чужие
  // слушатели (например глобальные горячие клавиши) это нажатие не видят.
  event.preventDefault()
  event.stopPropagation()

  // Снимаем слой до вызова: `onDismiss` обычно размонтирует его, и приходящее
  // следом снятие по идентичности должно быть пустой операцией, а не снимать
  // соседний слой.
  layers = layers.slice(0, -1)
  syncListener()

  top.onDismiss()
}

function syncListener(): void {
  const needed = layers.length > 0
  if (needed === listening) return

  if (needed) {
    document.addEventListener('keydown', handleKeyDown, true)
  } else {
    document.removeEventListener('keydown', handleKeyDown, true)
  }
  listening = needed
}

/**
 * Кладёт слой на вершину стека и возвращает функцию снятия. Снятие работает по
 * идентичности объекта, поэтому порядок размонтирования слоёв значения не
 * имеет и повторный вызов безопасен.
 *
 * Регистрировать слой нужно ровно тогда, когда он открыт: открылся — положили,
 * закрылся любым способом (Esc, клик снаружи, выбор пункта, сохранение) —
 * сняли.
 */
export function registerDismissable(layer: DismissLayer): () => void {
  layers = [...layers, layer]
  syncListener()

  return () => {
    const next = layers.filter((candidate) => candidate !== layer)
    if (next.length === layers.length) return

    layers = next
    syncListener()
  }
}

/**
 * «Есть ли что-то открытое». Читатель для глобальных горячих клавиш
 * ([FELA-20](/FELA/issues/FELA-20)): пока открыт хоть один слой, одиночные
 * буквенные хоткеи и Esc-правила верхнего уровня не должны срабатывать.
 */
export function isDismissableOpen(): boolean {
  return layers.length > 0
}
