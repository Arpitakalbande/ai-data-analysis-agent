import axios from "axios";

const fallbackBaseUrl = import.meta.env.DEV
  ? "http://localhost:8000"
  : "https://data-analytics-agent-7w17.onrender.com";

const baseURL = (
  import.meta.env.VITE_FASTAPI_URL ||
  import.meta.env.VITE_BACKEND_URL ||
  import.meta.env.VITE_API_URL ||
  fallbackBaseUrl
).replace(/\/$/, "");

export const backend = axios.create({
  baseURL,
});

backend.interceptors.request.use((config) => {
  if (config.data instanceof FormData) {
    if (config.headers) {
      const { 'Content-Type': _, ...headers } = config.headers as Record<string, string>;
      config.headers = headers;
    }
  } else {
    config.headers = {
      'Content-Type': 'application/json',
      ...(config.headers as Record<string, string> | undefined),
    };
  }
  return config;
});

backend.interceptors.response.use(
  (response) => response,
  (error) => {
    if (axios.isAxiosError(error)) {
      const detail = error.response?.data?.detail || error.message;
      const status = error.response?.status;
      throw new Error(status ? `Request failed with status ${status}: ${detail}` : detail);
    }

    throw error;
  }
);
