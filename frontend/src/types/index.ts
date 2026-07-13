export interface User {
  id: string;
  name: string;
  email: string;
  createdAt?: string;
  isGlobalAdmin?: boolean;
}

export interface Workspace {
  id: string;
  name: string;
  ownerId: string;
  createdAt: string;
  boards: Board[];
}

export interface Board {
  id: string;
  workspaceId: string;
  name: string;
  isGlobal?: boolean;
  createdAt: string;
  columns: Column[];
  members?: BoardMember[];
  labels?: Label[];
}

export interface BoardMember {
  id: string;
  boardId: string;
  userId: string;
  role: string;
  user: User;
}

export interface Column {
  id: string;
  boardId: string;
  name: string;
  position: number;
  tasks: Task[];
}

export interface Task {
  id: string;
  columnId: string;
  title: string;
  description: string | null;
  position: number;
  dueDate: string | null;
  createdAt: string;
  completedAt?: string | null;
  version: number;
  assignees: TaskAssignee[];
  taskLabels: TaskLabel[];
  _count: {
    comments: number;
    attachments: number;
  };
}

export interface TaskAssignee {
  id: string;
  taskId: string;
  userId: string;
  user: User;
}

export interface Label {
  id: string;
  boardId: string;
  name: string;
  colorHex: string;
}

export interface TaskLabel {
  taskId: string;
  labelId: string;
  label: Label;
}

export interface Comment {
  id: string;
  taskId: string;
  userId: string;
  content: string;
  createdAt: string;
  user: { id: string; name: string };
}

export interface Attachment {
  id: string;
  taskId: string;
  fileUrl: string;
  fileName: string;
  fileSize: number;
  uploadedAt: string;
}

export interface AuthResponse {
  user: User;
  accessToken: string;
  workspace?: Workspace;
}

export interface ActivityLog {
  id: string;
  boardId: string;
  userId: string;
  action: string;
  createdAt: string;
  user: { id: string; name: string };
}

export interface Notification {
  id: string;
  userId: string;
  boardId: string;
  taskId: string | null;
  message: string;
  isRead: boolean;
  createdAt: string;
}

export interface NotificationsResponse {
  notifications: Notification[];
  unread: number;
}

export interface DashboardStats {
  isGlobalAdmin: boolean;
  scope: "organization" | "accessible";
  boardCount: number;
  personal: Pick<DashboardStats, "totalTasks" | "completedTasks" | "overdueTasks" | "avgCompletionTime">;
  totalTasks: number;
  completedTasks: number;
  overdueTasks: number;
  avgCompletionTime: number | null;
  tasksPerColumn: { name: string; count: number; percentage: number }[];
  topContributors: { userId: string; name: string; email: string; completedCount: number }[];
  recentTasks: {
    id: string;
    title: string;
    columnName: string;
    boardId: string;
    boardName: string;
    dueDate: string | null;
    assignees: { id: string; name: string }[];
  }[];
  taskTrends: { date: string; completed: number; created: number }[];
}

export interface GlobalBoard extends Board {
  workspaceName: string;
}

export interface GlobalBoardResponse {
  boards: GlobalBoard[];
  isGlobalAdmin: boolean;
}

export interface TransferTarget {
  workspaceId: string;
  name: string;
  ownerName: string;
  ownerEmail: string;
}

export interface AdminUserMembership {
  boardId: string;
  boardName: string;
  role: string;
}

export interface AdminUser {
  id: string;
  name: string;
  email: string;
  createdAt: string;
  isGlobalAdmin: boolean;
  boardCount: number;
  adminBoardCount: number;
  memberships: AdminUserMembership[];
}

export interface AutomationRule {
  id: string;
  boardId: string;
  labelId: string;
  targetColumnId: string;
  enabled: boolean;
  createdAt: string;
  label: Label;
  targetColumn: Column;
}
