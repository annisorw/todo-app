import { AnimatePresence, motion } from 'framer-motion'
import { useState } from 'react'
import { useTodos } from './useTodos'

function App() {
  const { todos, addTodo, toggleTodo, removeTodo } = useTodos()
  const [title, setTitle] = useState('')

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault()
    addTodo(title)
    setTitle('')
  }

  return (
    <main className="mx-auto max-w-md p-6">
      <h1 className="mb-4 text-2xl font-semibold text-slate-900">Todo App</h1>

      <form onSubmit={handleSubmit} className="mb-4 flex gap-2">
        <input
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          placeholder="What needs to be done?"
          className="flex-1 rounded border border-slate-300 px-3 py-2 text-slate-900 outline-none focus:border-slate-500"
        />
        <button
          type="submit"
          className="rounded bg-slate-900 px-4 py-2 text-white hover:bg-slate-700"
        >
          Add
        </button>
      </form>

      <ul className="flex flex-col gap-2">
        <AnimatePresence initial={false}>
          {todos.map((todo) => (
            <motion.li
              key={todo.id}
              layout
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, x: 20 }}
              className="flex items-center gap-2 rounded border border-slate-200 px-3 py-2"
            >
              <input
                type="checkbox"
                checked={todo.done}
                onChange={() => toggleTodo(todo.id)}
                className="size-4"
              />
              <span className={todo.done ? 'flex-1 text-slate-400 line-through' : 'flex-1'}>
                {todo.title}
              </span>
              <button
                type="button"
                onClick={() => removeTodo(todo.id)}
                aria-label={`Remove ${todo.title}`}
                className="text-slate-400 hover:text-red-500"
              >
                &times;
              </button>
            </motion.li>
          ))}
        </AnimatePresence>
      </ul>
    </main>
  )
}

export default App
