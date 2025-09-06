// src/api/axios.js
import axios from "axios";

const api = axios.create({ baseURL: import.meta.env.VITE_API_BASE });

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("access");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

let isRefreshing = false;
let subscribers = [];
const subscribe = (cb) => subscribers.push(cb);
const onRefreshed = (token) => {
  subscribers.forEach((cb) => cb(token));
  subscribers = [];
};

api.interceptors.response.use(
  (res) => res,
  async (err) => {
    const original = err.config;
    if (err.response?.status !== 401 || original._retry) {
      return Promise.reject(err);
    }
    original._retry = true;

    if (!isRefreshing) {
      isRefreshing = true;
      try {
        const refresh = localStorage.getItem("refresh");
        const { data } = await axios.post(
            `${import.meta.env.VITE_API_BASE}/token/refresh/`,
          { refresh }
        );
        localStorage.setItem("access", data.access);
        isRefreshing = false;
        onRefreshed(data.access);
      } catch (e) {
        isRefreshing = false;
        localStorage.removeItem("access");
        localStorage.removeItem("refresh");
        window.location.href = "/login";
        return Promise.reject(e);
      }
    }

    return new Promise((resolve) => {
      subscribe((newToken) => {
        original.headers.Authorization = `Bearer ${newToken}`;
        resolve(api(original));
      });
    });
  }
);

export default api;
