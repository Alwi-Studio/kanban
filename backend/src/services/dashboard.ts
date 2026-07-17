import prisma from "../lib/prisma";


interface ScopeStats {
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

interface DashboardStats extends ScopeStats {
  isGlobalAdmin: boolean;
  scope: "organization" | "accessible";
  boardCount: number;
  personal: ScopeStats;
}

export async function getDashboardStats(userId: string): Promise<DashboardStats> {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { isGlobalAdmin: true } });
  const boards = await prisma.board.findMany({
    where: user?.isGlobalAdmin ? {} : { members: { some: { userId } } },
    include: {
      columns: {
        orderBy: { position: "asc" },
        include: {
          tasks: {
            include: {
              assignees: { include: { user: { select: { id: true, name: true, email: true } } } },
              _count: { select: { comments: true, attachments: true } },
            },
          },
        },
      },
    },
  });

  const allTasks = boards.flatMap((b) => b.columns.flatMap((c) => c.tasks));
  type TaskRow = (typeof allTasks)[number];

  // Precompute a task -> column / board index once so per-scope lookups are cheap.
  const columnById = new Map<string, { name: string; boardId: string }>();
  const boardById = new Map<string, { id: string; name: string }>();
  const columnOfTask = new Map<string, { name: string; boardId: string }>();
  for (const b of boards) {
    boardById.set(b.id, { id: b.id, name: b.name });
    for (const c of b.columns) {
      columnById.set(c.id, { name: c.name, boardId: b.id });
      for (const t of c.tasks) columnOfTask.set(t.id, { name: c.name, boardId: b.id });
    }
  }

  // A task counts as done once it has a completedAt timestamp (set by moving into
  // a Done column or by a "mark complete" automation) — it stays done wherever it
  // moves afterwards. Legacy tasks with no timestamp fall back to the column name.
  const DONE_COLUMN_NAMES = ["done", "completed", "complete", "selesai"];
  const isDone = (t: TaskRow) =>
    t.completedAt != null || DONE_COLUMN_NAMES.includes(columnOfTask.get(t.id)?.name.trim().toLowerCase() || "");
  const isOverdue = (t: TaskRow) => {
    if (!t.dueDate || isDone(t)) return false;
    return new Date(t.dueDate) < new Date();
  };

  function computeScope(tasks: TaskRow[]): ScopeStats {
    const doneTasks = tasks.filter(isDone);
    const overdueTasks = tasks.filter(isOverdue);

    let avgCompletionTime: number | null = null;
    const completedWithDuration = doneTasks.filter((t) => t.completedAt);
    if (completedWithDuration.length > 0) {
      const totalMs = completedWithDuration.reduce((sum, t) => sum + (t.completedAt!.getTime() - t.createdAt.getTime()), 0);
      avgCompletionTime = Math.round(totalMs / completedWithDuration.length / (1000 * 60 * 60 * 24) * 10) / 10;
    }

    const columnCounts = new Map<string, number>();
    for (const t of tasks) {
      const name = columnOfTask.get(t.id)?.name || "";
      columnCounts.set(name, (columnCounts.get(name) || 0) + 1);
    }
    const total = tasks.length || 1;
    const tasksPerColumn = Array.from(columnCounts.entries()).map(([name, count]) => ({
      name,
      count,
      percentage: Math.round((count / total) * 100),
    }));

    const contributorMap = new Map<string, { name: string; email: string; count: number }>();
    for (const t of doneTasks) {
      for (const a of t.assignees) {
        const existing = contributorMap.get(a.user.id);
        if (existing) existing.count++;
        else contributorMap.set(a.user.id, { name: a.user.name, email: a.user.email, count: 1 });
      }
    }
    const topContributors = Array.from(contributorMap.entries())
      .map(([id, val]) => ({ userId: id, name: val.name, email: val.email, completedCount: val.count }))
      .sort((a, b) => b.completedCount - a.completedCount)
      .slice(0, 5);

    const recentTasks = tasks
      .map((t) => {
        const col = columnOfTask.get(t.id);
        const board = col ? boardById.get(col.boardId) : undefined;
        return {
          id: t.id,
          title: t.title,
          columnName: col?.name || "",
          boardId: board?.id || "",
          boardName: board?.name || "",
          dueDate: t.dueDate?.toISOString() || null,
          assignees: t.assignees.map((a) => ({ id: a.user.id, name: a.user.name })),
          createdAt: t.createdAt,
        };
      })
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 10)
      .map(({ createdAt, ...rest }) => rest);

    const now = new Date();
    const trendMap = new Map<string, { completed: number; created: number }>();
    for (let i = 29; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      trendMap.set(d.toISOString().slice(0, 10), { completed: 0, created: 0 });
    }
    for (const t of doneTasks) {
      const key = (t.completedAt || t.createdAt).toISOString().slice(0, 10);
      if (trendMap.has(key)) trendMap.get(key)!.completed++;
    }
    for (const t of tasks) {
      const key = t.createdAt.toISOString().slice(0, 10);
      if (trendMap.has(key)) trendMap.get(key)!.created++;
    }
    const taskTrends = Array.from(trendMap.entries()).map(([date, val]) => ({ date, ...val }));

    return {
      totalTasks: tasks.length,
      completedTasks: doneTasks.length,
      overdueTasks: overdueTasks.length,
      avgCompletionTime,
      tasksPerColumn,
      topContributors,
      recentTasks,
      taskTrends,
    };
  }

  const organization = computeScope(allTasks);
  const personalTasks = allTasks.filter((task) => task.assignees.some((assignee) => assignee.userId === userId));
  const personal = computeScope(personalTasks);

  return {
    isGlobalAdmin: Boolean(user?.isGlobalAdmin),
    scope: user?.isGlobalAdmin ? "organization" : "accessible",
    boardCount: boards.length,
    ...organization,
    personal,
  };
}
