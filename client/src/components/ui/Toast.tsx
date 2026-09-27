import { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import { cn } from '../../lib/utils';
import { CheckCircle, XCircle, AlertTriangle, X } from 'lucide-react';

type ToastType = 'success' | 'error' | 'warning' | 'info';

interface Toast {
  id: string;
  type: ToastType;
  title: string;
  message?: string;
}

interface ToastContextValue {
  toast: (type: ToastType, title: string, message?: string) => void;
  success: (title: string, message?: string) => void;
  error:   (title: string, message?: string) => void;
  warning: (title: string, message?: string) => void;
  info:    (title: string, message?: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

const icons: Record<ToastType, ReactNode> = {
  success: <CheckCircle size={16} className="text-success-500 shrink-0" />,
  error:   <XCircle    size={16} className="text-danger-500 shrink-0" />,
  warning: <AlertTriangle size={16} className="text-warning-500 shrink-0" />,
  info:    <CheckCircle size={16} className="text-brand-400 shrink-0" />,
};

const toastStyles: Record<ToastType, string> = {
  success: 'border-success-500/30',
  error:   'border-danger-500/30',
  warning: 'border-warning-500/30',
  info:    'border-brand-500/30',
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const addToast = useCallback((type: ToastType, title: string, message?: string) => {
    const id = Math.random().toString(36).slice(2);
    setToasts((prev) => [...prev.slice(-4), { id, type, title, message }]);
    setTimeout(() => removeToast(id), 4500);
  }, [removeToast]);

  const ctx: ToastContextValue = {
    toast:   addToast,
    success: (t, m) => addToast('success', t, m),
    error:   (t, m) => addToast('error',   t, m),
    warning: (t, m) => addToast('warning', t, m),
    info:    (t, m) => addToast('info',    t, m),
  };

  return (
    <ToastContext.Provider value={ctx}>
      {children}
      {/* Toast container */}
      <div className="fixed bottom-5 right-5 z-[100] flex flex-col gap-2 w-80">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={cn(
              'glass rounded-xl p-4 flex items-start gap-3 shadow-card border animate-slide-up',
              toastStyles[t.type],
            )}
          >
            {icons[t.type]}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-slate-100">{t.title}</p>
              {t.message && <p className="text-xs text-slate-400 mt-0.5 truncate">{t.message}</p>}
            </div>
            <button
              onClick={() => removeToast(t.id)}
              className="text-slate-500 hover:text-slate-300 transition-colors shrink-0"
            >
              <X size={14} />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be inside ToastProvider');
  return ctx;
}
