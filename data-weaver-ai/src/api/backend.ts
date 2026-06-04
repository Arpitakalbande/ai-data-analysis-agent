import axios from "axios";

export const backend = axios.create({
  baseURL: import.meta.env.VITE_BACKEND_URL ?? "https://data-analytics-agent-7w17.onrender.com/",
  headers: {
    "Content-Type": "application/json",
  },
});
