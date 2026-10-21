import { Reorder, motion, useDragControls, useMotionValue, useTransform } from 'framer-motion'
import type { DragControls } from 'framer-motion'
import { useEffect, useId, useRef, useState } from 'react'
import type { KeyboardEvent, PointerEvent, RefObject, TouchEvent } from 'react'
import { Checkbox } from '../../components/Checkbox'
import { DragHandle } from '../../components/DragHandle'
import { DueDateChip } from '../../components/DueDateChip'
import { DueDatePicker } from '../../components/DueDatePicker'
import { IconButton } from '../../components/IconButton'
import { Menu } from '../../components/Menu'
import type { MenuItemConfig } from '../../components/Menu'
import { PriorityChip } from '../../components/PriorityChip'
import { PrioritySelect } from '../../components/PrioritySelect'
import { describeDueDate } from '../../domain/dueDate'
import { isDone } from '../../domain/task'
import type { Task, TaskPatch } from '../../domain/task'
import { cn } from '../../lib/cn'
import { highlight } from '../../lib/highlight'
import { useMediaQuery } from '../../lib/useMediaQuery'
import { taskRowMarker } from '../shortcuts/taskRowMarker'
import { TaskEditor } from './TaskEditor'
import { TaskEditorSheet } from './TaskEditorSheet'

const LONG_PRESS_MS = 500
const SWIPE_THRESHOLD_PX = 60
const SWIPE_CANCEL_PX = 10

// Motion table (design-spec section 5), the three drag rows.
type CubicBezier = [number, number, number, number]
const EASE_STANDARD: CubicBezier = [0.2, 0, 0, 1]
const EASE_OUT_SOFT: CubicBezier = [0.16, 1, 0.3, 1]
const EASE_IN_FAST: CubicBezier = [0.4, 0, 1, 1]
const DRAG_LIFT_S = 0.14
const DROP_INDICATOR_S = 0.14
const LIST_REFLOW_S = 0.24
/** `task-add`: 320 / --ease-out-soft. */
const ENTER_TRANSITION = { duration: 0.32, ease: EASE_OUT_SOFT }
/** `task-delete`: 200 / --ease-in-fast. */
const EXIT_TRANSITION = { duration: 0.2, ease: EASE_IN_FAST }

export interface TaskRowReorder {
  /** `Reorder.Item`'s value — the task id. */
  value: string
  /**
   * This row can be picked up. A task checked off keeps its slot in the
   * group for the 600ms `task-settle` window — swapping it out for a plain
   * `<li>` mid-settle would remount the row and lose the toggle underway —
   * but its order is `completedAt` from that moment, so it shows no handle
   * ([FELA-17](/FELA/issues/FELA-17), point 6).
   */
  isMovable: boolean
  /** The row is held in keyboard grab mode (design-spec 6.4). */
  isGrabbed: boolean
  onHandleKeyDown: (event: KeyboardEvent) => void
  onHandleBlur: () => void
  /**
   * The pointer picked this row up / put it down. `useTaskReorder` needs the
   * id to turn `Reorder.Group`'s reordered array into the one move it stands
   * for: with a row hidden between two visible ones, "the one above moved
   * down" and "the one below moved up" are the same array and different
   * orders.
   */
  onDragStart: () => void
  onDragEnd: () => void
}

export interface TaskRowProps {
  task: Task
  query: string
  todayKey: string
  /** Roving tabindex (`useRovingFocus`): `0` while this row is the list's one active Tab stop, else `-1`. */
  tabIndex: 0 | -1
  isEditing: boolean
  registerRef: (node: HTMLElement | null) => void
  onFocus: () => void
  /** Roving tabindex (`useRovingFocus`): ↑/↓ between rows, on the checkbox only. */
  onKeyDown: (event: KeyboardEvent) => void
  /**
   * Row-scoped hot keys (`useRowShortcuts`): `E`, `Delete`/`Backspace`,
   * `Ctrl/Cmd+↑`/`↓`. Sits on the row element rather than on the checkbox so
   * it still fires when Tab has moved focus to the handle, the actions or a
   * chip inside this row.
   */
  onRowKeyDown: (event: KeyboardEvent) => void
  onToggle: () => void
  onOpenEditor: () => void
  onCloseEditor: () => void
  onSave: (patch: TaskPatch) => void
  onRemove: () => void
  /** The desktop row quick-path and `TaskEditor`'s save both patch through this (acceptance criteria 29/30). */
  onQuickChange: (patch: TaskPatch) => void
  /**
   * Present only in the active list, which is the one list with a manual
   * order. It turns the row into a `Reorder.Item`; the `CompletedSection`
   * leaves it off and gets a plain row with no handle, because the order
   * there is `completedAt` ([FELA-17](/FELA/issues/FELA-17), point 6).
   */
  reorder?: TaskRowReorder
}

function MoreIcon() {
  return (
    <svg viewBox="0 0 16 16" className="size-4" fill="currentColor" aria-hidden="true">
      <circle cx="8" cy="3" r="1.3" />
      <circle cx="8" cy="8" r="1.3" />
      <circle cx="8" cy="13" r="1.3" />
    </svg>
  )
}

/**
 * design-spec S10 / acceptance criterion 14 — clamps to 2 lines (3 on
 * mobile) and only offers "Показать целиком" when the text actually
 * overflows that clamp (a short title never gets a pointless chip).
 * Overflow is measured, not guessed from character count: wrapping depends
 * on the row's real width.
 */
function ExpandableTitle({
  task,
  query,
  titleId,
  prefersReducedMotion,
}: {
  task: Task
  query: string
  titleId: string
  prefersReducedMotion: boolean
}) {
  const [expanded, setExpanded] = useState(false)
  const [isOverflowing, setIsOverflowing] = useState(false)
  const textRef = useRef<HTMLParagraphElement>(null)
  const done = isDone(task)

  useEffect(() => {
    function checkOverflow() {
      const node = textRef.current
      if (node === null) return
      setIsOverflowing(node.scrollHeight > node.clientHeight + 1)
    }
    checkOverflow()
    window.addEventListener('resize', checkOverflow)
    return () => window.removeEventListener('resize', checkOverflow)
  }, [task.title, expanded])

  return (
    <div className="flex min-w-0 flex-col gap-(--space-1)">
      <div className="relative">
        <p
          id={titleId}
          ref={textRef}
          className={cn(
            'text-body break-words text-primary',
            done && 'text-tertiary',
            !expanded && 'line-clamp-3 sm:line-clamp-2',
          )}
        >
          {highlight(task.title, query)}
        </p>
        {/* `task-check`'s third part (motion table, section 5): the
         * strikethrough grows (0→100% of the title's own width) instead of
         * the native `line-through` snapping on instantly. A duplicate,
         * `line-through` overlay revealed via `clip-path` (interpolable,
         * unlike a plain `width` here — animating `width` would reflow the
         * overlay's own wrapped lines mid-transition instead of cleanly
         * revealing them), stacked on the real text so it still strikes
         * every wrapped line correctly, not just a single band. It's a
         * sibling of `<p>`, not nested inside it: `textContent` reads
         * through child elements, so a duplicate nested inside would double
         * up `<p>`'s own text for anything asserting on it directly.
         * `text-tertiary` is repeated here (not inherited) so the overlay's
         * color always matches the real text's — one `done` check, two
         * layers, never drifting apart. `select-none` keeps it out of mouse
         * selection / copy, which would otherwise duplicate the title.
         * Rendered through `highlight()`, same as the real `<p>`: a plain
         * `task.title` here would paint this layer's own `text-tertiary`
         * glyphs directly over the real `<mark>` underneath, hiding the
         * pinned `color: var(--color-text-primary)` base.css gives it for
         * contrast on a completed row (spec 3.11/§7) — the overlay needs its
         * own `<mark>` so that rule applies to this layer too. `break-words`
         * matches the `<p>`'s own wrapping so one unbroken long word doesn't
         * run past this layer while the real text below it wraps. */}
        <span
          aria-hidden="true"
          style={{
            clipPath: done ? 'inset(0 0 0 0)' : 'inset(0 100% 0 0)',
            transition: prefersReducedMotion ? 'none' : 'clip-path 240ms var(--ease-spring)',
          }}
          className={cn(
            'pointer-events-none absolute inset-0 overflow-hidden line-through break-words select-none',
            done && 'text-tertiary',
          )}
        >
          {highlight(task.title, query)}
        </span>
      </div>
      {(isOverflowing || expanded) && (
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation()
            setExpanded((value) => !value)
          }}
          className="flex min-h-11 items-center self-start text-caption text-accent-text hover:underline sm:min-h-0"
        >
          {expanded ? 'Свернуть' : 'Показать целиком'}
        </button>
      )}
    </div>
  )
}

/**
 * design-spec 3.11 / 3.12 / 3.13 — the task row: `DragHandle` · `Checkbox` ·
 * title + meta chips · `edit`/`more` actions. Mobile swaps the hover-revealed
 * desktop actions for a long-press or swipe-left — plus a persistent `more`
 * `IconButton` (FELA-120): the gesture is a shortcut, not the only way in,
 * so Menu stays reachable by mouse, touch, and keyboard without it. All
 * three paths open the same `Menu`; Esc returns focus to whichever one
 * actually opened it (`menuAnchorKind`), not always the checkbox.
 *
 * The roving-focus anchor (and the accessible-name target for criterion 25)
 * is the `Checkbox`'s native input, not a wrapping row element — only a real
 * `role="checkbox"` node reads as "флажок" to a screen reader.
 *
 * With a `reorder` prop the row becomes a `Reorder.Item` and wears S8's
 * lifted look while it is held. The move logic itself is not here: both the
 * pointer and the keyboard path live in `useTaskReorder`, and this component
 * only reports what the row is doing.
 */
export function TaskRow({
  task,
  query,
  todayKey,
  tabIndex,
  isEditing,
  registerRef,
  onFocus,
  onKeyDown,
  onRowKeyDown,
  onToggle,
  onOpenEditor,
  onCloseEditor,
  onSave,
  onRemove,
  onQuickChange,
  reorder,
}: TaskRowProps) {
  const isDesktop = useMediaQuery('(min-width: 640px)')
  const prefersReducedMotion = useMediaQuery('(prefers-reduced-motion: reduce)')
  const [menuOpen, setMenuOpen] = useState(false)
  // Esc (criterion in FELA-120) must return focus to whichever element actually opened
  // the menu: the gesture has no focusable origin of its own, so it keeps using the
  // row's roving-focus anchor (the checkbox); the mobile `more` button is its own anchor.
  const [menuAnchorKind, setMenuAnchorKind] = useState<'checkbox' | 'more'>('checkbox')
  const [isDragging, setIsDragging] = useState(false)
  const dragControls = useDragControls()
  // Handed to `Reorder.Item` as its own drag offset so the drop indicator can
  // subtract it back out and stay in the row's layout slot while the card flies.
  const dragY = useMotionValue(0)
  const indicatorY = useTransform(dragY, (value) => -value)
  const rowRef = useRef<HTMLLIElement>(null)
  const checkboxRef = useRef<HTMLInputElement>(null)
  const moreRef = useRef<HTMLButtonElement>(null)
  const longPressTimer = useRef<number | null>(null)
  const touchStartX = useRef<number | null>(null)
  const touchStartY = useRef<number | null>(null)
  const swipeCancelled = useRef(false)

  const titleId = useId()
  const priorityMetaId = useId()
  const dueDateMetaId = useId()

  const done = isDone(task)
  const dueInfo = describeDueDate(task.dueDate, todayKey)
  const isOverdue = dueInfo.status === 'overdue' && !done

  const labelledBy = [
    titleId,
    task.priority !== 'none' ? priorityMetaId : null,
    dueInfo.status !== 'none' ? dueDateMetaId : null,
  ]
    .filter((id): id is string => id !== null)
    .join(' ')

  function setCheckboxNode(node: HTMLInputElement | null) {
    checkboxRef.current = node
    registerRef(node)
  }

  // The checkbox unmounts while `isEditing` (the editor replaces the row's
  // whole body), so a dismiss-stack `returnFocusTo` ref would be null at the
  // exact moment Esc fires. Watching the transition instead covers all four
  // ways the editor closes (Enter, outside click, "Отмена", Esc) with one
  // mechanism, firing only after the checkbox has remounted.
  const wasEditingRef = useRef(isEditing)
  useEffect(() => {
    if (wasEditingRef.current && !isEditing) checkboxRef.current?.focus()
    wasEditingRef.current = isEditing
  }, [isEditing])

  function clearLongPress() {
    if (longPressTimer.current !== null) {
      window.clearTimeout(longPressTimer.current)
      longPressTimer.current = null
    }
  }

  function handleTouchStart(event: TouchEvent<HTMLDivElement>) {
    if (isDesktop) return
    // The "more" button is nested inside this same touch-handling container,
    // so a press-and-hold on it bubbles up and would otherwise also arm the
    // row's long-press gesture; its own click handler already opens the menu,
    // and the gesture firing too closes what the click just opened.
    if (moreRef.current?.contains(event.target as Node)) return
    const touch = event.touches[0]
    touchStartX.current = touch?.clientX ?? null
    touchStartY.current = touch?.clientY ?? null
    swipeCancelled.current = false
    longPressTimer.current = window.setTimeout(() => {
      setMenuAnchorKind('checkbox')
      setMenuOpen(true)
    }, LONG_PRESS_MS)
  }

  function handleTouchMove(event: TouchEvent<HTMLDivElement>) {
    if (touchStartX.current === null || touchStartY.current === null) return
    const touch = event.touches[0]
    if (touch === undefined) return
    const dx = touch.clientX - touchStartX.current
    const dy = touch.clientY - touchStartY.current
    if (!swipeCancelled.current && (Math.abs(dx) > SWIPE_CANCEL_PX || Math.abs(dy) > SWIPE_CANCEL_PX)) {
      swipeCancelled.current = true
      clearLongPress()
    }
  }

  function handleTouchEnd(event: TouchEvent<HTMLDivElement>) {
    clearLongPress()
    const touch = event.changedTouches[0]
    if (touch !== undefined && touchStartX.current !== null) {
      const dx = touch.clientX - touchStartX.current
      if (dx < -SWIPE_THRESHOLD_PX) {
        setMenuAnchorKind('checkbox')
        setMenuOpen(true)
      }
    }
    touchStartX.current = null
    touchStartY.current = null
  }

  function handleMobileMenuButtonClick() {
    setMenuAnchorKind('more')
    setMenuOpen((value) => !value)
  }

  const menuAnchorRef = menuAnchorKind === 'more' ? moreRef : checkboxRef

  const menuItems: MenuItemConfig[] = [
    { key: 'edit', label: 'Изменить', onSelect: onOpenEditor },
    { key: 'delete', label: 'Удалить', variant: 'danger', onSelect: onRemove },
  ]

  // S8: the lift reads the same whichever way the row was picked up.
  const lifted = reorder !== undefined && reorder.isMovable && (isDragging || reorder.isGrabbed)

  const rowBody = (
    <RowBody
      task={task}
      query={query}
      dueInfo={dueInfo}
      isOverdue={isOverdue}
      isDesktop={isDesktop}
      done={done}
      lifted={lifted}
      prefersReducedMotion={prefersReducedMotion}
      tabIndex={tabIndex}
      titleId={titleId}
      priorityMetaId={priorityMetaId}
      dueDateMetaId={dueDateMetaId}
      labelledBy={labelledBy}
      setCheckboxNode={setCheckboxNode}
      onFocus={onFocus}
      onCheckboxKeyDown={onKeyDown}
      onToggle={onToggle}
      onOpenEditor={onOpenEditor}
      onQuickChange={onQuickChange}
      moreRef={moreRef}
      menuOpen={menuOpen}
      setMenuOpen={setMenuOpen}
      menuAnchorRef={menuAnchorRef}
      onMobileMenuButtonClick={handleMobileMenuButtonClick}
      menuItems={menuItems}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      reorder={reorder}
      dragControls={dragControls}
    />
  )

  const children = isEditing ? (
    isDesktop ? (
      <TaskEditor task={task} onSave={onSave} onCancel={onCloseEditor} />
    ) : (
      <>
        {rowBody}
        <TaskEditorSheet task={task} onSave={onSave} onCancel={onCloseEditor} />
      </>
    )
  ) : (
    <>
      {lifted && (
        <motion.span
          aria-hidden="true"
          // Cancels the item's own drag offset, so the indicator marks the
          // slot the row will land in while the card itself flies away.
          style={{ y: indicatorY }}
          // `drop-indicator` (motion table, section 5): height 0 → row
          // height in 140ms, instant under reduced motion.
          initial={prefersReducedMotion ? false : { height: 0 }}
          animate={{ height: '100%' }}
          transition={{ duration: prefersReducedMotion ? 0 : DROP_INDICATOR_S, ease: EASE_STANDARD }}
          className="pointer-events-none absolute inset-x-0 top-0 rounded-(--radius-lg) border-[1.5px] border-dashed border-accent-text bg-[image:var(--gradient-accent-soft)]"
        />
      )}
      {rowBody}
    </>
  )

  const shellClassName = isEditing && isDesktop ? undefined : 'relative'

  // The reorderable row's share of `task-add`/`task-delete` — see the
  // comment on the wrapper below. Reduced motion keeps opacity only, so
  // there is nothing left for this element to do.
  const slideMotion = prefersReducedMotion
    ? {}
    : {
        initial: { y: -8 },
        animate: { y: 0 },
        exit: { x: 12, transition: EXIT_TRANSITION },
        transition: ENTER_TRANSITION,
      }

  if (reorder === undefined) {
    // `editor-open` (motion table, section 5): under reduced motion the
    // switch to `TaskEditor`/`TaskEditorSheet` is instant and never animates
    // height — disabling `layout` drops the interpolated resize, and a
    // zero-duration transition drops everything else.
    if (isEditing) {
      return (
        <motion.li
          ref={rowRef}
          {...taskRowMarker}
          onKeyDown={onRowKeyDown}
          // `editor-open` (motion table, section 5): under reduced motion the
          // switch to `TaskEditor`/`TaskEditorSheet` is instant and never
          // animates height — disabling `layout` drops the interpolated
          // resize, and a zero-duration transition drops everything else.
          layout={!prefersReducedMotion}
          className={shellClassName}
          transition={prefersReducedMotion ? { duration: 0 } : { duration: 0.2, ease: EASE_OUT_SOFT }}
        >
          {children}
        </motion.li>
      )
    }

    return (
      <motion.li
        ref={rowRef}
        // Marks the row for `useGlobalShortcuts`: `Esc` on an empty dismiss
        // stack drops focus out of a row («снять выделение»), and that is the
        // one thing it cannot learn from the React tree.
        {...taskRowMarker}
        onKeyDown={onRowKeyDown}
        // `task-settle`/`list-reflow` (motion table, section 5): under
        // reduced motion reordering is instant, so the `layout`
        // interpolation is off. `task-add`/`task-delete` keep a 120ms fade
        // (the table's own figure for those two rows) but drop every
        // non-opacity property — no vertical/horizontal translate on
        // enter/exit, no collapsing height.
        layout={!prefersReducedMotion}
        initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: -8 }}
        animate={prefersReducedMotion ? { opacity: 1 } : { opacity: 1, y: 0 }}
        exit={
          prefersReducedMotion
            ? { opacity: 0 }
            : // `task-delete` (motion table, section 5): 200ms /
              // --ease-in-fast, distinct from the 320ms / --ease-out-soft
              // `task-add` enter below — framer-motion falls back to the
              // component `transition` prop otherwise, which would give the
              // exit the enter's timing.
              { opacity: 0, x: 12, height: 0, transition: EXIT_TRANSITION }
        }
        transition={prefersReducedMotion ? { duration: 0.12 } : ENTER_TRANSITION}
        className="relative"
      >
        {children}
      </motion.li>
    )
  }

  return (
    <Reorder.Item
      ref={rowRef}
      // Marks the row for `useGlobalShortcuts`: `Esc` on an empty dismiss
      // stack drops focus out of a row («снять выделение»), and that is the
      // one thing it cannot learn from the React tree.
      {...taskRowMarker}
      onKeyDown={onRowKeyDown}
      as="li"
      value={reorder.value}
      // Only the `DragHandle` starts a drag (architecture section 2): with
      // the listener off the whole row isn't draggable, and framer also
      // leaves `touch-action` alone, so the list still scrolls on a phone.
      dragListener={false}
      dragControls={dragControls}
      style={{ y: dragY }}
      // Unlike the plain row above, `layout` stays on under reduced motion:
      // `Reorder.Item` measures itself through the layout projection, so
      // switching it off would switch pointer dragging off with it, and
      // point 7 of FELA-17 says reduced motion must not cost the ability to
      // move a task. A zero-duration layout transition looks the same —
      // instant.
      layout
      onDragStart={() => {
        setIsDragging(true)
        reorder.onDragStart()
      }}
      onDragEnd={() => {
        setIsDragging(false)
        reorder.onDragEnd()
      }}
      className={cn(shellClassName, lifted && 'z-(--z-drag)')}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, height: 0, transition: EXIT_TRANSITION }}
      transition={{
        ...(prefersReducedMotion ? { duration: 0.12 } : ENTER_TRANSITION),
        layout: prefersReducedMotion
          ? { duration: 0 }
          : // Both the row's own resize (`editor-open`, 200) and its
            // neighbours' FLIP (`list-reflow`, 240) run on this one channel.
            { duration: isEditing ? 0.2 : LIST_REFLOW_S, ease: EASE_OUT_SOFT },
      }}
    >
      {/*
        `Reorder.Item` keeps `x`/`y` for its drag offset and writes them into
        `style`, which outranks anything `initial`/`animate`/`exit` say about
        those two values. So `task-add`'s translateY and `task-delete`'s
        translateX move one level in, and the item above keeps opacity,
        height and layout. Mounted and unmounted with the item itself, not
        with the editor, so entering a row's editor never replays the slide.
      */}
      <motion.div {...slideMotion}>{children}</motion.div>
    </Reorder.Item>
  )
}

interface DueInfo {
  status: ReturnType<typeof describeDueDate>['status']
  label: string
}

interface RowBodyProps {
  task: Task
  query: string
  dueInfo: DueInfo
  isOverdue: boolean
  isDesktop: boolean
  done: boolean
  /** Held by pointer or keyboard — wears the S8 lifted look. */
  lifted: boolean
  prefersReducedMotion: boolean
  tabIndex: 0 | -1
  titleId: string
  priorityMetaId: string
  dueDateMetaId: string
  labelledBy: string
  setCheckboxNode: (node: HTMLInputElement | null) => void
  onFocus: () => void
  onCheckboxKeyDown: (event: KeyboardEvent) => void
  onToggle: () => void
  onOpenEditor: () => void
  onQuickChange: (patch: TaskPatch) => void
  moreRef: RefObject<HTMLButtonElement | null>
  menuOpen: boolean
  setMenuOpen: (value: boolean) => void
  menuAnchorRef: RefObject<HTMLElement | null>
  onMobileMenuButtonClick: () => void
  menuItems: MenuItemConfig[]
  onTouchStart: (event: TouchEvent<HTMLDivElement>) => void
  onTouchMove: (event: TouchEvent<HTMLDivElement>) => void
  onTouchEnd: (event: TouchEvent<HTMLDivElement>) => void
  reorder: TaskRowReorder | undefined
  dragControls: DragControls
}

/** The row's normal (non-editing) visual content — factored out so the mobile `editing` branch can keep showing it underneath the sheet. */
function RowBody({
  task,
  query,
  dueInfo,
  isOverdue,
  isDesktop,
  done,
  lifted,
  prefersReducedMotion,
  tabIndex,
  titleId,
  priorityMetaId,
  dueDateMetaId,
  labelledBy,
  setCheckboxNode,
  onFocus,
  onCheckboxKeyDown,
  onToggle,
  onOpenEditor,
  onQuickChange,
  moreRef,
  menuOpen,
  setMenuOpen,
  menuAnchorRef,
  onMobileMenuButtonClick,
  menuItems,
  onTouchStart,
  onTouchMove,
  onTouchEnd,
  reorder,
  dragControls,
}: RowBodyProps) {
  return (
    <motion.div
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
      onDoubleClick={(event) => {
        event.preventDefault()
        onOpenEditor()
      }}
      // `drag-lift` (motion table, section 5): scale 1→1.015 and rotate
      // 0→−.6deg over 140ms. Under reduced motion the shadow, border and
      // opaque fill below still mark the lifted row, but nothing transforms.
      animate={lifted && !prefersReducedMotion ? { scale: 1.015, rotate: -0.6 } : { scale: 1, rotate: 0 }}
      transition={{ duration: prefersReducedMotion ? 0 : DRAG_LIFT_S, ease: EASE_STANDARD }}
      className={cn(
        'task-row group flex min-h-(--layout-row-h) items-center gap-(--space-3) rounded-(--radius-lg) border px-(--space-2) transition-colors duration-(--duration-fast) ease-standard',
        // S8: an opaque fill, because a translucent card in flight reads
        // dirty over the rows it passes. The hover/focus tint has to go with
        // it — it is a later-ordered variant and would win otherwise.
        lifted
          ? 'border-accent bg-surface-2-solid shadow-drag'
          : 'border-transparent bg-transparent hover:bg-surface-2 focus-within:bg-surface-2',
        isOverdue && 'text-overdue',
      )}
    >
      {reorder !== undefined && reorder.isMovable && (
        <span
          className={cn(
            'shrink-0 transition-opacity duration-(--duration-fast) ease-standard',
            isDesktop && !lifted
              ? 'opacity-0 group-hover:opacity-100 group-focus-within:opacity-100'
              : 'opacity-100',
          )}
        >
          <DragHandle
            taskTitle={task.title}
            tabIndex={tabIndex}
            isDraggable
            isGrabbed={reorder.isGrabbed}
            onPointerDown={(event: PointerEvent<HTMLButtonElement>) => dragControls.start(event)}
            onKeyDown={reorder.onHandleKeyDown}
            onBlur={reorder.onHandleBlur}
          />
        </span>
      )}

      <Checkbox
        ref={setCheckboxNode}
        checked={done}
        label={task.title}
        aria-labelledby={labelledBy}
        tabIndex={tabIndex}
        onFocus={onFocus}
        onKeyDown={onCheckboxKeyDown}
        onChange={onToggle}
      />

      <div className="min-w-0 flex-1">
        <ExpandableTitle task={task} query={query} titleId={titleId} prefersReducedMotion={prefersReducedMotion} />

        <div className="mt-(--space-1) flex flex-wrap items-center gap-(--space-2)">
          {isDesktop ? (
            <PrioritySelect
              value={task.priority}
              onChange={(priority) => onQuickChange({ priority })}
              tabIndex={tabIndex}
            />
          ) : (
            task.priority !== 'none' && <PriorityChip priority={task.priority} variant="static" />
          )}
          {isDesktop ? (
            <span
              className={cn(
                dueInfo.status === 'none' &&
                  'opacity-0 transition-opacity duration-(--duration-fast) ease-standard group-hover:opacity-100 group-focus-within:opacity-100',
              )}
            >
              <DueDatePicker
                value={task.dueDate}
                onChange={(dueDate) => onQuickChange({ dueDate })}
                tabIndex={tabIndex}
              />
            </span>
          ) : (
            dueInfo.status !== 'none' && <DueDateChip status={dueInfo.status} label={dueInfo.label} variant="static" />
          )}
        </div>
      </div>

      {task.priority !== 'none' && (
        <span className="sr-only">
          <PriorityChip id={priorityMetaId} priority={task.priority} variant="static" />
        </span>
      )}
      {dueInfo.status !== 'none' && (
        <span className="sr-only">
          <DueDateChip id={dueDateMetaId} status={dueInfo.status} label={dueInfo.label} variant="static" />
        </span>
      )}

      {isDesktop && (
        <div
          className={cn(
            'relative flex shrink-0 items-center gap-(--space-1) opacity-0 transition-opacity duration-(--duration-fast) ease-standard group-hover:opacity-100 group-focus-within:opacity-100',
          )}
        >
          <IconButton
            icon={<EditIcon />}
            aria-label={`Изменить задачу: ${task.title}`}
            tabIndex={tabIndex}
            onClick={onOpenEditor}
          />
          <IconButton
            ref={moreRef}
            icon={<MoreIcon />}
            aria-label={`Действия с задачей: ${task.title}`}
            aria-haspopup="menu"
            aria-expanded={menuOpen}
            tabIndex={tabIndex}
            onClick={() => setMenuOpen(!menuOpen)}
          />
          {menuOpen && (
            <div className="absolute top-full right-0 z-(--z-dropdown) mt-(--space-2)">
              <Menu items={menuItems} anchorRef={moreRef} onClose={() => setMenuOpen(false)} />
            </div>
          )}
        </div>
      )}

      {!isDesktop && (
        <div className="relative flex shrink-0 items-center">
          <IconButton
            ref={moreRef}
            icon={<MoreIcon />}
            aria-label={`Действия с задачей: ${task.title}`}
            aria-haspopup="menu"
            aria-expanded={menuOpen}
            tabIndex={tabIndex}
            onClick={onMobileMenuButtonClick}
          />
          {menuOpen && (
            <div className="absolute top-full right-0 z-(--z-dropdown) mt-(--space-2)">
              <Menu items={menuItems} anchorRef={menuAnchorRef} onClose={() => setMenuOpen(false)} />
            </div>
          )}
        </div>
      )}
    </motion.div>
  )
}

function EditIcon() {
  return (
    <svg viewBox="0 0 16 16" className="size-4" fill="none" aria-hidden="true">
      <path
        d="M11 2.5l2.5 2.5L5 13.5 2 14l.5-3L11 2.5z"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}
