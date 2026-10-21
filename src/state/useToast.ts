import { createContext, useContext } from 'react'
import type { ToastOptions } from './ToastProvider'

export interface ToastContextValue {
  pushToast: (options: ToastOptions) => void
}

export const ToastContext = createContext<ToastContextValue | null>(null)

export function useToast(): ToastContextValue {
  const value = useContext(ToastContext)
  if (value === null) {
    throw new Error('useToast must be used inside <ToastProvider>.')
  }
  return value
}
