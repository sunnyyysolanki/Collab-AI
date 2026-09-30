/**
 * Framework-agnostic toast store.
 *
 * Deliberately free of React imports so non-component code (the axios
 * interceptor, redux thunks, socket handlers) can raise a toast too.
 * The UI lives in component/ui/Toaster.tsx and subscribes to this.
 */

export type ToastType = "success" | "error" | "info" | "warning";

export interface ToastOptions {
    /** Bold heading above the message. Falls back to a per-type default. */
    title?: string;
    /** Milliseconds before auto-dismiss. 0 keeps it up until dismissed. */
    duration?: number;
}

export interface ToastItem {
    id: string;
    type: ToastType;
    title: string;
    message: string;
    duration: number;
}

type Listener = (toasts: ToastItem[]) => void;

const DEFAULT_TITLES: Record<ToastType, string> = {
    success: "Success",
    error: "Something went wrong",
    info: "Heads up",
    warning: "Warning",
};

// Errors stay up longer than confirmations - they usually need reading.
const DEFAULT_DURATIONS: Record<ToastType, number> = {
    success: 3500,
    error: 6000,
    info: 4000,
    warning: 5000,
};

/** Older toasts are dropped past this so the corner never fills up. */
const MAX_VISIBLE = 4;

let toasts: ToastItem[] = [];
let listeners: Listener[] = [];
let seq = 0;

const timers = new Map<string, ReturnType<typeof setTimeout>>();

function emit() {
    listeners.forEach((listener) => listener(toasts));
}

function clearTimer(id: string) {
    const timer = timers.get(id);
    if (timer !== undefined) {
        clearTimeout(timer);
        timers.delete(id);
    }
}

function scheduleDismiss(item: ToastItem) {
    clearTimer(item.id);
    if (item.duration <= 0) return;
    timers.set(item.id, setTimeout(() => dismiss(item.id), item.duration));
}

export function subscribe(listener: Listener): () => void {
    listeners.push(listener);
    listener(toasts);
    return () => {
        listeners = listeners.filter((l) => l !== listener);
    };
}

export function dismiss(id: string) {
    clearTimer(id);
    toasts = toasts.filter((t) => t.id !== id);
    emit();
}

export function dismissAll() {
    toasts.forEach((t) => clearTimer(t.id));
    toasts = [];
    emit();
}

/** Hovering a toast pauses its countdown so it can be read. */
export function pauseTimer(id: string) {
    clearTimer(id);
}

export function resumeTimer(id: string) {
    const item = toasts.find((t) => t.id === id);
    if (item) scheduleDismiss(item);
}

function push(type: ToastType, message: string, options: ToastOptions = {}): string {
    const text = String(message ?? "").trim() || DEFAULT_TITLES[type];

    // A repeat of the same message (double submit, a socket event that fires
    // twice) replaces the existing toast rather than stacking a duplicate.
    // Dropping it here and re-adding below gives the replacement a new id, so
    // the countdown bar visibly restarts instead of silently continuing.
    const existing = toasts.find((t) => t.type === type && t.message === text);
    if (existing) {
        clearTimer(existing.id);
        toasts = toasts.filter((t) => t.id !== existing.id);
    }

    const item: ToastItem = {
        id: `toast-${++seq}`,
        type,
        title: options.title ?? DEFAULT_TITLES[type],
        message: text,
        duration: options.duration ?? DEFAULT_DURATIONS[type],
    };

    toasts = [...toasts, item].slice(-MAX_VISIBLE);

    // Anything trimmed off the front still holds a pending timer - drop those.
    Array.from(timers.keys()).forEach((id) => {
        if (!toasts.some((t) => t.id === id)) clearTimer(id);
    });

    emit();
    scheduleDismiss(item);
    return item.id;
}

export const toast = {
    success: (message: string, options?: ToastOptions) => push("success", message, options),
    error: (message: string, options?: ToastOptions) => push("error", message, options),
    info: (message: string, options?: ToastOptions) => push("info", message, options),
    warning: (message: string, options?: ToastOptions) => push("warning", message, options),
    dismiss,
    dismissAll,
};
