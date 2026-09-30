import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { CheckCircle2, XCircle, AlertTriangle, Info, X } from "lucide-react";
import {
    subscribe,
    dismiss,
    pauseTimer,
    resumeTimer,
    ToastItem,
    ToastType,
} from "../../config/toastStore";

/** Must match the .toast-leave animation duration in index.css. */
const EXIT_MS = 200;

type RenderedToast = ToastItem & { exiting?: boolean };

const STYLES: Record<
    ToastType,
    { accent: string; icon: typeof CheckCircle2; iconColor: string; bar: string }
> = {
    success: {
        accent: "border-l-emerald-500",
        icon: CheckCircle2,
        iconColor: "text-emerald-500",
        bar: "bg-emerald-500",
    },
    error: {
        accent: "border-l-red-500",
        icon: XCircle,
        iconColor: "text-red-500",
        bar: "bg-red-500",
    },
    warning: {
        accent: "border-l-amber-500",
        icon: AlertTriangle,
        iconColor: "text-amber-500",
        bar: "bg-amber-500",
    },
    info: {
        accent: "border-l-blue-500",
        icon: Info,
        iconColor: "text-blue-500",
        bar: "bg-blue-500",
    },
};

const Toast = ({ item }: { item: RenderedToast }) => {
    const { accent, icon: Icon, iconColor, bar } = STYLES[item.type];

    return (
        <div
            role={item.type === "error" ? "alert" : "status"}
            aria-live={item.type === "error" ? "assertive" : "polite"}
            onMouseEnter={() => pauseTimer(item.id)}
            onMouseLeave={() => resumeTimer(item.id)}
            className={`toast-item ${item.exiting ? "toast-leave" : "toast-enter"}
                pointer-events-auto relative w-[22rem] max-w-[calc(100vw-2rem)] overflow-hidden
                rounded-xl border border-slate-200 border-l-4 ${accent}
                bg-white shadow-lg shadow-slate-900/10 ring-1 ring-black/5`}
        >
            <div className="flex items-start gap-3 p-4">
                <Icon size={20} className={`${iconColor} mt-0.5 shrink-0`} />

                <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-slate-800">{item.title}</p>
                    {/* break-words so a long server message wraps instead of overflowing */}
                    <p className="mt-0.5 break-words text-sm leading-relaxed text-slate-600">
                        {item.message}
                    </p>
                </div>

                <button
                    type="button"
                    onClick={() => dismiss(item.id)}
                    aria-label="Dismiss notification"
                    className="-mr-1 -mt-1 shrink-0 rounded-md p-1 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
                >
                    <X size={16} />
                </button>
            </div>

            {item.duration > 0 && (
                <div className="absolute bottom-0 left-0 h-1 w-full bg-slate-100">
                    <div
                        className={`toast-progress h-full ${bar}`}
                        style={{ animationDuration: `${item.duration}ms` }}
                    />
                </div>
            )}
        </div>
    );
};

/**
 * Renders the toast stack. Mount exactly once, at the app root.
 * Portals to <body> so it is never clipped by a modal's stacking context.
 */
const Toaster = () => {
    const [rendered, setRendered] = useState<RenderedToast[]>([]);

    useEffect(
        () =>
            subscribe((next) => {
                setRendered((prev) => {
                    const nextIds = new Set(next.map((t) => t.id));
                    const prevIds = new Set(prev.map((p) => p.id));

                    // Entries the store dropped stay mounted, flagged, so the
                    // exit animation can play before they are purged below.
                    const kept = prev.map((p) =>
                        nextIds.has(p.id) || p.exiting ? p : { ...p, exiting: true }
                    );
                    const added = next.filter((t) => !prevIds.has(t.id));

                    return [...kept, ...added];
                });
            }),
        []
    );

    // Purge toasts once their exit animation has finished.
    useEffect(() => {
        if (!rendered.some((r) => r.exiting)) return;
        const timer = setTimeout(
            () => setRendered((cur) => cur.filter((c) => !c.exiting)),
            EXIT_MS
        );
        return () => clearTimeout(timer);
    }, [rendered]);

    if (typeof document === "undefined") return null;

    return createPortal(
        <div
            className="pointer-events-none fixed right-4 top-4 z-[9999] flex flex-col items-end gap-3"
            aria-label="Notifications"
        >
            {rendered.map((item) => (
                <Toast key={item.id} item={item} />
            ))}
        </div>,
        document.body
    );
};

export default Toaster;
