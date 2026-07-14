import prisma from "../lib/prisma";


interface DashboardStats {
  isGlobalAdmin: boolean;
  scope: "organization" | "accessible";
  boardCount: number;
  personal: { totalTasks: number; completedTasks: number; overdueTasks: number; avgCompletionTime: number | null };
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
  // A task counts as done once it has a completedAt timestamp (set by moving into
  // a Done column or by a "mark complete" automation) — it stays done wherever it
  // moves afterwards. Legacy tasks with no timestamp fall back to the column name.
  const DONE_COLUMN_NAMES = ["done", "completed", "complete", "selesai"];
  const columnOf = (t: (typeof allTasks)[number]) =>
    boards.flatMap((b) => b.columns).find((c) => c.tasks.some((x) => x.id === t.id));
  const isDone = (t: (typeof allTasks)[number]) =>
    t.completedAt != null || DONE_COLUMN_NAMES.includes(columnOf(t)?.name.trim().toLowerCase() || "");
  const doneTasks = allTasks.filter(isDone);
  const overdueTasks = allTasks.filter((t) => {
    if (!t.dueDate || isDone(t)) return false;
    return new Date(t.dueDate) < new Date();
  });

  let avgCompletionTime: number | null = null;
  const completedWithDuration = doneTasks.filter((t) => t.completedAt);
  if (completedWithDuration.length > 0) {
    const totalMs = completedWithDuration.reduce((sum, t) => {
      return sum + (t.completedAt!.getTime() - t.createdAt.getTime());
    }, 0);
    avgCompletionTime = Math.round(totalMs / completedWithDuration.length / (1000 * 60 * 60 * 24) * 10) / 10;
  }

  const columnCounts = new Map<string, number>();
  for (const b of boards) {
    for (const c of b.columns) {
      columnCounts.set(c.name, (columnCounts.get(c.name) || 0) + c.tasks.length);
    }
  }
  const total = allTasks.length || 1;
  const tasksPerColumn = Array.from(columnCounts.entries()).map(([name, count]) => ({
    name,
    count,
    percentage: Math.round((count / total) * 100),
  }));

  const contributorMap = new Map<string, { name: string; email: string; count: number }>();
  for (const t of doneTasks) {
    for (const a of t.assignees) {
      const existing = contributorMap.get(a.user.id);
      if (existing) {
        existing.count++;
      } else {
        contributorMap.set(a.user.id, { name: a.user.name, email: a.user.email, count: 1 });
      }
    }
  }
  const topContributors = Array.from(contributorMap.entries())
    .map(([userId, val]) => ({ userId, name: val.name, email: val.email, completedCount: val.count }))
    .sort((a, b) => b.completedCount - a.completedCount)
    .slice(0, 5);

  const flatTasks = allTasks
    .map((t) => {
      const col = boards.flatMap((b) => b.columns).find((c) => c.tasks.some((x) => x.id === t.id));
      const board = boards.find((b) => b.columns.some((c) => c.tasks.some((x) => x.id === t.id)));
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
    .slice(0, 10);

  const now = new Date();
  const trendMap = new Map<string, { completed: number; created: number }>();
  for (let i = 29; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    const key = d.toISOString().slice(0, 10);
    trendMap.set(key, { completed: 0, created: 0 });
  }
  for (const t of doneTasks) {
    const key = (t.completedAt || t.createdAt).toISOString().slice(0, 10);
    if (trendMap.has(key)) {
      trendMap.get(key)!.completed++;
    }
  }
  for (const t of allTasks) {
    const key = t.createdAt.toISOString().slice(0, 10);
    if (trendMap.has(key)) {
      trendMap.get(key)!.created++;
    }
  }
  const taskTrends = Array.from(trendMap.entries()).map(([date, val]) => ({
    date,
    ...val,
  }));

  const personalTasks = allTasks.filter(task => task.assignees.some(assignee => assignee.userId === userId));
  const doneIds = new Set(doneTasks.map(task => task.id));
  const overdueIds = new Set(overdueTasks.map(task => task.id));
  const personalDone = personalTasks.filter(task => doneIds.has(task.id));
  const personalDurations = personalDone.filter(task => task.completedAt).map(task => task.completedAt!.getTime() - task.createdAt.getTime());

  return {
    isGlobalAdmin: Boolean(user?.isGlobalAdmin),
    scope: user?.isGlobalAdmin ? "organization" : "accessible",
    boardCount: boards.length,
    personal: {
      totalTasks: personalTasks.length,
      completedTasks: personalDone.length,
      overdueTasks: personalTasks.filter(task => overdueIds.has(task.id)).length,
      avgCompletionTime: personalDurations.length
        ? Math.round(personalDurations.reduce((sum, duration) => sum + duration, 0) / personalDurations.length / 8640000) / 10
        : null,
    },
    totalTasks: allTasks.length,
    completedTasks: doneTasks.length,
    overdueTasks: overdueTasks.length,
    avgCompletionTime,
    tasksPerColumn,
    topContributors,
    recentTasks: flatTasks,
    taskTrends,
  };
}
