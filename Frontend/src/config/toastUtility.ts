import axios from "axios";
import { toast, ToastOptions } from "./toastStore";

export { toast };
export type { ToastOptions };

export const GENERIC_ERROR = "Something went wrong. Please try again.";

/**
 * Every error shape the backend can produce.
 *
 * GlobalExceptionHandler emits two of them:
 *   validation -> 400 { errors: [ { msg, field? }, ... ] }
 *   everything else -> { message: "..." }
 *
 * Call sites used to hardcode one shape (`err.response.data.errors[0].msg`),
 * which threw a TypeError inside the catch block whenever the other shape came
 * back - so no toast rendered at all. Read through this helper instead.
 */
interface ApiErrorBody {
    message?: unknown;
    error?: unknown;
    detail?: unknown;
    title?: unknown;
    errors?: unknown;
}

/** Human-readable fallbacks when the body carries no usable message. */
const STATUS_MESSAGES: Record<number, string> = {
    400: "That request wasn't valid. Please check the form and try again.",
    401: "Your session has expired. Please log in again.",
    403: "You don't have permission to do that.",
    404: "We couldn't find what you were looking for.",
    409: "That conflicts with something that already exists.",
    413: "That upload is too large.",
    422: "Some of the details you entered aren't valid.",
    429: "Too many requests. Please wait a moment and try again.",
    500: "The server ran into a problem. Please try again.",
    502: "The server is unreachable right now. Please try again shortly.",
    503: "The service is temporarily unavailable. Please try again shortly.",
    504: "The server took too long to respond. Please try again.",
};

function asText(value: unknown): string | null {
    if (typeof value !== "string") return null;
    const trimmed = value.trim();
    if (!trimmed) return null;
    // A proxy or dev server may return an HTML error page - never toast markup.
    if (trimmed.startsWith("<")) return null;
    return trimmed;
}

/**
 * Pull the messages out of a validation payload:
 *   { errors: [ { msg: "Name is required" }, ... ] }
 * Also tolerates plain-string entries and { defaultMessage } / { message }.
 */
function extractValidationMessages(errors: unknown): string[] {
    if (!Array.isArray(errors)) return [];

    return errors
        .map((entry) => {
            if (typeof entry === "string") return asText(entry);
            if (entry && typeof entry === "object") {
                const e = entry as Record<string, unknown>;
                return (
                    asText(e.msg) ??
                    asText(e.message) ??
                    asText(e.defaultMessage) ??
                    asText(e.error)
                );
            }
            return null;
        })
        .filter((m): m is string => m !== null);
}

/**
 * Field-level messages for inline form errors, keyed by field name.
 * Only populated when the backend labels each violation with a `field`.
 */
export function getFieldErrors(error: unknown): Record<string, string> {
    const result: Record<string, string> = {};
    if (!axios.isAxiosError(error)) return result;

    const errors = (error.response?.data as ApiErrorBody | undefined)?.errors;
    if (!Array.isArray(errors)) return result;

    errors.forEach((entry) => {
        if (!entry || typeof entry !== "object") return;
        const e = entry as Record<string, unknown>;
        const field = asText(e.field) ?? asText(e.path) ?? asText(e.param);
        const msg = asText(e.msg) ?? asText(e.message) ?? asText(e.defaultMessage);
        if (field && msg && !result[field]) result[field] = msg;
    });

    return result;
}

/**
 * Turn any thrown value into a message worth showing a user.
 * Never throws, and never returns an empty string.
 */
export function getErrorMessage(error: unknown, fallback: string = GENERIC_ERROR): string {
    if (!error) return fallback;

    if (typeof error === "string") return asText(error) ?? fallback;

    if (axios.isAxiosError(error)) {
        const response = error.response;

        // The request never reached the server (offline, CORS, DNS, refused).
        if (!response) {
            if (error.code === "ECONNABORTED" || error.code === "ETIMEDOUT") {
                return "The request timed out. Please try again.";
            }
            return "Can't reach the server. Check your connection and try again.";
        }

        const data = response.data as ApiErrorBody | string | undefined;

        // Some handlers return a bare string body.
        const asString = asText(data);
        if (asString) return asString;

        if (data && typeof data === "object") {
            // Validation errors first - they are the most specific.
            const validation = extractValidationMessages(data.errors);
            if (validation.length === 1) return validation[0];
            if (validation.length > 1) return validation.join(" · ");

            const direct =
                asText(data.message) ??
                asText(data.error) ??
                asText(data.detail) ??
                asText(data.title);
            if (direct) return direct;
        }

        return STATUS_MESSAGES[response.status] ?? `Request failed (${response.status}).`;
    }

    if (error instanceof Error) return asText(error.message) ?? fallback;

    if (typeof error === "object") {
        const e = error as ApiErrorBody;
        const direct = asText(e.message) ?? asText(e.error);
        if (direct) return direct;
    }

    return fallback;
}

/** Show a success toast. */
export function handleSuccess(message: string, options?: ToastOptions) {
    toast.success(message, options);
}

/** Show an error toast from an already-composed message. */
export function handleError(message: string, options?: ToastOptions) {
    toast.error(message, options);
}

/**
 * The workhorse for `catch` blocks: normalises whatever was thrown and toasts
 * it. Pass `fallback` for a context-specific message when the server gives
 * nothing useful. Returns the message so callers can also render it inline.
 */
export function showApiError(error: unknown, fallback: string = GENERIC_ERROR): string {
    const message = getErrorMessage(error, fallback);
    // Keep the raw error in the console for debugging; the toast stays clean.
    console.error(fallback, error);
    toast.error(message);
    return message;
}
