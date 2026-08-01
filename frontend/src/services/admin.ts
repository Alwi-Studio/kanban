import api from "./api";
import type { AdminUser } from "../types";

export async function getAdminUsers() {
  const { data } = await api.get("/admin/users");
  return data as AdminUser[];
}

export async function setGlobalAdmin(userId: string, isGlobalAdmin: boolean) {
  const { data } = await api.patch(`/admin/users/${userId}/global-admin`, { isGlobalAdmin });
  return data as AdminUser;
}

export async function setUserPassword(userId: string, newPassword: string) {
  await api.patch(`/admin/users/${userId}/password`, { newPassword });
}

export async function deleteUser(userId: string) {
  await api.delete(`/admin/users/${userId}`);
}
