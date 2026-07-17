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
  description?: string | null;
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

export type AutomationTriggerType =
  | "TASK_CREATED"
  | "TASK_MOVED"
  | "LABEL_ADDED"
  | "LABEL_REMOVED"
  | "ASSIGNEE_ADDED"
  | "ASSIGNEE_REMOVED"
  | "TASK_COMPLETED";

export type AutomationCondition =
  | { type: "HAS_LABEL"; labelId: string }
  | { type: "NOT_HAS_LABEL"; labelId: string }
  | { type: "IN_COLUMN"; columnId: string }
  | { type: "HAS_ANY_ASSIGNEE" }
  | { type: "HAS_ASSIGNEE"; userId: string }
  | { type: "NO_ASSIGNEE" }
  | { type: "TITLE_CONTAINS"; text: string };

export type AutomationAction =
  | { type: "ADD_LABELS"; labelIds: string[] }
  | { type: "REMOVE_LABELS"; labelIds: string[] }
  | { type: "MOVE_TO_COLUMN"; columnId: string }
  | { type: "ASSIGN_MEMBERS"; userIds: string[] }
  | { type: "UNASSIGN_MEMBERS"; userIds: string[] }
  | { type: "SET_DUE_DATE"; offsetDays: number }
  | { type: "CLEAR_DUE_DATE" }
  | { type: "ADD_COMMENT"; text: string }
  | { type: "NOTIFY"; target: "assignees" | "members"; message: string }
  | { type: "MARK_COMPLETE" };

export type AutomationConditionType = AutomationCondition["type"];
export type AutomationActionType = AutomationAction["type"];

export interface AutomationRule {
  id: string;
  boardId: string;
  triggerType: AutomationTriggerType;
  triggerLabelId: string | null;
  triggerColumnId: string | null;
  name: string | null;
  conditions: AutomationCondition[];
  actions: AutomationAction[];
  enabled: boolean;
  createdAt: string;
  triggerLabel: Label | null;
  triggerColumn: Column | null;
}

export interface AutomationRuleInput {
  trigger_type: AutomationTriggerType;
  trigger_label_id?: string | null;
  trigger_column_id?: string | null;
  name?: string | null;
  conditions?: AutomationCondition[];
  actions?: AutomationAction[];
}

// Staff-activity statistics (from the MySQL staffactivity source)
export type StaffStatsRange = "month" | "today" | "day" | "week";

export interface StaffStatsPeriod {
  year: number;
  month: number;
}

export interface StaffStatsSummary {
  totalStaff: number;
  totalChat: number;
  totalActivity: number;
  totalPoints: number;
  trackedDays: number;
}

export interface StaffStatsEntry {
  uuid: string;
  name: string | null;
  lastActivity: number;
  amountChat: number;
  points: number;
}

export interface StaffStatsChartPoint {
  year: number;
  month: number;
  day: number;
  amountChat: number;
  activityTime: number;
  points: number;
}

export interface StaffStatistics {
  summary: StaffStatsSummary;
  top: StaffStatsEntry[];
  chart: StaffStatsChartPoint[];
  storageBytes: number;
  periods: StaffStatsPeriod[];
  selectedPeriod: StaffStatsPeriod | null;
  selectedRange: StaffStatsRange;
  selectedDateFrom: string | null;
  selectedDateTo: string | null;
  selectedWeek: number | null;
  generatedAt: string;
}

export interface StaffStatsQuery {
  range?: StaffStatsRange;
  year?: number;
  month?: number;
  dateFrom?: string;
  dateTo?: string;
  week?: number;
  limit?: number;
}
