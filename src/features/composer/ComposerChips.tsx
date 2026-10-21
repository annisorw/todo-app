import { DueDatePicker } from '../../components/DueDatePicker'
import { PrioritySelect } from '../../components/PrioritySelect'
import type { ComposerFormController } from './useComposerForm'

export interface ComposerChipsProps {
  form: ComposerFormController
}

/** Priority + due-date chips, shared by the desktop panel and the mobile sheet. */
export function ComposerChips({ form }: ComposerChipsProps) {
  return (
    <div className="flex shrink-0 items-center gap-(--space-2)">
      <PrioritySelect value={form.priority} onChange={form.setPriority} />
      <DueDatePicker value={form.dueDate} onChange={form.setDueDate} />
    </div>
  )
}
