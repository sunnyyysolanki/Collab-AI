import axios, { InternalAxiosRequestConfig } from "axios";

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


export default axiosInstance
