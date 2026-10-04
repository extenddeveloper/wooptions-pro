namespace WooptionsFic.Toast {
  export interface ToastItem {
    id: string;
    type: 'success' | 'error' | 'warning' | 'info';
    title?: string;
    message: string;
    duration?: number;
    isHiding?: boolean;
  }

  type ToastListener = (toasts: ToastItem[]) => void;
  let items: ToastItem[] = [];
  const listeners = new Set<ToastListener>();

  function notify(): void {
    listeners.forEach((fn) => fn([...items]));
  }

  export function subscribe(listener: ToastListener): () => void {
    listeners.add(listener);
    listener([...items]);
    return () => {
      listeners.delete(listener);
    };
  }

  export function dismiss(id: string): void {
    const existing = items.find((t) => t.id === id);
    if (!existing || existing.isHiding) return;
    items = items.map((t) => (t.id === id ? { ...t, isHiding: true } : t));
    notify();
    setTimeout(() => {
      items = items.filter((t) => t.id !== id);
      notify();
    }, 220);
  }

  export function show(options: {
    type?: 'success' | 'error' | 'warning' | 'info';
    title?: string;
    message: string;
    duration?: number;
  }): string {
    const id = 'toast_' + Math.random().toString(36).slice(2, 9);
    const item: ToastItem = {
      id,
      type: options.type ?? 'info',
      title: options.title,
      message: options.message,
      duration: options.duration ?? 4000,
    };
    if (items.length >= 3) {
      items = items.slice(items.length - 2);
    }
    items = [...items, item];
    notify();
    return id;
  }

  export function success(message: string, title?: string, duration?: number): string {
    return show({ type: 'success', message, title, duration });
  }

  export function error(message: string, title?: string, duration?: number): string {
    return show({ type: 'error', message, title: title ?? 'Error', duration: duration ?? 5000 });
  }

  export function warning(message: string, title?: string, duration?: number): string {
    return show({ type: 'warning', message, title: title ?? 'Attention', duration });
  }

  export function info(message: string, title?: string, duration?: number): string {
    return show({ type: 'info', message, title, duration });
  }
}

namespace WooptionsFic.Components {
  const { useEffect, useRef, useState } = wp.element;

  export function ToastContainer(): any {
    const [toasts, setToasts] = useState<WooptionsFic.Toast.ToastItem[]>([]);

    useEffect(() => {
      return WooptionsFic.Toast.subscribe(setToasts);
    }, []);

    if (!toasts.length) return null;

    return (
      <div className="wof-toast-container" role="region" aria-label="Notifications">
        {toasts.map((toast) => (
          <ToastCard
            key={toast.id}
            toast={toast}
            onDismiss={() => WooptionsFic.Toast.dismiss(toast.id)}
          />
        ))}
      </div>
    );
  }

  function ToastCard(props: {
    toast: WooptionsFic.Toast.ToastItem;
    onDismiss: () => void;
  }): any {
    const { toast, onDismiss } = props;
    const duration = toast.duration ?? 4000;
    const remainingRef = useRef<number>(duration);
    const startTimeRef = useRef<number>(Date.now());
    const timerRef = useRef<number | null>(null);

    const startTimer = () => {
      if (remainingRef.current > 0 && !toast.isHiding) {
        startTimeRef.current = Date.now();
        timerRef.current = window.setTimeout(onDismiss, remainingRef.current);
      }
    };

    const pauseTimer = () => {
      if (timerRef.current) {
        window.clearTimeout(timerRef.current);
        timerRef.current = null;
        remainingRef.current -= (Date.now() - startTimeRef.current);
        if (remainingRef.current < 500) remainingRef.current = 500;
      }
    };

    useEffect(() => {
      startTimer();
      return () => {
        if (timerRef.current) window.clearTimeout(timerRef.current);
      };
    }, [toast.id, toast.isHiding]);

    return (
      <div
        className={WooptionsFic.Utils.classNames(
          'wof-toast',
          `wof-toast--${toast.type}`,
          toast.isHiding && 'is-hiding'
        )}
        role={toast.type === 'error' ? 'alert' : 'status'}
        aria-live="polite"
        onMouseEnter={pauseTimer}
        onMouseLeave={startTimer}
      >
        <span className="wof-toast__icon" aria-hidden="true">
          {toast.type === 'success' ? (
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
          ) : toast.type === 'error' ? (
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
          ) : toast.type === 'warning' ? (
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
          ) : (
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>
          )}
        </span>
        <div className="wof-toast__content">
          {toast.title ? <div className="wof-toast__title">{toast.title}</div> : null}
          <div className="wof-toast__message">{toast.message}</div>
        </div>
        <button
          type="button"
          className="wof-toast__close"
          aria-label="Close notification"
          onClick={onDismiss}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </button>
        <div className="wof-toast__progress" aria-hidden="true">
          <div
            className="wof-toast__progress-bar"
            style={{ animationDuration: `${duration}ms` }}
          />
        </div>
      </div>
    );
  }
}
