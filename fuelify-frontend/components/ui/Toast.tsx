// fuelify-frontend/components/ui/Toast.tsx
'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { AlertCircle, CheckCircle2, Info, TriangleAlert, X } from 'lucide-react';

export type ToastType = 'success' | 'error' | 'info' | 'warning';

interface ToastRecord {
  id: string;
  message: string;
  type: ToastType;
}

interface ToastContextValue {
  show: (message: string, type?: ToastType) => void;
}

const ToastContext = createContext<ToastContextValue>({ show: () => {} });

const STYLES: Record<ToastType, string> = {
  success: 'border-emerald-500/35 bg-[var(--bg-surface)] text-[var(--text-primary)] shadow-[0_4px_24px_rgba(16,185,129,0.18)]',
  error:   'border-red-500/35    bg-[var(--bg-surface)] text-[var(--text-primary)] shadow-[0_4px_24px_rgba(239,68,68,0.18)]',
  info:    'border-[var(--border-strong)] bg-[var(--bg-surface)] text-[var(--text-primary)] shadow-[0_4px_24px_rgba(99,102,241,0.18)]',
  warning: 'border-amber-500/35  bg-[var(--bg-surface)] text-[var(--text-primary)] shadow-[0_4px_24px_rgba(245,158,11,0.18)]',
};

const ICONS: Record<ToastType, ReactNode> = {
  success: <CheckCircle2 className="h-4 w-4 text-emerald-500 dark:text-emerald-400" />,
  error:   <AlertCircle   className="h-4 w-4 text-red-500 dark:text-red-400" />,
  info:    <Info          className="h-4 w-4 text-indigo-500 dark:text-indigo-400" />,
  warning: <TriangleAlert className="h-4 w-4 text-amber-500 dark:text-amber-400" />,
};

const ToastItem = ({
  toast,
  onClose,
}: {
  toast: ToastRecord;
  onClose: (id: string) => void;
}) => {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const enter = setTimeout(() => setVisible(true), 10);
    const timer = setTimeout(() => {
      setVisible(false);
      setTimeout(() => onClose(toast.id), 250);
    }, 4000);

    return () => {
      clearTimeout(enter);
      clearTimeout(timer);
    };
  }, [onClose, toast.id]);

  return (
    <div
      className={[
        'flex w-[min(92vw,380px)] items-start gap-3 rounded-2xl border px-4 py-3.5',
        'backdrop-blur-sm transition-all duration-300',
        STYLES[toast.type],
        visible ? 'translate-y-0 opacity-100 scale-100' : '-translate-y-2 opacity-0 scale-95',
      ].join(' ')}
    >
      <span className="mt-0.5 shrink-0">{ICONS[toast.type]}</span>
      <p className="flex-1 text-sm font-medium leading-relaxed">{toast.message}</p>
      <button
        type="button"
        onClick={() => onClose(toast.id)}
        className="shrink-0 rounded-lg p-1 text-[var(--text-muted)] transition-colors duration-200 hover:bg-[var(--bg-elevated)] hover:text-[var(--text-primary)] focus:outline-none"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
};

export const ToastProvider = ({ children }: { children: ReactNode }) => {
  const [toasts, setToasts] = useState<ToastRecord[]>([]);

  const show = useCallback((message: string, type: ToastType = 'info') => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    setToasts((current) => [...current, { id, message, type }]);
  }, []);

  const remove = useCallback((id: string) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  const contextValue = useMemo(() => ({ show }), [show]);

  return (
    <ToastContext.Provider value={contextValue}>
      {children}
      <div className="fixed left-1/2 top-3 z-[1300] flex -translate-x-1/2 flex-col gap-2 sm:left-auto sm:right-4 sm:top-4 sm:translate-x-0">
        {toasts.map((toast) => (
          <ToastItem key={toast.id} toast={toast} onClose={remove} />
        ))}
      </div>
    </ToastContext.Provider>
  );
};

export const useToast = () => useContext(ToastContext);
