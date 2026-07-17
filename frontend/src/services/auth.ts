import axios from "axios";
import api, { API_BASE, setAccessToken } from "./api";
import { useAuthStore } from "../store/authStore";
import { disconnectSocket } from "./socket";

const API_URL = `${API_BASE}/api`;

// Client-side guard so an idle tab is signed out exactly when the server-side
// absolute session (default 6h from login) elapses, instead of lingering until
// the next request bounces off a 401.
let sessionTimer: ReturnType<typeof setTimeout> | null = null;

function clearSessionTimer() {
  if (sessionTimer) {
    clearTimeout(sessionTimer);
    sessionTimer = null;
  }
}

function forceLogout() {
  clearSessionTimer();
  disconnectSocket();
  setAccessToken(null);
  useAuthStore.getState().setUser(null);
  if (window.location.pathname !== "/login") {
    window.location.href = "/login";
  }
}

function scheduleSessionExpiry(sessionExpiresAt?: number) {
  clearSessionTimer();
  if (!sessionExpiresAt) return;
  const remaining = sessionExpiresAt - Date.now();
  if (remaining <= 0) {
    forceLogout();
    return;
  }
  sessionTimer = setTimeout(forceLogout, remaining);
}

export async function register(name: string, email: string, password: string) {
  const { data } = await api.post<{ user: any; accessToken: string; sessionExpiresAt?: number; workspace?: any }>("/auth/register", { name, email, password });
  setAccessToken(data.accessToken);
  useAuthStore.getState().setUser(data.user);
  scheduleSessionExpiry(data.sessionExpiresAt);
  return data;
}

export async function login(email: string, password: string) {
  const { data } = await api.post<{ user: any; accessToken: string; sessionExpiresAt?: number }>("/auth/login", { email, password });
  setAccessToken(data.accessToken);
  useAuthStore.getState().setUser(data.user);
  scheduleSessionExpiry(data.sessionExpiresAt);
  return data;
}

export async function refreshToken() {
  const { data } = await axios.post<{ accessToken: string; user: any; sessionExpiresAt?: number }>(`${API_URL}/auth/refresh`, {}, { withCredentials: true });
  setAccessToken(data.accessToken);
  useAuthStore.getState().setUser(data.user);
  scheduleSessionExpiry(data.sessionExpiresAt);
  return data;
}

export async function logout() {
  try {
    await api.post("/auth/logout");
  } finally {
    clearSessionTimer();
    disconnectSocket();
    setAccessToken(null);
    useAuthStore.getState().setUser(null);
  }
}
