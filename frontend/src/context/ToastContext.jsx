import React, { createContext, useContext, useState, useCallback } from 'react'
import { CheckCircle, XCircle, Info, X } from 'lucide-react'

const ToastContext = createContext(null)

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([])

  const addToast = useCallback((message, type = 'success', duration = 4000) => {
    const id = Date.now()
    setToasts((prev) => [...prev, { id, message, type }])
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id))
    }, duration)
  }, [])

  const removeToast = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }, [])

  const toast = {
    success: (msg, dur) => addToast(msg, 'success', dur),
    error: (msg, dur) => addToast(msg, 'error', dur),
    info: (msg, dur) => addToast(msg, 'info', dur)
  }

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      <div className="fixed top-4 right-4 z-50 flex flex-col gap-2 w-80">
        {toasts.map((t) => (
          <ToastItem key={t.id} toast={t} onRemove={removeToast} />
        ))}
      </div>
    </ToastContext.Provider>
  )
}

function ToastItem({ toast, onRemove }) {
  const styles = {
    success: { bg: 'bg-green-50 border-green-400', text: 'text-green-800', icon: <CheckCircle className="w-5 h-5 text-green-500" /> },
    error: { bg: 'bg-red-50 border-red-400', text: 'text-red-800', icon: <XCircle className="w-5 h-5 text-red-500" /> },
    info: { bg: 'bg-blue-50 border-blue-400', text: 'text-blue-800', icon: <Info className="w-5 h-5 text-blue-500" /> }
  }
  const s = styles[toast.type] || styles.info

  return (
    <div className={`flex items-start gap-3 p-4 rounded-lg border shadow-lg ${s.bg} animate-fade-in`}>
      {s.icon}
      <p className={`flex-1 text-sm font-medium ${s.text}`}>{toast.message}</p>
      <button onClick={() => onRemove(toast.id)} className="text-gray-400 hover:text-gray-600">
        <X className="w-4 h-4" />
      </button>
    </div>
  )
}

export function useToast() {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast must be used within ToastProvider')
  return ctx.toast
}
