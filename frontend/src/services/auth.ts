import axios from "axios";
import api, { API_BASE, setAccessToken } from "./api";
import { useAuthStore } from "../store/authStore";

const API_URL = `${API_BASE}/api`;

export async function register(name: string, email: string, password: string) {
  const { data } = await api.post<{ user: any; accessToken: string; workspace?: any }>("/auth/register", { name, email, password });
  setAccessToken(data.accessToken);
  useAuthStore.getState().setUser(data.user);
  return data;
}

export async function login(email: string, password: string) {
  const { data } = await api.post<{ user: any; accessToken: string }>("/auth/login", { email, password });
  setAccessToken(data.accessToken);
  useAuthStore.getState().setUser(data.user);
  return data;
}

export async function refreshToken() {
  const { data } = await axios.post<{ accessToken: string; user: any }>(`${API_URL}/auth/refresh`, {}, { withCredentials: true });
  setAccessToken(data.accessToken);
  useAuthStore.getState().setUser(data.user);
  return data;
}

export async function logout() {
  await api.post("/auth/logout");
  setAccessToken(null);
  useAuthStore.getState().setUser(null);
}
