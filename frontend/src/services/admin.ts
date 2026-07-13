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
