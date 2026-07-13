import api from "./api";
import type { Board, Column, Task, Comment, Attachment, Label, ActivityLog, NotificationsResponse, DashboardStats, GlobalBoardResponse, Workspace, AutomationRule } from "../types";

export async function getWorkspaces() {
  const { data } = await api.get("/workspaces");
  return data as Workspace[];
}

export async function getBoards(workspaceId: string) {
  const { data } = await api.get(`/boards?workspace_id=${workspaceId}`);
  return data as Board[];
}

export async function getBoard(id: string) {
  const { data } = await api.get(`/boards/${id}`);
  return data as Board;
}

export async function createBoard(workspaceId: string, name: string) {
  const { data } = await api.post("/boards", { workspace_id: workspaceId, name });
  return data as Board;
}

export async function updateBoard(id: string, name: string) {
  const { data } = await api.patch(`/boards/${id}`, { name });
  return data as Board;
}

export async function deleteBoard(id: string) {
  await api.delete(`/boards/${id}`);
}

export async function createColumn(boardId: string, name: string) {
  const { data } = await api.post(`/boards/${boardId}/columns`, { name });
  return data as Column;
}

export async function updateColumn(id: string, updates: { name?: string; position?: number }) {
  const { data } = await api.patch(`/columns/${id}`, updates);
  return data as Column;
}

export async function deleteColumn(id: string) {
  await api.delete(`/columns/${id}`);
}

export async function createTask(columnId: string, title: string, description?: string) {
  const { data } = await api.post(`/columns/${columnId}/tasks`, { title, description });
  return data as Task;
}

export async function updateTask(id: string, updates: {
  title?: string;
  description?: string;
  position?: number;
  column_id?: string;
  due_date?: string | null;
  version?: number;
}) {
  const { data } = await api.patch(`/tasks/${id}`, updates);
  return data as Task;
}

export async function deleteTask(id: string) {
  await api.delete(`/tasks/${id}`);
}

export async function addAssignee(taskId: string, userId: string) {
  const { data } = await api.post(`/tasks/${taskId}/assignees`, { user_id: userId });
  return data;
}

export async function removeAssignee(taskId: string, userId: string) {
  await api.delete(`/tasks/${taskId}/assignees/${userId}`);
}

export async function getComments(taskId: string) {
  const { data } = await api.get(`/tasks/${taskId}/comments`);
  return data as Comment[];
}

export async function addComment(taskId: string, content: string) {
  const { data } = await api.post(`/tasks/${taskId}/comments`, { content });
  return data as Comment;
}

export async function getAttachments(taskId: string) {
  const { data } = await api.get(`/tasks/${taskId}/attachments`);
  return data as Attachment[];
}

export async function uploadAttachment(taskId: string, file: File) {
  const formData = new FormData();
  formData.append("file", file);
  const { data } = await api.post(`/tasks/${taskId}/attachments`, formData);
  return data as Attachment;
}

export async function getLabels(boardId: string) {
  const { data } = await api.get(`/boards/${boardId}/labels`);
  return data as Label[];
}

export async function createLabel(boardId: string, name: string, colorHex: string) {
  const { data } = await api.post(`/boards/${boardId}/labels`, { name, color_hex: colorHex });
  return data as Label;
}

export async function deleteLabel(boardId: string, labelId: string) {
  await api.delete(`/boards/${boardId}/labels/${labelId}`);
}

export async function getAutomationRules(boardId: string) {
  const { data } = await api.get(`/boards/${boardId}/automations`);
  return data as AutomationRule[];
}

export async function createAutomationRule(boardId: string, labelId: string, targetColumnId: string) {
  const { data } = await api.post(`/boards/${boardId}/automations`, { label_id: labelId, target_column_id: targetColumnId });
  return data as AutomationRule;
}

export async function updateAutomationRule(boardId: string, ruleId: string, updates: { target_column_id?: string; enabled?: boolean }) {
  const { data } = await api.patch(`/boards/${boardId}/automations/${ruleId}`, updates);
  return data as AutomationRule;
}

export async function deleteAutomationRule(boardId: string, ruleId: string) {
  await api.delete(`/boards/${boardId}/automations/${ruleId}`);
}

export async function addLabelToTask(taskId: string, labelId: string) {
  const { data } = await api.post(`/tasks/${taskId}/labels/${labelId}`);
  return data;
}

export async function removeLabelFromTask(taskId: string, labelId: string) {
  await api.delete(`/tasks/${taskId}/labels/${labelId}`);
}

export async function getActivityLogs(boardId: string) {
  const { data } = await api.get(`/boards/${boardId}/activity`);
  return data as ActivityLog[];
}

export async function inviteMember(boardId: string, email: string, role = "member") {
  const { data } = await api.post(`/boards/${boardId}/members`, { email, role });
  return data;
}

export async function updateMemberRole(boardId: string, userId: string, role: string) {
  const { data } = await api.patch(`/boards/${boardId}/members/${userId}`, { role });
  return data;
}

export async function removeMember(boardId: string, userId: string) {
  await api.delete(`/boards/${boardId}/members/${userId}`);
}

export async function getNotifications() {
  const { data } = await api.get("/notifications");
  return data as NotificationsResponse;
}

export async function markNotificationRead(id: string) {
  await api.patch(`/notifications/${id}/read`);
}

export async function markAllNotificationsRead() {
  await api.patch("/notifications/read-all");
}

export async function getDashboardStats() {
  const { data } = await api.get("/dashboard/stats");
  return data as DashboardStats;
}

export async function getGlobalBoard() {
  const { data } = await api.get("/global-board");
  return data as GlobalBoardResponse;
}
