// Axios instance for the whole app. One place to inject the Bearer token and
// handle 401 by clearing the stored token — the UI (AuthProvider) reacts to that.

import axios from 'axios';

const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000';
const TOKEN_KEY = 'pharmacy.token';

export const api = axios.create({
  baseURL: BASE_URL,
  withCredentials: false,
  timeout: 15000,
});

api.interceptors.request.use((config) => {
  try {
    const t = window.localStorage.getItem(TOKEN_KEY);
    if (t) config.headers.Authorization = `Bearer ${t}`;
  } catch {
    /* storage can be blocked (incognito); request still goes without token */
  }
  return config;
});

api.interceptors.response.use(
  (r) => r,
  (err) => {
    if (err.response?.status === 401) {
      try {
        window.localStorage.removeItem(TOKEN_KEY);
      } catch {
        /* noop */
      }
    }
    return Promise.reject(err);
  }
);

export function setToken(token) {
  try {
    window.localStorage.setItem(TOKEN_KEY, token);
  } catch {
    /* noop */
  }
}
export function getToken() {
  try {
    return window.localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}
export function clearToken() {
  try {
    window.localStorage.removeItem(TOKEN_KEY);
  } catch {
    /* noop */
  }
}
