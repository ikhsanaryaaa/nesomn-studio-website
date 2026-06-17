import { create } from 'zustand';

export type ToastVariant =
  | 'default'
  | 'success'
  | 'danger'
  | 'info'
  | 'warning';

export interface ToastItem {
  id: string;
  title?: string;
  description?: string;
  variant?: ToastVariant;
  duration?: number;
}

interface ToastState {
  toasts: ToastItem[];
  addToast: (toast: Omit<ToastItem, 'id'>) => string;
  removeToast: (id: string) => void;
}

const useToastStore = create<ToastState>((set) => ({
  toasts: [],
  addToast: (toast) => {
    const id = crypto.randomUUID();
    set((state) => ({ toasts: [...state.toasts, { id, ...toast }] }));
    return id;
  },
  removeToast: (id) =>
    set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) })),
}));

/** Hook untuk memunculkan toast dari mana saja. */
export function useToast() {
  const { toasts, addToast, removeToast } = useToastStore();
  return {
    toasts,
    toast: addToast,
    dismiss: removeToast,
  };
}
