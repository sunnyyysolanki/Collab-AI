import axios, { AxiosError, InternalAxiosRequestConfig } from "axios";
import { getErrorMessage } from "./toastUtility";

const axiosInstance = axios.create({
    baseURL: import.meta.env.VITE_API_URL,
    withCredentials: true, // send cookies for CORS credentialed requests
})

// Attach the latest token on every request (not just at module load)
axiosInstance.interceptors.request.use((config: InternalAxiosRequestConfig) => {
    const token = localStorage.getItem("token");
    if (token) {
        config.headers.set("Authorization", `Bearer ${token}`);
    }
    return config;
})

/** Endpoints where a 401 is an expected answer, not an expired session. */
const AUTH_ENDPOINTS = ["/users/login", "/users/register"];

/**
 * Normalise every failure once, here, so call sites never have to guess
 * between the backend's `{ message }` and `{ errors: [{ msg }] }` shapes.
 * The resolved text is attached as `error.apiMessage`.
 */
axiosInstance.interceptors.response.use(
    (response) => response,
    (error: AxiosError & { apiMessage?: string }) => {
        error.apiMessage = getErrorMessage(error);

        const status = error.response?.status;
        const url = error.config?.url ?? "";
        const isAuthCall = AUTH_ENDPOINTS.some((endpoint) => url.includes(endpoint));

        // An expired/blacklisted token would otherwise fail every later request
        // silently. Drop it so the route guard sends the user back to login.
        if (status === 401 && !isAuthCall) {
            localStorage.removeItem("token");
        }

        return Promise.reject(error);
    }
);

export default axiosInstance
