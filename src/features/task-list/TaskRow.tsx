import { motion } from 'framer-motion'
import { useEffect, useId, useRef, useState } from 'react'
import type { KeyboardEvent, RefObject, TouchEvent } from 'react'
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
function ExpandableTitle({ task, query, titleId }: { task: Task; query: string; titleId: string }) {
  const [expanded, setExpanded] = useState(false)
  const [isOverflowing, setIsOverflowing] = useState(false)
  const textRef = useRef<HTMLParagraphElement>(null)

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
      <p
        id={titleId}
        ref={textRef}
        className={cn(
          'text-body break-words text-primary',
          isDone(task) && 'text-tertiary line-through',
          !expanded && 'line-clamp-3 sm:line-clamp-2',
        )}
      >
        {highlight(task.title, query)}
      </p>
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
 * design-spec 3.11 / 3.12 / 3.13 — the task row: `DragHandle` slot (drag
 * itself is [FELA-17](/FELA/issues/FELA-17)) · `Checkbox` · title + meta
 * chips · `edit`/`more` actions. Mobile swaps the hover-revealed desktop
 * actions for a long-press or swipe-left — plus a persistent `more`
 * `IconButton` (FELA-120): the gesture is a shortcut, not the only way in,
 * so Menu stays reachable by mouse, touch, and keyboard without it. All
 * three paths open the same `Menu`; Esc returns focus to whichever one
 * actually opened it (`menuAnchorKind`), not always the checkbox.
 *
 * The roving-focus anchor (and the accessible-name target for criterion 25)
 * is the `Checkbox`'s native input, not a wrapping row element — only a real
 * `role="checkbox"` node reads as "флажок" to a screen reader.
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
}: TaskRowProps) {
  const isDesktop = useMediaQuery('(min-width: 640px)')
  const prefersReducedMotion = useMediaQuery('(prefers-reduced-motion: reduce)')
  const [menuOpen, setMenuOpen] = useState(false)
  // Esc (criterion in FELA-120) must return focus to whichever element actually opened
  // the menu: the gesture has no focusable origin of its own, so it keeps using the
  // row's roving-focus anchor (the checkbox); the mobile `more` button is its own anchor.
  const [menuAnchorKind, setMenuAnchorKind] = useState<'checkbox' | 'more'>('checkbox')
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
        className={isDesktop ? undefined : 'relative'}
        transition={prefersReducedMotion ? { duration: 0 } : { duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
      >
        {isDesktop ? (
          <TaskEditor task={task} onSave={onSave} onCancel={onCloseEditor} />
        ) : (
          <>
            <RowBody
              task={task}
              query={query}
              dueInfo={dueInfo}
              isOverdue={isOverdue}
              isDesktop={isDesktop}
              done={done}
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
            />
            <TaskEditorSheet task={task} onSave={onSave} onCancel={onCloseEditor} />
          </>
        )}
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
      // `task-settle`/`list-reflow` (motion table, section 5): under reduced
      // motion reordering is instant, so the `layout` interpolation is off.
      // `task-add`/`task-delete` keep a 120ms fade (the table's own figure
      // for those two rows) but drop every non-opacity property — no
      // vertical/horizontal translate on enter/exit, no collapsing height.
      layout={!prefersReducedMotion}
      initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: -8 }}
      animate={prefersReducedMotion ? { opacity: 1 } : { opacity: 1, y: 0 }}
      exit={
        prefersReducedMotion
          ? { opacity: 0 }
          // `task-delete` (motion table, section 5): 200ms / --ease-in-fast,
          // distinct from the 320ms / --ease-out-soft `task-add` enter below —
          // framer-motion falls back to the component `transition` prop
          // otherwise, which would give the exit the enter's timing.
          : { opacity: 0, x: 12, height: 0, transition: { duration: 0.2, ease: [0.4, 0, 1, 1] } }
      }
      transition={prefersReducedMotion ? { duration: 0.12 } : { duration: 0.32, ease: [0.16, 1, 0.3, 1] }}
      className="relative"
    >
      <RowBody
        task={task}
        query={query}
        dueInfo={dueInfo}
        isOverdue={isOverdue}
        isDesktop={isDesktop}
        done={done}
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
      />
    </motion.li>
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
}

/** The row's normal (non-editing) visual content — factored out so the mobile `editing` branch can keep showing it underneath the sheet. */
function RowBody({
  task,
  query,
  dueInfo,
  isOverdue,
  isDesktop,
  done,
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
}: RowBodyProps) {
  return (
    <div
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
      onDoubleClick={(event) => {
        event.preventDefault()
        onOpenEditor()
      }}
      className={cn(
        'task-row group flex min-h-(--layout-row-h) items-center gap-(--space-3) rounded-(--radius-lg) border border-transparent bg-transparent px-(--space-2) transition-colors duration-(--duration-fast) ease-standard',
        'hover:bg-surface-2 focus-within:bg-surface-2',
        isOverdue && 'text-overdue',
      )}
    >
      <span
        className={cn(
          'shrink-0 transition-opacity duration-(--duration-fast) ease-standard',
          isDesktop ? 'opacity-0 group-hover:opacity-100 group-focus-within:opacity-100' : 'opacity-100',
        )}
      >
        <DragHandle taskTitle={task.title} tabIndex={tabIndex} />
      </span>

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
        <ExpandableTitle task={task} query={query} titleId={titleId} />

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
    </div>
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
